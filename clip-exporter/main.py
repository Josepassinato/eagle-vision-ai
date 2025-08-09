#!/usr/bin/env python3
"""
Clip Exporter Service
- Recebe event_id
- Busca evento no Supabase (camera_id, ts)
- Captura ~10s do stream HLS e gera MP4
- Faz upload para bucket 'event_clips' no Supabase Storage
- Opcional: notifica via Notifier com link público do clip
"""
import os
import logging
import tempfile
import subprocess
from typing import Optional, Dict, Any

import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("clip_exporter")

# Env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
NOTIFIER_URL = os.getenv("NOTIFIER_URL", "http://notifier:8085")
HLS_URL = os.getenv("HLS_URL", "http://mediamtx:8888/simulador/index.m3u8")
DURATION_SECONDS = int(os.getenv("DURATION_SECONDS", "10"))

# Metrics
export_requests_total = Counter('clip_export_requests_total', 'Total clip export requests', ['status'])
export_latency_seconds = Histogram('clip_export_latency_seconds', 'Latency of clip export')

app = FastAPI(title="Clip Exporter")

class ExportClipRequest(BaseModel):
    event_id: int

class ExportClipResponse(BaseModel):
    ok: bool
    event_id: int
    clip_url: Optional[str] = None
    message: Optional[str] = None


def supabase_headers() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY or "",
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}" if SUPABASE_SERVICE_ROLE_KEY else "",
        "Content-Type": "application/json",
    }


def get_event(event_id: int) -> Optional[Dict[str, Any]]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Supabase configuration missing")
        return None
    url = f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&select=*"
    try:
        resp = requests.get(url, headers=supabase_headers(), timeout=5)
        if resp.status_code != 200:
            logger.error("get_event error %s: %s", resp.status_code, resp.text)
            return None
        data = resp.json()
        return data[0] if data else None
    except Exception as e:
        logger.error("get_event exception: %s", e)
        return None


def record_clip(hls_url: str, duration: int) -> Optional[bytes]:
    """Record a short MP4 from HLS using ffmpeg (no past buffer)."""
    try:
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp:
            out_path = tmp.name
        cmd = [
            'ffmpeg', '-y', '-i', hls_url,
            '-t', str(duration),
            '-c', 'copy',
            '-movflags', '+faststart',
            out_path
        ]
        logger.info("Running ffmpeg to capture %ss from %s", duration, hls_url)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=duration + 10)
        if result.returncode != 0:
            logger.error("ffmpeg failed: %s", result.stderr)
            try:
                os.unlink(out_path)
            except Exception:
                pass
            return None
        with open(out_path, 'rb') as f:
            data = f.read()
        os.unlink(out_path)
        return data
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timeout")
        return None
    except Exception as e:
        logger.error("record_clip exception: %s", e)
        return None


def upload_clip(event_id: int, clip_bytes: bytes) -> Optional[str]:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        logger.error("Supabase configuration missing for upload")
        return None
    object_path = f"{event_id}.mp4"
    url = f"{SUPABASE_URL}/storage/v1/object/event_clips/{object_path}?upsert=true"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "video/mp4",
    }
    try:
        resp = requests.post(url, headers=headers, data=clip_bytes, timeout=20)
        if resp.status_code not in (200, 201):
            logger.error("upload_clip failed %s: %s", resp.status_code, resp.text)
            return None
        # Public bucket => public URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/event_clips/{object_path}"
        return public_url
    except Exception as e:
        logger.error("upload_clip exception: %s", e)
        return None


def notify_clip(event: Dict[str, Any], clip_url: str) -> None:
    try:
        payload = {
            "camera_id": event.get("camera_id"),
            "reason": event.get("reason", "clip"),
            "ts": event.get("ts"),
            "clip_url": clip_url,
        }
        r = requests.post(f"{NOTIFIER_URL}/notify_clip", json=payload, timeout=5)
        if r.status_code == 200:
            logger.info("Notifier acknowledged clip link")
        else:
            logger.warning("Notifier error %s: %s", r.status_code, r.text)
    except Exception as e:
        logger.warning("notify_clip exception: %s", e)


@app.post('/export_clip', response_model=ExportClipResponse)
def export_clip(req: ExportClipRequest):
    with export_latency_seconds.time():
        try:
            event = get_event(req.event_id)
            if not event:
                export_requests_total.labels(status="not_found").inc()
                raise HTTPException(status_code=404, detail="event not found")

            clip = record_clip(HLS_URL, DURATION_SECONDS)
            if not clip:
                export_requests_total.labels(status="record_fail").inc()
                raise HTTPException(status_code=500, detail="record failed")

            clip_url = upload_clip(req.event_id, clip)
            if not clip_url:
                export_requests_total.labels(status="upload_fail").inc()
                raise HTTPException(status_code=500, detail="upload failed")

            export_requests_total.labels(status="ok").inc()

            # Fire-and-forget notifier
            notify_clip(event, clip_url)

            return ExportClipResponse(ok=True, event_id=req.event_id, clip_url=clip_url)
        except HTTPException:
            raise
        except Exception as e:
            export_requests_total.labels(status="error").inc()
            logger.error("export_clip exception: %s", e)
            raise HTTPException(status_code=500, detail=str(e))

@app.get('/health')
def health():
    return {"status": "ok", "hls_url": HLS_URL, "duration": DURATION_SECONDS}

@app.get('/metrics')
def metrics():
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8095)
