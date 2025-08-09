#!/usr/bin/env python3
import os
import time
import json
import gzip
import shutil
import subprocess
from datetime import datetime, timezone
from typing import List

import requests

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKETS = [b.strip() for b in os.getenv("BUCKETS", "people,vehicles,evidence,event_clips").split(",") if b.strip()]
BACKUP_DIR = os.getenv("BACKUP_DIR", "/backups")
INTERVAL = int(os.getenv("BACKUP_INTERVAL_SECONDS", "86400"))

os.makedirs(BACKUP_DIR, exist_ok=True)


def timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def backup_db():
    if not SUPABASE_DB_URL:
        print("[backup] SUPABASE_DB_URL not set, skipping DB backup")
        return
    out_dir = os.path.join(BACKUP_DIR, "db")
    os.makedirs(out_dir, exist_ok=True)
    out_sql = os.path.join(out_dir, f"db-{timestamp()}.sql")
    out_gz = f"{out_sql}.gz"
    print(f"[backup] Running pg_dump to {out_gz}")
    # Use env var PGPASSWORD embedded in URL, so pg_dump can read it
    try:
        # Direct pg_dump URL support via --dbname
        result = subprocess.run(["pg_dump", "--no-owner", "--format=plain", f"--dbname={SUPABASE_DB_URL}"], capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            print("[backup] pg_dump failed:", result.stderr[:500])
            return
        with open(out_sql, "w", encoding="utf-8") as f:
            f.write(result.stdout)
        with open(out_sql, "rb") as f_in, gzip.open(out_gz, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)
        os.remove(out_sql)
        print("[backup] DB backup complete")
    except Exception as e:
        print("[backup] pg_dump exception:", e)


def storage_headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
    }


def list_objects(bucket: str, prefix: str = "") -> List[dict]:
    url = f"{SUPABASE_URL}/storage/v1/object/list/{bucket}"
    out: List[dict] = []
    offset = 0
    page = 1000
    while True:
        body = {"limit": page, "offset": offset, "sortBy": {"column": "name", "order": "asc"}, "prefix": prefix}
        try:
            resp = requests.post(url, headers=storage_headers(), data=json.dumps(body), timeout=30)
            if resp.status_code != 200:
                print(f"[backup] list_objects {bucket} {resp.status_code}: {resp.text[:200]}")
                break
            data = resp.json() or []
            out.extend(data)
            if len(data) < page:
                break
            offset += page
        except Exception as e:
            print("[backup] list_objects exception:", e)
            break
    return out


def download_object(bucket: str, name: str, out_path: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{name}"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with requests.get(url, headers=storage_headers(), stream=True, timeout=120) as r:
        if r.status_code != 200:
            print(f"[backup] download {bucket}/{name} -> {r.status_code}")
            return
        with open(out_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):  # 1MB
                if chunk:
                    f.write(chunk)


def backup_buckets():
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("[backup] storage config missing, skipping storage backup")
        return
    base = os.path.join(BACKUP_DIR, "storage")
    for bucket in BUCKETS:
        try:
            items = list_objects(bucket)
            print(f"[backup] {bucket}: {len(items)} objects")
            for obj in items:
                name = obj.get("name")
                if not name:
                    continue
                out_path = os.path.join(base, bucket, name)
                download_object(bucket, name, out_path)
        except Exception as e:
            print(f"[backup] bucket {bucket} exception:", e)


def run_once():
    print("[backup] starting one-shot backup...")
    backup_db()
    backup_buckets()
    print("[backup] completed")


if __name__ == "__main__":
    # First run immediately, then sleep
    while True:
        run_once()
        try:
            time.sleep(INTERVAL)
        except KeyboardInterrupt:
            break
