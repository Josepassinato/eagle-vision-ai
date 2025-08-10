#!/usr/bin/env python3
"""
Media Cleaner Service
- Retenção automática para buckets: evidence, event_clips
- Remove arquivos mais antigos que MEDIA_RETENTION_DAYS
- Remove órfãos (event_clips/{event_id}.mp4 sem evento correspondente)
- Exibe métricas Prometheus e logs (sem conteúdo sensível)
"""
import os
import re
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import requests
from dateutil import parser as dateparser
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
RETENTION_DAYS = int(os.getenv("MEDIA_RETENTION_DAYS", "90"))
BUCKETS = [b.strip() for b in os.getenv("MEDIA_BUCKETS", "evidence,event_clips").split(",") if b.strip()]
INTERVAL = int(os.getenv("CLEANUP_INTERVAL_SECONDS", str(24*3600)))

app = FastAPI(title="Media Cleaner")

media_cleanup_deleted_total = Counter('media_cleanup_deleted_total', 'Total media objects deleted', ['bucket', 'reason'])
media_cleanup_errors_total = Counter('media_cleanup_errors_total', 'Total media cleanup errors', ['bucket', 'operation'])
media_cleanup_last_run_ts = Gauge('media_cleanup_last_run_ts', 'Last cleanup run timestamp (epoch)')
media_cleanup_duration_seconds = Histogram('media_cleanup_duration_seconds', 'Cleanup duration in seconds')

class RunRequest(BaseModel):
    dry_run: bool = False


def _headers_json() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def _headers_octet() -> Dict[str, str]:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/octet-stream",
    }


def list_objects(bucket: str, prefix: str = "") -> List[dict]:
    url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket}"
    result: List[dict] = []
    offset = 0
    page = 1000
    while True:
        body = {"limit": page, "offset": offset, "sortBy": {"column": "name", "order": "asc"}, "prefix": prefix}
        try:
            r = requests.post(url, headers=_headers_json(), data=json.dumps(body), timeout=30)
            if r.status_code != 200:
                media_cleanup_errors_total.labels(bucket=bucket, operation='list').inc()
                print(f"[media-cleaner] list_objects {bucket} error {r.status_code}: {r.text[:200]}")
                break
            data = r.json() or []
            result.extend(data)
            if len(data) < page:
                break
            offset += page
        except Exception as e:
            media_cleanup_errors_total.labels(bucket=bucket, operation='list').inc()
            print(f"[media-cleaner] list_objects {bucket} exception: {e}")
            break
    return result


def delete_object(bucket: str, name: str, dry_run: bool) -> bool:
    if dry_run:
        print(f"[media-cleaner] DRY-RUN delete {bucket}/{name}")
        return True
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{name}"
    try:
        r = requests.delete(url, headers=_headers_octet(), timeout=30)
        if r.status_code in (200, 204):
            return True
        else:
            print(f"[media-cleaner] delete {bucket}/{name} -> {r.status_code}: {r.text[:200]}")
            media_cleanup_errors_total.labels(bucket=bucket, operation='delete').inc()
            return False
    except Exception as e:
        print(f"[media-cleaner] delete exception {bucket}/{name}: {e}")
        media_cleanup_errors_total.labels(bucket=bucket, operation='delete').inc()
        return False


def get_event_exists(event_id: int) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/events?id=eq.{event_id}&select=id"
    try:
        r = requests.get(url, headers=_headers_json(), timeout=15)
        if r.status_code != 200:
            print(f"[media-cleaner] get_event_exists({event_id}) -> {r.status_code}: {r.text[:120]}")
            return False
        arr = r.json() or []
        return len(arr) > 0
    except Exception as e:
        print(f"[media-cleaner] get_event_exists exception: {e}")
        return False


def parse_time(obj: dict) -> Optional[datetime]:
    for key in ("updated_at", "created_at", "last_accessed_at", "metadata" ):
        val = obj.get(key)
        if not val:
            continue
        try:
            if isinstance(val, str):
                return dateparser.parse(val)
        except Exception:
            continue
    return None


def should_delete_by_age(obj: dict, now: datetime) -> bool:
    ts = parse_time(obj)
    if not ts:
        return False
    return (now - ts) > timedelta(days=RETENTION_DAYS)


def cleanup_bucket(bucket: str, dry_run: bool = False) -> Dict[str, int]:
    now = datetime.now(timezone.utc)
    objects = list_objects(bucket)
    deleted_age = 0
    deleted_orphan = 0

    for obj in objects:
        name = obj.get("name") or ""
        # 1) Age-based deletion
        if should_delete_by_age(obj, now):
            if delete_object(bucket, name, dry_run):
                deleted_age += 1
                media_cleanup_deleted_total.labels(bucket=bucket, reason='age').inc()
                print(f"[media-cleaner] deleted by age: {bucket}/{name}")
            continue

        # 2) Orphan deletion (event_clips only: <event_id>.mp4)
        if bucket == 'event_clips':
            m = re.match(r"^(\d+)\.(mp4|mov|mkv|ts)$", name, re.IGNORECASE)
            if m:
                eid = int(m.group(1))
                if not get_event_exists(eid):
                    if delete_object(bucket, name, dry_run):
                        deleted_orphan += 1
                        media_cleanup_deleted_total.labels(bucket=bucket, reason='orphan').inc()
                        print(f"[media-cleaner] deleted orphan: {bucket}/{name}")

    return {"deleted_age": deleted_age, "deleted_orphan": deleted_orphan, "scanned": len(objects)}


@app.post("/run")
def run_cleanup(req: RunRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Missing Supabase configuration")
    with media_cleanup_duration_seconds.time():
        media_cleanup_last_run_ts.set(time.time())
        results = {}
        for bucket in BUCKETS:
            results[bucket] = cleanup_bucket(bucket, dry_run=req.dry_run)
        return {"ok": True, "retention_days": RETENTION_DAYS, "results": results}


@app.get("/health")
def health():
    return {"status": "ok", "retention_days": RETENTION_DAYS, "buckets": BUCKETS}


@app.get("/metrics")
def metrics():
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    import uvicorn
    # Background loop via uvicorn is fine; external orchestrator can also call /run
    uvicorn.run("main:app", host="0.0.0.0", port=8097)
