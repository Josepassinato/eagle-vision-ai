#!/usr/bin/env bash
set -euo pipefail

ART_DIR=/tmp/e2e-artifacts
START_TS=$(date +%s)
mkdir -p "$ART_DIR"

log() { echo "[e2e] $*" | tee -a "$ART_DIR/e2e.log"; }

# Compose files
COMPOSE_FILES=( -f docker-compose.yml -f docker-compose.e2e.yml )

# Bring up minimal stack
log "Starting services: mediamtx, camera-sim, notifier"
docker compose "${COMPOSE_FILES[@]}" up -d --build mediamtx camera-sim notifier

# Wait for MediaMTX HLS
HLS_URL="http://localhost:8888/simulador/index.m3u8"
log "Waiting for HLS at $HLS_URL ..."
for i in {1..60}; do
  if curl -fsS "$HLS_URL" >/dev/null; then
    log "HLS is up (attempt $i)"
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    log "HLS did not become available in time"
    docker compose "${COMPOSE_FILES[@]}" logs mediamtx | tail -n 200 > "$ART_DIR/mediamtx.log" || true
    exit 1
  fi
done

# Record a short clip via ffmpeg (10s)
CLIP_PATH="$ART_DIR/clip.mp4"
log "Recording 10s clip to $CLIP_PATH"
if ! ffmpeg -y -i "$HLS_URL" -t 10 -c copy -movflags +faststart "$CLIP_PATH" -loglevel error; then
  log "ffmpeg recording failed"
  exit 1
fi

# Probe clip duration
DUR=$(ffprobe -v error -select_streams v:0 -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$CLIP_PATH" || echo 0)
log "Clip duration: $DUR s"

# Notifier health
log "Checking notifier health"
HEALTH_JSON=$(curl -fsS http://localhost:8085/health || true)
echo "$HEALTH_JSON" > "$ART_DIR/notifier-health.json"

# Send synthetic event to notifier (accept non-200 as long as it responds)
log "Triggering synthetic notification"
REQ='{
  "camera_id": "cam-sim",
  "person_id": null,
  "person_name": "E2E Test",
  "reason": "face",
  "face_similarity": 0.91,
  "reid_similarity": null,
  "frames_confirmed": 20,
  "movement_px": 6.5,
  "ts": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
  "jpg_b64": null
}'

RESP_CODE=0
RESP_BODY=""
START_ALERT=$(date +%s%3N)
RESP_BODY=$(curl -sS -w "%{http_code}" -o "$ART_DIR/notifier-response.json.tmp" -H 'Content-Type: application/json' -X POST http://localhost:8085/notify_event -d "$REQ" || true)
END_ALERT=$(date +%s%3N)
ALERT_LAT_MS=$((END_ALERT-START_ALERT))
ALERT_CODE=${RESP_BODY: -3}
mv "$ART_DIR/notifier-response.json.tmp" "$ART_DIR/notifier-response.json" || true
log "Notifier returned HTTP $ALERT_CODE in ${ALERT_LAT_MS}ms"

docker compose "${COMPOSE_FILES[@]}" logs mediamtx | tail -n 300 > "$ART_DIR/mediamtx.log" || true
docker compose "${COMPOSE_FILES[@]}" logs camera-sim | tail -n 300 > "$ART_DIR/camera-sim.log" || true
docker compose "${COMPOSE_FILES[@]}" logs notifier | tail -n 300 > "$ART_DIR/notifier.log" || true

# Simple assertions
PASS=true
if [[ ! -s "$CLIP_PATH" ]]; then
  log "Clip not recorded"
  PASS=false
fi
if awk "BEGIN{exit !($DUR>=8)}"; then
  :
else
  log "Clip duration too short: $DUR"
  PASS=false
fi

TOTAL_SEC=$(( $(date +%s) - START_TS ))

if [[ "$PASS" == true ]]; then
  echo "PASS | total=${TOTAL_SEC}s | alert_code=${ALERT_CODE} | clip=${CLIP_PATH}" | tee "$ART_DIR/RESULT.txt"
  exit 0
else
  echo "FAIL | total=${TOTAL_SEC}s | alert_code=${ALERT_CODE} | clip=${CLIP_PATH}" | tee "$ART_DIR/RESULT.txt"
  exit 1
fi
