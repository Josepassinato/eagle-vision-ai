#!/usr/bin/env bash
set -euo pipefail

# Fetch and version models for YOLO, ReID (OSNet) and InsightFace (optional)
# - Computes and stores SHA256 in sidecar .sha256 files
# - Creates stable symlinks expected by services
# - Supports rollback by selecting a version tag via USE_TAG env
#
# Usage:
#   tools/fetch_models.sh                         # download defaults and mark as current
#   tools/fetch_models.sh yolo=URL                # override YOLO url
#   tools/fetch_models.sh osnet=URL               # override OSNet url
#   tools/fetch_models.sh face=URL                # optional InsightFace model pack url (see notes)
#   MODEL_TAG=mytag tools/fetch_models.sh         # mark downloaded files with custom tag
#   USE_TAG=mytag tools/fetch_models.sh --switch  # switch symlinks to existing version (no download)
#
# Notes:
# - YOLO expected link: yolo-detection/models/yolov8x.pt -> yolov8x-<tag>-<sha8>.pt
# - OSNet expected link: reid-service/models/osnet_x0_75.onnx -> osnet_x0_75-<tag>-<sha8>.onnx
# - InsightFace: the container can auto-download; prefetch is optional and implementation-specific.

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
YOLO_DIR="$ROOT_DIR/yolo-detection/models"
REID_DIR="$ROOT_DIR/reid-service/models"
FACE_DIR="$ROOT_DIR/face-service/models"
VERSIONS_FILE="$ROOT_DIR/models/VERSIONS.txt"

mkdir -p "$YOLO_DIR" "$REID_DIR" "$FACE_DIR" "${VERSIONS_FILE%/*}"

# Defaults (can be overridden by args)
YOLO_URL_DEFAULT="https://github.com/ultralytics/assets/releases/download/v8.1.0/yolov8x.pt"
OSNET_URL_DEFAULT="https://github.com/KaiyangZhou/deep-person-reid/releases/download/osnet/osnet_x0_75_msmt17.onnx"
FACE_URL_DEFAULT="" # optional

YOLO_URL="$YOLO_URL_DEFAULT"
OSNET_URL="$OSNET_URL_DEFAULT"
FACE_URL="$FACE_URL_DEFAULT"
MODEL_TAG="${MODEL_TAG:-$(date +%Y%m%d)}"
USE_TAG="${USE_TAG:-}"
SWITCH_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --switch) SWITCH_ONLY=true ;;
    yolo=*) YOLO_URL="${arg#*=}" ;;
    osnet=*) OSNET_URL="${arg#*=}" ;;
    face=*) FACE_URL="${arg#*=}" ;;
    *) echo "Unknown arg: $arg" ;;
  esac
done

sha256sum_cmd() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi
}

# Switch helper: update symlink to a version by tag
switch_to_tag() {
  local dir="$1"; shift
  local base="$1"; shift
  local ext="$1"; shift
  local link="$dir/${base}.${ext}"
  local candidate
  candidate="$(ls -1 "$dir"/${base}-${USE_TAG}-*.${ext} 2>/dev/null | head -n1 || true)"
  if [[ -z "$candidate" ]]; then
    echo "No version found for ${base} tag=$USE_TAG in $dir" >&2
    return 1
  fi
  ln -sf "$(basename "$candidate")" "$link"
  echo "Switched ${base}.${ext} -> $(basename "$candidate")"
}

if [[ -n "$USE_TAG" && "$SWITCH_ONLY" == true ]]; then
  switch_to_tag "$YOLO_DIR" "yolov8x" "pt"
  switch_to_tag "$REID_DIR" "osnet_x0_75" "onnx"
  echo "Symlinks switched to tag=$USE_TAG"
  exit 0
fi

# Download function
# $1 url, $2 out_dir, $3 base_name, $4 ext
fetch_model() {
  local url="$1"; shift
  local out_dir="$1"; shift
  local base="$1"; shift
  local ext="$1"; shift

  mkdir -p "$out_dir"
  local tmp="$(mktemp)"
  echo "Downloading $base from $url ..."
  curl -L --fail --retry 3 --retry-delay 2 -o "$tmp" "$url"

  local sum
  sum="$(sha256sum_cmd "$tmp" | awk '{print $1}')"
  local short="${sum:0:8}"
  local versioned="$out_dir/${base}-${MODEL_TAG}-${short}.${ext}"
  mv "$tmp" "$versioned"
  echo "$sum  ${base}-${MODEL_TAG}-${short}.${ext}" > "$versioned.sha256"
  echo "Saved: $versioned"

  # Update stable symlink expected by services
  local link_target="$out_dir/${base}.${ext}"
  ln -sf "$(basename "$versioned")" "$link_target"

  # Record version
  echo "$(date -Is)  ${base}  tag=${MODEL_TAG}  sha256=${sum}  file=$(basename "$versioned")  url=$url" >> "$VERSIONS_FILE"
}

# YOLO
fetch_model "$YOLO_URL" "$YOLO_DIR" "yolov8x" "pt"

# OSNet
fetch_model "$OSNET_URL" "$REID_DIR" "osnet_x0_75" "onnx"

# InsightFace (optional): if URL provided, just place file in FACE_DIR and record.
if [[ -n "$FACE_URL" ]]; then
  # Try to infer filename
  fname="$(basename "$FACE_URL" | sed 's/[?].*$//')"
  [[ -z "$fname" || "$fname" == "/" ]] && fname="insightface-pack.zip"
  echo "Downloading InsightFace pack (optional) from $FACE_URL ..."
  curl -L --fail --retry 3 --retry-delay 2 -o "$FACE_DIR/$fname" "$FACE_URL"
  sum="$(sha256sum_cmd "$FACE_DIR/$fname" | awk '{print $1}')"
  echo "$sum  $fname" > "$FACE_DIR/$fname.sha256"
  echo "$(date -Is)  insightface  tag=${MODEL_TAG}  sha256=${sum}  file=$fname  url=$FACE_URL" >> "$VERSIONS_FILE"
fi

echo "\nAll models fetched. Versions recorded at $VERSIONS_FILE"
