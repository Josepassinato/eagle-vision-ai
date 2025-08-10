#!/usr/bin/env python3
"""
Fusion API - Serviço de fusão que integra YOLO, Face, Re-ID, Tracking e Motion
Decisão inteligente sobre identificação de pessoas e envio para Supabase
"""

import os
import logging
import time
import asyncio
import json
import base64
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any, Tuple
from io import BytesIO
import random
import threading
from collections import deque

import uvicorn
import requests
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST

# Import dos módulos de tracking
import sys
sys.path.append('/vision_tracking')
from vision_tracking import VisionTracker, MotionAnalyzer

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuração via ENV
YOLO_URL = os.getenv("YOLO_URL", "http://yolo:18060")
FACE_URL = os.getenv("FACE_URL", "http://face:18081") 
REID_URL = os.getenv("REID_URL", "http://reid:18090")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
INGEST_EVENT_URL = os.getenv("INGEST_EVENT_URL")
VISION_WEBHOOK_SECRET = os.getenv("VISION_WEBHOOK_SECRET")

# Notifier configuration
NOTIFIER_URL = os.getenv("NOTIFIER_URL", "http://notifier:8085/notify_event")
ENABLE_NOTIFIER = os.getenv("ENABLE_NOTIFIER", "true").lower() == "true"

# Thresholds
T_FACE = float(os.getenv("T_FACE", "0.60"))
T_REID = float(os.getenv("T_REID", "0.82"))
T_MOVE = float(os.getenv("T_MOVE", "3"))
N_FRAMES = int(os.getenv("N_FRAMES", "15"))

# Multi-tracker
MULTI_TRACKER_URL = os.getenv("MULTI_TRACKER_URL", "http://multi-tracker:8087")
# Clip Exporter
CLIP_EXPORTER_URL = os.getenv("CLIP_EXPORTER_URL", "http://clip-exporter:8095")

# Limites
MAX_PEOPLE = int(os.getenv("MAX_PEOPLE", "10"))
MAX_IMAGE_MB = int(os.getenv("MAX_IMAGE_MB", "2"))
REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "0.150"))  # 150ms
# Resilience configuration
RETRY_MAX_ATTEMPTS = int(os.getenv("RETRY_MAX_ATTEMPTS", "5"))
RETRY_BASE_DELAY_MS = int(os.getenv("RETRY_BASE_DELAY_MS", "500"))
CIRCUIT_BREAKER_FAIL_THRESHOLD = float(os.getenv("CIRCUIT_BREAKER_FAIL_THRESHOLD", "0.5"))
CIRCUIT_BREAKER_OPEN_SECONDS = int(os.getenv("CIRCUIT_BREAKER_OPEN_SECONDS", "20"))
QUEUE_DIR = os.getenv("QUEUE_DIR", "/queues/fusion")

# Instâncias globais
app = FastAPI(title="Fusion API", description="Visão de Águia - Person Identification Fusion", version="1.0.0")
vision_tracker = VisionTracker()
motion_analyzer = MotionAnalyzer()

# Métricas Prometheus
fusion_infer_seconds = Histogram('fusion_infer_seconds', 'Time spent in fusion inference stages', ['stage'])
fusion_decisions_total = Counter('fusion_decisions_total', 'Total decisions made', ['reason'])
fusion_similarity_face = Histogram('fusion_similarity_face', 'Face similarity scores')
fusion_similarity_reid = Histogram('fusion_similarity_reid', 'ReID similarity scores')
# Resilience metrics
service_http_failures_total = Counter('service_http_failures_total', 'HTTP failures to dependencies', ['service'])
service_http_retries_total = Counter('service_http_retries_total', 'HTTP retries to dependencies', ['service'])
circuit_breaker_open_total = Counter('circuit_breaker_open_total', 'Circuit breaker opened', ['service'])

# Modelos de dados
class IngestFrameRequest(BaseModel):
    camera_id: str
    ts: float
    jpg_b64: str
    max_people: Optional[int] = Field(default=10, le=50)

class EventResponse(BaseModel):
    camera_id: str
    person_id: Optional[str]
    reason: str
    face_similarity: Optional[float]
    reid_similarity: Optional[float]
    frames_confirmed: int
    movement_px: float
    ts: str

class IngestFrameResponse(BaseModel):
    events: List[EventResponse]

class HealthResponse(BaseModel):
    status: str
    services: Dict[str, str]
    thresholds: Dict[str, float]

# Utilitários
def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decodifica base64 para numpy array (BGR)"""
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    
    image_bytes = base64.b64decode(b64_string)
    
    # Verificar tamanho
    if len(image_bytes) > MAX_IMAGE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Image too large (max {MAX_IMAGE_MB}MB)")
    
    image = Image.open(BytesIO(image_bytes))
    return np.array(image.convert("RGB"))

def crop_image(img: np.ndarray, xyxy: List[float]) -> np.ndarray:
    """Recorta imagem usando bbox [x1, y1, x2, y2]"""
    x1, y1, x2, y2 = map(int, xyxy)
    return img[y1:y2, x1:x2]

def encode_image_b64(img: np.ndarray) -> str:
    """Converte numpy array para base64 JPEG"""
    pil_img = Image.fromarray(img)
    buffer = BytesIO()
    pil_img.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode()

class CircuitBreaker:
    def __init__(self, fail_threshold: float, open_seconds: int):
        self.fail_threshold = fail_threshold
        self.open_seconds = open_seconds
        self.failures: deque = deque()  # (ts, is_error)
        self.state = 'closed'
        self.open_until = 0.0

    def allow(self) -> bool:
        now = time.time()
        if self.state == 'open':
            if now >= self.open_until:
                self.state = 'half-open'
                return True
            return False
        return True

    def record(self, ok: bool):
        now = time.time()
        # purge entries older than 30s
        horizon = now - 30
        while self.failures and self.failures[0][0] < horizon:
            self.failures.popleft()
        self.failures.append((now, 0 if ok else 1))
        # compute failure rate
        if self.failures:
            errs = sum(v for _, v in self.failures)
            rate = errs / len(self.failures)
            if rate >= CIRCUIT_BREAKER_FAIL_THRESHOLD and len(self.failures) >= 4:
                self.state = 'open'
                self.open_until = now + CIRCUIT_BREAKER_OPEN_SECONDS

    def on_success(self):
        if self.state == 'half-open':
            self.state = 'closed'
        # also record success
        self.record(True)

    def on_failure(self):
        if self.state == 'half-open':
            # re-open immediately
            self.state = 'open'
            self.open_until = time.time() + CIRCUIT_BREAKER_OPEN_SECONDS
        self.record(False)

_breakers: Dict[str, CircuitBreaker] = {}

def _get_breaker(service: str) -> CircuitBreaker:
    if service not in _breakers:
        _breakers[service] = CircuitBreaker(CIRCUIT_BREAKER_FAIL_THRESHOLD, CIRCUIT_BREAKER_OPEN_SECONDS)
    return _get_breaker.cache.setdefault(service, _breakers[service])
_get_breaker.cache = {}

def _exp_backoff_sleep(attempt: int):
    base = RETRY_BASE_DELAY_MS / 1000.0
    delay = base * (2 ** attempt)
    jitter = random.uniform(0, base)
    time.sleep(min(5.0, delay + jitter))

async def call_service_with_retry(url: str, payload: Dict, headers: Dict, service_name: str, timeout: Optional[float] = None) -> Optional[Dict]:
    """HTTP POST with retries, exponential backoff + jitter, and circuit breaker"""
    br = _get_breaker(service_name)
    if not br.allow():
        circuit_breaker_open_total.labels(service=service_name).inc()
        logger.warning(f"Circuit open for {service_name}, skipping request")
        return None

    max_attempts = RETRY_MAX_ATTEMPTS
    timeout = timeout or REQUEST_TIMEOUT

    for attempt in range(max_attempts):
        try:
            with fusion_infer_seconds.labels(stage=service_name).time():
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
            if resp.status_code == 200:
                br.on_success()
                if attempt > 0:
                    service_http_retries_total.labels(service=service_name).inc()
                return resp.json()
            elif 500 <= resp.status_code < 600:
                service_http_failures_total.labels(service=service_name).inc()
                br.on_failure()
            else:
                # 4xx do not retry
                logger.warning(f"{service_name} returned {resp.status_code}: {resp.text[:200]}")
                br.on_failure()
                break
        except requests.exceptions.RequestException as e:
            service_http_failures_total.labels(service=service_name).inc()
            logger.warning(f"{service_name} request error (attempt {attempt+1}/{max_attempts}): {e}")
            br.on_failure()
        if attempt < max_attempts - 1:
            _exp_backoff_sleep(attempt)

    logger.error(f"Failed to call {service_name} after {max_attempts} attempts")
    return None

# Persistent queue utilities for failed Supabase event posts
os.makedirs(QUEUE_DIR, exist_ok=True)
QUEUE_EVENTS_DIR = os.path.join(QUEUE_DIR, 'events')
os.makedirs(QUEUE_EVENTS_DIR, exist_ok=True)

def _enqueue_event(event: Dict[str, Any]):
    try:
        fname = f"{int(time.time())}-{random.randint(1000,9999)}.json"
        path = os.path.join(QUEUE_EVENTS_DIR, fname)
        with open(path, 'w') as f:
            json.dump(event, f)
        logger.warning(f"Enqueued event for retry: {path}")
    except Exception as e:
        logger.error(f"Failed to enqueue event: {e}")

def _queue_worker():
    while True:
        try:
            for fname in list(os.listdir(QUEUE_EVENTS_DIR)):
                if not fname.endswith('.json'):
                    continue
                path = os.path.join(QUEUE_EVENTS_DIR, fname)
                try:
                    with open(path, 'r') as f:
                        event = json.load(f)
                    # Try send again
                    res = requests.post(INGEST_EVENT_URL, json=event, headers={"Content-Type": "application/json", "x-vision-auth": VISION_WEBHOOK_SECRET}, timeout=3.0)
                    if res.status_code == 200:
                        os.remove(path)
                        logger.info(f"Retried and sent queued event: {fname}")
                    else:
                        logger.warning(f"Retry failed ({res.status_code}), will keep: {fname}")
                except Exception as e:
                    logger.warning(f"Error processing queued event {fname}: {e}")
            time.sleep(5)
        except Exception:
            time.sleep(5)

async def send_to_ingest_event(event_data: Dict) -> Optional[int]:
    """Envia evento para Edge Function ingest_event e retorna event_id"""
    if not INGEST_EVENT_URL or not VISION_WEBHOOK_SECRET:
        logger.error("Missing INGEST_EVENT_URL or VISION_WEBHOOK_SECRET")
        return None
    headers = {"Content-Type": "application/json", "x-vision-auth": VISION_WEBHOOK_SECRET}

    result = await call_service_with_retry(INGEST_EVENT_URL, event_data, headers, "supabase-ingest", timeout=3.0)
    if result and isinstance(result, dict):
        evt_id = result.get("event_id")
        if evt_id:
            logger.info(f"Event sent successfully to Supabase: id={evt_id}")
            return evt_id
    # Failure path → enqueue for retry
    _enqueue_event(event_data)
    return None

async def send_to_notifier(event_data: Dict, jpg_b64: Optional[str] = None) -> bool:
    """Envia evento para o serviço Notifier (Telegram)"""
    if not ENABLE_NOTIFIER:
        return True
    notifier_payload = {
        "camera_id": event_data["camera_id"],
        "person_id": event_data.get("person_id"),
        "person_name": event_data.get("person_name"),
        "reason": event_data["reason"],
        "face_similarity": event_data.get("face_similarity") or 0.0,
        "reid_similarity": event_data.get("reid_similarity") or 0.0,
        "frames_confirmed": event_data["frames_confirmed"],
        "movement_px": event_data["movement_px"],
        "ts": event_data["ts"],
        "jpg_b64": jpg_b64
    }

    res = await call_service_with_retry(NOTIFIER_URL, notifier_payload, {"Content-Type": "application/json"}, "notifier", timeout=4.0)
    return bool(res)

# Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Verifica saúde do serviço e dependências"""
    services = {}
    
    # Testar cada serviço
    for service_name, url in [("yolo", YOLO_URL), ("face", FACE_URL), ("reid", REID_URL)]:
        try:
            response = requests.get(f"{url}/health", timeout=2.0)
            services[service_name] = "ok" if response.status_code == 200 else "error"
        except:
            services[service_name] = "error"
    
    return HealthResponse(
        status="ok",
        services=services,
        thresholds={
            "T_FACE": T_FACE,
            "T_REID": T_REID,
            "T_MOVE": T_MOVE,
            "N_FRAMES": N_FRAMES
        }
    )

@app.post("/ingest_frame", response_model=IngestFrameResponse)
async def ingest_frame(request: IngestFrameRequest):
    """Pipeline principal de processamento de frame"""
    logger.info(f"Processing frame for camera {request.camera_id} at {request.ts}")
    
    start_time = time.time()
    events = []
    
    try:
        # Decodificar imagem
        img = decode_base64_image(request.jpg_b64)
        height, width = img.shape[:2]
        
        # 1. Detectar pessoas com YOLO
        with fusion_infer_seconds.labels(stage="yolo").time():
            yolo_payload = {
                "jpg_b64": request.jpg_b64,
                "classes": [0],  # pessoa
                "conf_threshold": 0.25
            }
            
            yolo_result = await call_service_with_retry(
                f"{YOLO_URL}/detect", 
                yolo_payload, 
                {"Content-Type": "application/json"},
                "yolo"
            )
        
        if not yolo_result or "detections" not in yolo_result:
            logger.warning("No YOLO detections or service failed")
            return IngestFrameResponse(events=[])
        
        # Limitar número de pessoas
        detections = yolo_result["detections"][:request.max_people or MAX_PEOPLE]
        
        if not detections:
            return IngestFrameResponse(events=[])
        
        # Extrair bboxes para o tracker
        boxes_xyxy = [[det["x1"], det["y1"], det["x2"], det["y2"]] for det in detections]
        
        # 2. Atualizar tracker
        with fusion_infer_seconds.labels(stage="tracking").time():
            track_ids = vision_tracker.update(request.camera_id, boxes_xyxy)
        
        # 3. Processar cada detecção
        for i, (detection, track_id) in enumerate(zip(detections, track_ids)):
            bbox = [detection["x1"], detection["y1"], detection["x2"], detection["y2"]]
            
            # Atualizar movimento
            move_px = motion_analyzer.update_and_displacement(request.camera_id, track_id, bbox)
            frames_confirmed = vision_tracker.frames_confirmed(request.camera_id, track_id)
            
            # Crop do corpo
            crop_body = crop_image(img, bbox)
            crop_b64 = encode_image_b64(crop_body)
            
            # Variáveis para decisão
            face_sim = None
            reid_sim = None
            person_id = None
            reason = None
            
            # 4. Tentar reconhecimento facial
            if crop_body.shape[0] > 50 and crop_body.shape[1] > 50:  # Mínimo para face
                with fusion_infer_seconds.labels(stage="face").time():
                    face_payload = {"jpg_b64": crop_b64}
                    face_result = await call_service_with_retry(
                        f"{FACE_URL}/extract",
                        face_payload,
                        {"Content-Type": "application/json"},
                        "face"
                    )
                
                if face_result and len(face_result) > 0 and "embedding" in face_result[0]:
                    # Fazer match facial usando cliente Python inline
                    try:
                        import sys
                        sys.path.append('/face-service')
                        from face_client import match_face
                        
                        face_matches = match_face(crop_b64, top_k=1)
                        if face_matches:
                            face_sim = face_matches[0]["similarity"]
                            fusion_similarity_face.observe(face_sim)
                            
                            if face_sim >= T_FACE and frames_confirmed >= N_FRAMES:
                                person_id = face_matches[0]["id"]
                                reason = "face"
                                fusion_decisions_total.labels(reason="face").inc()
                    except Exception as e:
                        logger.warning(f"Face matching failed: {e}")
            
            # 5. Se não confirmou por face, tentar Re-ID
            if not person_id:
                with fusion_infer_seconds.labels(stage="reid").time():
                    reid_payload = {"jpg_b64": crop_b64}
                    reid_result = await call_service_with_retry(
                        f"{REID_URL}/match",
                        reid_payload,
                        {"Content-Type": "application/json"},
                        "reid"
                    )
                
                if reid_result and "results" in reid_result and reid_result["results"]:
                    reid_sim = reid_result["results"][0]["similarity"]
                    fusion_similarity_reid.observe(reid_sim)
                    
                    # Decisão por Re-ID + movimento + persistência
                    if (reid_sim >= T_REID and 
                        move_px >= T_MOVE and 
                        frames_confirmed >= N_FRAMES):
                        person_id = reid_result["results"][0]["id"]
                        reason = "reid+motion"
                        fusion_decisions_total.labels(reason="reid+motion").inc()
            
            # 6. Se confirmou identificação, criar evento
            if person_id and reason:
                ts_iso = datetime.fromtimestamp(request.ts, timezone.utc).isoformat()

                # Resolver identidade global no multi-tracker
                try:
                    resolve_req = {
                        "camera_id": request.camera_id,
                        "ts": ts_iso,
                        "jpg_b64": crop_b64,
                        "prelim_person_id": person_id,
                        "face_similarity": face_sim,
                        "reid_similarity": reid_sim,
                    }
                    resolve_res = await call_service_with_retry(
                        f"{MULTI_TRACKER_URL}/resolve",
                        resolve_req,
                        {"Content-Type": "application/json"},
                        "multi-tracker"
                    )
                    if resolve_res and resolve_res.get("global_person_id"):
                        person_id = resolve_res["global_person_id"]
                except Exception as e:
                    logger.warning(f"multi-tracker resolve failed: {e}")

                event_data = {
                    "camera_id": request.camera_id,
                    "person_id": person_id,
                    "reason": reason,
                    "face_similarity": face_sim,
                    "reid_similarity": reid_sim,
                    "frames_confirmed": frames_confirmed,
                    "movement_px": move_px,
                    "ts": ts_iso
                }
                
                # Enviar para Supabase
                event_id = await send_to_ingest_event(event_data)
                
                if event_id:
                    events.append(EventResponse(**event_data))
                    
                    # Enviar para Notifier (Telegram) de forma assíncrona
                    asyncio.create_task(send_to_notifier(event_data, crop_b64))
                    
                    # Disparar exportação de clipe (assíncrono, melhor esforço)
                    try:
                        asyncio.create_task(
                            call_service_with_retry(
                                f"{CLIP_EXPORTER_URL}/export_clip",
                                {"event_id": event_id},
                                {"Content-Type": "application/json"},
                                "clip-exporter",
                            )
                        )
                    except Exception as e:
                        logger.warning(f"clip-exporter trigger failed: {e}")
                    
                    logger.info(f"Event confirmed: track_id={track_id}, person_id={person_id}, "
                              f"reason={reason}, face_sim={face_sim}, reid_sim={reid_sim}, "
                              f"frames={frames_confirmed}, move_px={move_px:.2f}")
        
        total_time = time.time() - start_time
        logger.info(f"Frame processed in {total_time:.3f}s, {len(events)} events generated")
        
        return IngestFrameResponse(events=events)
        
    except Exception as e:
        logger.error(f"Error processing frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics():
    """Métricas Prometheus"""
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Startup
@app.on_event("startup")
async def startup_event():
    """Inicialização do serviço"""
    logger.info("Starting Fusion API...")
    logger.info(f"Configuration: T_FACE={T_FACE}, T_REID={T_REID}, T_MOVE={T_MOVE}, N_FRAMES={N_FRAMES}")
    logger.info(f"Services: YOLO={YOLO_URL}, FACE={FACE_URL}, REID={REID_URL}")
    # Start queue worker
    threading.Thread(target=_queue_worker, daemon=True).start()
    logger.info(f"Notifier: ENABLE_NOTIFIER={ENABLE_NOTIFIER}, NOTIFIER_URL={NOTIFIER_URL}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8080")),
        log_level="info"
    )