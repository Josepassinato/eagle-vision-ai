import os
import time
import json
import base64
import logging
import subprocess
import random
import threading
from io import BytesIO
from typing import Optional, Tuple, Dict, Any, List, Set, Deque
from collections import deque

import requests
from fastapi import FastAPI, Depends, HTTPException, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("enricher")

# Env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FACE_URL = os.getenv("FACE_URL", "http://face-service:18080").rstrip('/')
T_FACE = float(os.getenv("T_FACE", "0.60"))
DELTA_FACE = float(os.getenv("DELTA_FACE", "0.05"))
ENRICH_THRESHOLD = T_FACE + DELTA_FACE
K = int(os.getenv("K", "10"))
EMA_ALPHA = float(os.getenv("EMA_ALPHA", "0.30"))
STREAM_SNAPSHOT_URL = os.getenv("STREAM_SNAPSHOT_URL", "http://mediamtx:8888/simulador/index.m3u8")
POLL_INTERVAL_SEC = float(os.getenv("POLL_INTERVAL_SEC", "1.0"))
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")
SUPABASE_REALTIME = os.getenv("SUPABASE_REALTIME", "false").lower() == "true"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Metrics
updates_total = Counter('enricher_updates_total', 'Total de atualizações EMA aplicadas', ['person_id'])
skipped_total = Counter('enricher_skipped_total', 'Eventos ignorados', ['reason'])
last_event_id_gauge = Gauge('enricher_last_event_id', 'Último event.id processado')
backlog_gauge = Gauge('enricher_backlog', 'Qtde de eventos na fila por ciclo')
reconnects_total = Counter('enricher_realtime_reconnects_total', 'Total de reconexões do Realtime')
rt_latency_ms = Histogram('enricher_realtime_latency_ms', 'Latência ms do INSERT ao processamento', buckets=(10,25,50,75,100,150,200,300,400,500,750,1000,1500,2000))

# State
realtime_connected = False
person_locks: Dict[str, threading.Lock] = {}
processed_ids: Deque[int] = deque(maxlen=50000)
processed_ids_set: Set[int] = set()
processed_hashes: Deque[str] = deque(maxlen=50000)
processed_hashes_set: Set[str] = set()
locks_guard = threading.Lock()

app = FastAPI(title="Visão de Águia - Enricher")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AdminListResponse(BaseModel):
    person_id: str
    total: int
    items: List[Dict[str, Any]]


def require_admin(x_api_key: Optional[str] = Header(None)):
    if not ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Admin API desabilitada (sem chave)")
    if x_api_key != ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


def capture_snapshot_with_ffmpeg() -> Optional[bytes]:
    try:
        with subprocess.Popen([
            'ffmpeg', '-i', STREAM_SNAPSHOT_URL, '-vframes', '1', '-q:v', '2', '-f', 'image2pipe', 'pipe:1'
        ], stdout=subprocess.PIPE, stderr=subprocess.PIPE) as proc:
            stdout, _ = proc.communicate(timeout=5)
            if proc.returncode == 0 and stdout:
                return stdout
            else:
                logger.warning("ffmpeg falhou ao capturar snapshot")
                return None
    except Exception as e:
        logger.error(f"Erro snapshot: {e}")
        return None


def jpg_bytes_to_b64(jpg: bytes) -> str:
    return base64.b64encode(jpg).decode()


def extract_best_face_embedding(jpg_b64: str) -> Tuple[Optional[List[float]], Optional[float], Optional[int]]:
    """
    Chama InsightFace-REST /extract e retorna (embedding, det_score, face_height)
    """
    try:
        payload = {
            "images": {"data": [jpg_b64]},
            "extract_embedding": True,
            "extract_ga": False,
            "api_ver": "1"
        }
        resp = requests.post(f"{FACE_URL}/extract", json=payload, timeout=20)
        if not resp.ok:
            logger.error(f"face extract erro {resp.status_code}: {resp.text[:200]}")
            return None, None, None
        data = resp.json().get("data", [])
        if not data:
            return None, None, None
        # escolher maior det_score
        best = None
        for f in data:
            if "embedding" not in f:
                continue
            if best is None or float(f.get("det_score", 0)) > float(best.get("det_score", 0)):
                best = f
        if not best:
            return None, None, None
        emb = best.get("embedding")
        bbox = best.get("bbox", None)
        height = None
        if isinstance(bbox, list) and len(bbox) >= 4:
            try:
                x1, y1, x2, y2 = bbox[:4]
                height = int(max(0, (y2 - y1)))
            except Exception:
                height = None
        det = float(best.get("det_score", 0)) if best.get("det_score") is not None else None
        return emb, det, height
    except Exception as e:
        logger.error(f"Erro extract_best_face_embedding: {e}")
        return None, None, None


def passes_quality(det_score: Optional[float], height: Optional[int]) -> bool:
    if det_score is None or height is None:
        return False
    return det_score >= 0.90 and height >= 140


def ema_update(old: Optional[List[float]], new: List[float], alpha: float) -> List[float]:
    if not old or len(old) != len(new):
        return new
    return [alpha * n + (1 - alpha) * o for o, n in zip(old, new)]


def _get_lock(pid: str) -> threading.Lock:
    with locks_guard:
        if pid not in person_locks:
            person_locks[pid] = threading.Lock()
        return person_locks[pid]


def _mark_processed(ev_id: Optional[int], dedup_key: Optional[str]):
    if ev_id is not None:
        processed_ids.append(ev_id)
        processed_ids_set.add(ev_id)
        if len(processed_ids) == processed_ids.maxlen:
            # Evict oldest from set when deque rolls
            while len(processed_ids_set) > len(processed_ids):
                processed_ids_set.discard(processed_ids[0])
    if dedup_key is not None:
        processed_hashes.append(dedup_key)
        processed_hashes_set.add(dedup_key)
        if len(processed_hashes) == processed_hashes.maxlen:
            while len(processed_hashes_set) > len(processed_hashes):
                processed_hashes_set.discard(processed_hashes[0])


def _is_duplicate(ev_id: Optional[int], dedup_key: Optional[str]) -> bool:
    if ev_id is not None and ev_id in processed_ids_set:
        return True
    if dedup_key is not None and dedup_key in processed_hashes_set:
        return True
    return False


def process_event(ev: Dict[str, Any], jpg_b64: Optional[str] = None) -> bool:
    person_id = ev.get("person_id")
    face_sim = ev.get("face_similarity") or 0
    if not person_id:
        skipped_total.labels(reason="no_person").inc()
        return False
    if face_sim < ENRICH_THRESHOLD:
        skipped_total.labels(reason="low_similarity").inc()
        return False

    # imagem -> embedding
    if not jpg_b64:
        jpg = capture_snapshot_with_ffmpeg()
        if not jpg:
            skipped_total.labels(reason="no_image").inc()
            return False
        jpg_b64 = jpg_bytes_to_b64(jpg)

    emb, det, height = extract_best_face_embedding(jpg_b64)
    if not emb:
        skipped_total.labels(reason="no_face").inc()
        return False
    if not passes_quality(det, height):
        skipped_total.labels(reason="low_quality").inc()
        return False

    # Lock leve por pessoa
    lock = _get_lock(person_id)
    acquired = lock.acquire(blocking=False)
    if not acquired:
        skipped_total.labels(reason="lock_busy").inc()
        return False
    try:
        # Fetch current embedding
        q = supabase.table("people").select("face_embedding").eq("id", person_id).execute()
        old = None
        if q.data:
            old = q.data[0].get("face_embedding")
        new_emb = ema_update(old, emb, EMA_ALPHA)

        supabase.table("people").update({"face_embedding": new_emb}).eq("id", person_id).execute()
        supabase.table("people_faces").insert({
            "person_id": person_id,
            "embedding": emb,
        }).execute()

        # Enforce K
        pf = supabase.table("people_faces").select("id, created_at").eq("person_id", person_id).order("created_at", desc=False).execute()
        items = pf.data or []
        if len(items) > K:
            to_delete = [it["id"] for it in items[: len(items) - K]]
            if to_delete:
                supabase.table("people_faces").delete().in_("id", to_delete).execute()

        updates_total.labels(person_id=person_id).inc()
        return True
    except Exception as e:
        logger.error(f"Erro processando pessoa {person_id}: {e}")
        skipped_total.labels(reason="db_error").inc()
        return False
    finally:
        lock.release()


# Polling baseline
last_event_id: int = 0

def init_last_event_id():
    global last_event_id
    try:
        res = supabase.table("events").select("id").order("id", desc=True).limit(1).execute()
        if res.data:
            last_event_id = int(res.data[0]["id"])
            last_event_id_gauge.set(last_event_id)
            logger.info(f"Inicializando last_event_id={last_event_id}")
        else:
            last_event_id = 0
    except Exception as e:
        logger.error(f"Erro init_last_event_id: {e}")
        last_event_id = 0


def polling_loop():
    global last_event_id
    while not SUPABASE_REALTIME:
        try:
            resp = supabase.table("events").select("id, person_id, face_similarity, camera_id, ts, reason").gt("id", last_event_id).eq("reason", "face").filter("person_id", "not.is", None).order("id", desc=False).limit(50).execute()
            events = resp.data or []
            backlog_gauge.set(len(events))
            for ev in events:
                last_event_id = max(last_event_id, int(ev["id"]))
                last_event_id_gauge.set(last_event_id)
                try:
                    process_event(ev)
                except Exception as e:
                    logger.error(f"Erro ciclo evento: {e}")
            time.sleep(POLL_INTERVAL_SEC)
        except Exception as e:
            logger.error(f"Loop erro: {e}")
            time.sleep(2)


# Realtime
def handle_realtime_payload(payload: Dict[str, Any]) -> bool:
    """Utilitário testável para processar payload de INSERT da tabela events."""
    new = payload.get('new') or payload.get('record') or payload
    if not isinstance(new, dict):
        return False
    if new.get('reason') != 'face' or new.get('face_similarity') is None:
        return False

    ev_id = new.get('id')
    dedup_key = f"{new.get('camera_id')}|{new.get('person_id')}|{new.get('ts')}"
    if _is_duplicate(ev_id, dedup_key):
        skipped_total.labels(reason="duplicate").inc()
        return False

    start = time.time()
    ok = process_event(new)
    _mark_processed(ev_id, dedup_key)
    # Latência aprox: now - ts
    try:
        ts_val = new.get('ts')
        if ts_val:
            # ts pode ser string ISO ou epoch
            if isinstance(ts_val, (int, float)):
                dt_ms = (time.time() - float(ts_val)) * 1000.0
            else:
                from datetime import datetime
                dt = datetime.fromisoformat(str(ts_val).replace('Z', '+00:00'))
                dt_ms = (time.time() - dt.timestamp()) * 1000.0
            rt_latency_ms.observe(max(0.0, dt_ms))
    except Exception:
        pass
    return ok


def realtime_loop():
    global realtime_connected
    backoff = 1.0
    while SUPABASE_REALTIME:
        try:
            logger.info("Conectando ao Supabase Realtime...")
            channel = supabase.channel('events-realtime')
            channel.on(
                'postgres_changes',
                { 'event': 'INSERT', 'schema': 'public', 'table': 'events' },
                lambda payload: handle_realtime_payload(payload)
            ).subscribe()
            realtime_connected = True
            backoff = 1.0
            # Loop de vigilância do estado
            while True:
                time.sleep(1)
                # opcional: checar conectividade com uma query leve
                # se algo levantar exceção, cairá no except e reconecta
        except Exception as e:
            realtime_connected = False
            reconnects_total.inc()
            jitter = random.uniform(0, 0.5)
            wait = min(60.0, backoff * 2 + jitter)
            logger.warning(f"Realtime desconectado, reconectando em {wait:.1f}s... ({e})")
            time.sleep(wait)
            backoff = wait


@app.on_event("startup")
def on_startup():
    if SUPABASE_REALTIME:
        t = threading.Thread(target=realtime_loop, daemon=True)
        t.start()
    else:
        init_last_event_id()
        t = threading.Thread(target=polling_loop, daemon=True)
        t.start()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "threshold": ENRICH_THRESHOLD,
        "k": K,
        "alpha": EMA_ALPHA,
        "last_event_id": last_event_id,
        "realtime": SUPABASE_REALTIME,
        "realtime_connected": realtime_connected,
    }


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/admin/people/{person_id}/faces", response_model=AdminListResponse, dependencies=[Depends(require_admin)])
def list_faces(person_id: str):
    res = supabase.table("people_faces").select("id, created_at").eq("person_id", person_id).order("created_at", desc=True).limit(K).execute()
    items = res.data or []
    return {"person_id": person_id, "total": len(items), "items": items}


@app.delete("/admin/people/{person_id}/faces/last", dependencies=[Depends(require_admin)])
def delete_last_face(person_id: str):
    res = supabase.table("people_faces").select("id, created_at").eq("person_id", person_id).order("created_at", desc=True).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Nada a remover")
    face_id = res.data[0]["id"]
    supabase.table("people_faces").delete().eq("id", face_id).execute()
    return {"deleted": face_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8086)
