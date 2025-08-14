#!/usr/bin/env python3
"""
Antitheft Service
- Recebe atualizações de tracking por câmera/track
- Aplica regras de antissefurto baseadas em zonas e permanência
- Registra sinais e incidentes no Supabase
- Exporta clipes (MP4 + JSON) para Storage em antitheft_clips/{incident_id}/
- Notifica via Notifier (mensagem + link do clip)
"""
import os
import time
import json
import math
import tempfile
import subprocess
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# Import resilient HTTP components
import sys
sys.path.append('/common_schemas')
from http_resilient import get_http_client, resilient_post_json, resilient_get_json
from correlation_logger import set_correlation_context, with_correlation, generate_correlation_id

# --- Config ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
NOTIFIER_URL = os.getenv("NOTIFIER_URL", "http://notifier:8085")
HLS_URL = os.getenv("HLS_URL", "http://mediamtx:8888/simulador/index.m3u8")
BUCKET_NAME = os.getenv("ANTITHEFT_BUCKET", "antitheft_clips")
EXPORT_DURATION = int(os.getenv("ANTITHEFT_EXPORT_DURATION", "10"))

# Regras (ENV)
SHELF_OUT_DELTA = float(os.getenv("SHELF_OUT_DELTA", "2"))
CONCEALMENT_DWELL_S = float(os.getenv("CONCEALMENT_DWELL_S", "2"))
EXIT_GRACE_MIN = float(os.getenv("EXIT_GRACE_MIN", "10"))
CART_PUSHOUT_DIFF = float(os.getenv("CART_PUSHOUT_DIFF", "3"))
HIGH_VALUE_DWELL_S = float(os.getenv("HIGH_VALUE_DWELL_S", "20"))

REQUEST_TIMEOUT = float(os.getenv("REQUEST_TIMEOUT", "0.5"))

# --- App ---
app = FastAPI(title="Antitheft Service", version="1.0.0")

# Initialize resilient HTTP client
http_client = get_http_client(service_name="antitheft")

# --- Métricas ---
track_updates_total = Counter('antitheft_track_updates_total', 'Total de atualizações de tracking recebidas')
incidents_total = Counter('antitheft_incidents_total', 'Total de incidentes gerados', ['rule', 'severity'])
export_latency_seconds = Histogram('antitheft_export_latency_seconds', 'Latência de exportação de clipe')

# --- Modelos ---
class TrackUpdate(BaseModel):
    camera_id: str
    track_id: int
    ts: float  # epoch seconds
    bbox: List[float]  # [x1,y1,x2,y2]
    movement_px: float = 0.0
    frames_confirmed: int = 0

class ExportIncidentRequest(BaseModel):
    incident_id: int
    duration_s: int = Field(default=EXPORT_DURATION, ge=3, le=60)

# --- Utilitários ---
def supabase_headers(ct: str = "application/json") -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}" if SUPABASE_SERVICE_ROLE_KEY else "",
        "Content-Type": ct,
    }

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def point_in_polygon(pt: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
    # Ray casting algorithm
    x, y = pt
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if ((y1 > y) != (y2 > y)):
            x_intersect = (x2 - x1) * (y - y1) / ((y2 - y1) or 1e-9) + x1
            if x < x_intersect:
                inside = not inside
    return inside

# --- Zonas ---
@dataclass
class Zone:
    id: str
    name: str
    ztype: str
    poly: List[Tuple[float, float]]

zone_cache: Dict[str, Tuple[float, List[Zone]]] = {}
ZONE_TTL = 10.0  # seconds

@with_correlation
async def fetch_zones(camera_id: str) -> List[Zone]:
    now = time.time()
    cached = zone_cache.get(camera_id)
    if cached and now - cached[0] < ZONE_TTL:
        return cached[1]
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return []
    
    try:
        # Use resilient HTTP client for Supabase API calls
        url = f"{SUPABASE_URL}/rest/v1/antitheft_zones?camera_id=eq.{camera_id}&select=zones"
        data = await resilient_get_json(
            url,
            service_name="antitheft",
            timeout=REQUEST_TIMEOUT,
            headers=supabase_headers()
        )
        
        zones_json = []
        if data and isinstance(data, list) and data:
            zones_json = data[0].get('zones') or []
            
        zones: List[Zone] = []
        for z in zones_json:
            points = z.get('points') or z.get('poly') or []
            poly = [(float(p['x']), float(p['y'])) for p in points if 'x' in p and 'y' in p]
            zones.append(Zone(
                id=str(z.get('id') or z.get('name') or f"z{len(zones)}"),
                name=str(z.get('name') or z.get('id') or 'zone'),
                ztype=str(z.get('type') or 'generic'),
                poly=poly
            ))
        zone_cache[camera_id] = (now, zones)
        return zones
    except Exception as e:
        print(f"Error fetching zones: {e}")
        return []

async def locate_zone(camera_id: str, cx: float, cy: float) -> Optional[Zone]:
    zones = await fetch_zones(camera_id)
    for z in zones:
        if len(z.poly) >= 3 and point_in_polygon((cx, cy), z.poly):
            return z
    return None

# --- Estado por trilha ---
@dataclass
class TrackState:
    last_zone_id: Optional[str] = None
    last_zone_enter_ts: Optional[float] = None
    path: List[Tuple[str, float]] = field(default_factory=list)  # (zone_id, ts)
    last_ts: float = 0.0

state: Dict[Tuple[str, int], TrackState] = {}

# --- Persistência Supabase ---
@with_correlation
async def insert_signal(camera_id: str, track_id: int, stype: str, meta: Dict[str, Any]):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/antitheft_signals"
        payload = [{
            "camera_id": camera_id,
            "track_id": track_id,
            "type": stype,
            "meta": meta,
            "ts": now_iso(),
        }]
        
        await resilient_post_json(
            url,
            json=payload,
            service_name="antitheft",
            timeout=REQUEST_TIMEOUT,
            headers=supabase_headers()
        )
    except Exception as e:
        print(f"Error inserting signal: {e}")

@with_correlation
async def insert_incident(camera_id: str, severity: str, meta: Dict[str, Any]) -> Optional[int]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    
    try:
        url = f"{SUPABASE_URL}/rest/v1/antitheft_incidents"
        payload = [{
            "camera_id": camera_id,
            "severity": severity,
            "meta": meta,
            "ts": now_iso(),
        }]
        
        data = await resilient_post_json(
            url,
            json=payload,
            service_name="antitheft",
            timeout=REQUEST_TIMEOUT,
            headers=supabase_headers()
        )
        
        if data and isinstance(data, list) and data and 'id' in data[0]:
            return int(data[0]['id'])
        return None
    except Exception as e:
        print(f"Error inserting incident: {e}")
        return None

# --- Exportação de clipe ---
def record_clip(hls_url: str, duration: int) -> Optional[bytes]:
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            out_path = tmp.name
        cmd = ['ffmpeg', '-y', '-i', hls_url, '-t', str(duration), '-c', 'copy', '-movflags', '+faststart', out_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=duration + 10)
        if result.returncode != 0:
            try: os.unlink(out_path)
            except Exception: pass
            return None
        with open(out_path, 'rb') as f:
            data = f.read()
        os.unlink(out_path)
        return data
    except Exception:
        return None

@with_correlation
async def upload_storage(path: str, content: bytes, content_type: str) -> Optional[str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    
    try:
        url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{path}?upsert=true"
        
        # Use resilient HTTP client for storage upload
        response = await http_client.post(
            url,
            content=content,
            headers=supabase_headers(content_type),
            timeout=15.0
        )
        
        if response.status_code not in (200, 201):
            return None
            
        # public bucket? event_clips is public in this project
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{path}"
        return public_url
    except Exception as e:
        print(f"Error uploading to storage: {e}")
        return None

# --- Notificações ---
@with_correlation
async def notify_event(camera_id: str, reason: str):
    try:
        payload = {
            "camera_id": camera_id,
            "reason": f"antitheft:{reason}",
            "ts": now_iso(),
        }
        
        await resilient_post_json(
            f"{NOTIFIER_URL}/notify_event",
            json=payload,
            service_name="antitheft",
            timeout=3.0
        )
    except Exception as e:
        print(f"Error notifying event: {e}")

@with_correlation
async def notify_clip(clip_url: str):
    try:
        await resilient_post_json(
            f"{NOTIFIER_URL}/notify_clip",
            json={"clip_url": clip_url},
            service_name="antitheft",
            timeout=3.0
        )
    except Exception as e:
        print(f"Error notifying clip: {e}")

# --- Engine de regras ---
def maybe_raise_incident(cam: str, trk: int, st: TrackState, now_ts: float, move_px: float) -> Optional[Tuple[str, str]]:
    # Retorna (rule, severity) se disparar
    # 1) Concealment dwell
    if st.last_zone_id and st.last_zone_enter_ts:
        if st.last_zone_id.startswith('conceal') or st.last_zone_id == 'concealment':
            dwell = now_ts - st.last_zone_enter_ts
            if dwell >= CONCEALMENT_DWELL_S:
                return ("concealment_dwell", "HIGH")
    # 2) High value dwell then exit
    # Verifica se passou por zona high_value e saiu para zona de tipo 'exit' em até EXIT_GRACE_MIN
    last_types = [z for z, _ in st.path[-5:]]  # últimos nós (zone_id)
    # Simplificação: se trilha contém 'high_value' e último é 'exit'
    if any('high' in z for z in last_types) and (st.last_zone_id and 'exit' in st.last_zone_id):
        # Procura enter ts de high_value mais recente
        t_enter_high = None
        for zid, ts0 in reversed(st.path):
            if 'high' in zid:
                t_enter_high = ts0
                break
        if t_enter_high and now_ts - t_enter_high >= HIGH_VALUE_DWELL_S and (now_ts - t_enter_high) <= (EXIT_GRACE_MIN * 60):
            return ("high_value_to_exit", "HIGH")
    # 3) Shelf out -> baixa severidade
    if any('shelf' in z for z, _ in st.path[-4:]) and (st.last_zone_id and 'shelf' not in st.last_zone_id):
        return ("shelf_out", "LOW")
    # 4) Cart pushout próximo de saída (heurística por movimento)
    if st.last_zone_id and 'exit' in st.last_zone_id and move_px >= CART_PUSHOUT_DIFF:
        return ("cart_pushout", "HIGH")
    return None

# --- Endpoints ---
@app.post('/track_update')
async def track_update(req: TrackUpdate):
    # Set up correlation context
    correlation_id = generate_correlation_id()
    set_correlation_context(
        correlation_id=correlation_id,
        service_name="antitheft",
        camera_id=req.camera_id
    )
    
    track_updates_total.inc()
    cam = req.camera_id
    key = (cam, req.track_id)
    cx = (req.bbox[0] + req.bbox[2]) / 2.0
    cy = (req.bbox[1] + req.bbox[3]) / 2.0
    z = await locate_zone(cam, cx, cy)
    zid = z.id if z else None

    st = state.get(key)
    if not st:
        st = TrackState()
        state[key] = st
    st.last_ts = req.ts

    # Transições de zona
    if zid != st.last_zone_id:
        # Atualiza entrada
        st.last_zone_id = zid
        st.last_zone_enter_ts = req.ts if zid else None
        if zid:
            st.path.append((zid, req.ts))
        await insert_signal(cam, req.track_id, "zone_transition", {"zone_id": zid, "cx": cx, "cy": cy})

    # Checar regras
    fired = maybe_raise_incident(cam, req.track_id, st, req.ts, req.movement_px)
    if fired:
        rule, severity = fired
        incidents_total.labels(rule=rule, severity=severity).inc()
        meta = {
            "rule": rule,
            "track_id": req.track_id,
            "zone_id": st.last_zone_id,
            "frames_confirmed": req.frames_confirmed,
            "movement_px": req.movement_px,
            "ts": datetime.fromtimestamp(req.ts, tz=timezone.utc).isoformat(),
        }
        inc_id = await insert_incident(cam, severity, meta)
        if inc_id is not None:
            # Exporta clipe e notifica
            clip_url = None
            with export_latency_seconds.time():
                clip = record_clip(HLS_URL, EXPORT_DURATION)
                if clip:
                    path = f"{inc_id}/video.mp4"
                    clip_url = await upload_storage(path, clip, "video/mp4")
                    # Upload JSON de rótulos/meta
                    label_json = json.dumps(meta, ensure_ascii=False).encode()
                    await upload_storage(f"{inc_id}/labels.json", label_json, "application/json")
            await notify_event(cam, rule)
            if clip_url:
                await notify_clip(clip_url)
        return {"ok": True, "incident_id": inc_id, "rule": rule, "severity": severity}
    return {"ok": True}

@app.post('/export_incident')
async def export_incident(req: ExportIncidentRequest):
    with export_latency_seconds.time():
        clip = record_clip(HLS_URL, req.duration_s)
        if not clip:
            raise HTTPException(status_code=500, detail="record failed")
        path = f"{req.incident_id}/video.mp4"
        clip_url = await upload_storage(path, clip, "video/mp4")
        if not clip_url:
            raise HTTPException(status_code=500, detail="upload failed")
        await notify_clip(clip_url)
        return {"ok": True, "incident_id": req.incident_id, "clip_url": clip_url}

@app.get('/health')
async def health():
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return {
        "status": "ok", 
        "hls_url": HLS_URL, 
        "bucket": BUCKET_NAME,
        "circuit_breakers": circuit_stats
    }

@app.get('/metrics')
def metrics():
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if hasattr(http_client, 'aclose'):
        await http_client.aclose()

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8088)