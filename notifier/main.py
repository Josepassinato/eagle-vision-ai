import asyncio
import base64
import json
import logging
import time
from datetime import datetime, timedelta
from io import BytesIO
from typing import Dict, List, Optional
import os
import subprocess
import tempfile

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Visão de Águia - Notifier")

# Enable CORS for browser-based testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
STREAM_SNAPSHOT_URL = os.getenv("STREAM_SNAPSHOT_URL", "http://mediamtx:8888/simulador/index.m3u8")
NOTIFIER_TIMEOUT_MS = int(os.getenv("NOTIFIER_TIMEOUT_MS", "3000"))
TELEGRAM_PARSE_MODE = os.getenv("TELEGRAM_PARSE_MODE", "HTML")

# Rate limiting: max 10 messages per minute per camera
RATE_LIMIT_PER_CAMERA = 10
RATE_LIMIT_WINDOW = 60  # seconds
rate_limit_tracker: Dict[str, List[float]] = {}

class NotifyEventRequest(BaseModel):
    camera_id: str
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    reason: str  # "face" or "reid+motion"
    face_similarity: Optional[float] = None
    reid_similarity: Optional[float] = None
    frames_confirmed: Optional[int] = None
    movement_px: Optional[float] = None
    ts: str
    jpg_b64: Optional[str] = None

def fetch_chat_ids_from_updates() -> List[str]:
    """Fetch chat IDs from Telegram getUpdates when TELEGRAM_CHAT_ID=auto"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        return []
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    try:
        resp = requests.get(base_url, timeout=NOTIFIER_TIMEOUT_MS/1000)
        if resp.status_code != 200:
            logger.error(f"getUpdates error {resp.status_code}: {resp.text}")
            return []
        data = resp.json()
        chat_ids = set()
        for update in data.get("result", []):
            # Consider multiple update types that carry a chat object
            for key in ("message", "edited_message", "channel_post", "edited_channel_post", "my_chat_member"):
                if key in update:
                    node = update[key]
                    chat = node.get("chat") if isinstance(node, dict) else None
                    if not chat and key == "my_chat_member":
                        chat = node.get("chat", {})
                    if chat and isinstance(chat, dict) and "id" in chat:
                        chat_ids.add(str(chat["id"]))
        discovered = list(chat_ids)
        logger.info(f"Discovered chat IDs via getUpdates: {discovered}")
        return discovered
    except Exception as e:
        logger.error(f"Failed to fetch chat IDs: {e}")
        return []


def parse_chat_ids() -> List[str]:
    """Parse TELEGRAM_CHAT_ID env; support 'auto' discovery via getUpdates"""
    cid = TELEGRAM_CHAT_ID.strip() if TELEGRAM_CHAT_ID else ""
    if not cid:
        return []
    if cid.lower() == "auto":
        return fetch_chat_ids_from_updates()
    return [chat_id.strip() for chat_id in cid.split(",") if chat_id.strip()]
def check_rate_limit(camera_id: str) -> bool:
    """Check if camera_id is within rate limit"""
    now = time.time()
    
    if camera_id not in rate_limit_tracker:
        rate_limit_tracker[camera_id] = []
    
    # Clean old entries
    rate_limit_tracker[camera_id] = [
        timestamp for timestamp in rate_limit_tracker[camera_id]
        if now - timestamp < RATE_LIMIT_WINDOW
    ]
    
    # Check limit
    if len(rate_limit_tracker[camera_id]) >= RATE_LIMIT_PER_CAMERA:
        return False
    
    # Add current timestamp
    rate_limit_tracker[camera_id].append(now)
    return True

def capture_snapshot_with_ffmpeg() -> Optional[bytes]:
    """Capture a single frame from HLS stream using ffmpeg"""
    try:
        logger.info(f"Capturing snapshot from {STREAM_SNAPSHOT_URL}")
        
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Use ffmpeg to capture one frame
        cmd = [
            'ffmpeg',
            '-i', STREAM_SNAPSHOT_URL,
            '-vframes', '1',
            '-q:v', '2',
            '-y',  # overwrite output file
            temp_path
        ]
        
        # Set timeout
        timeout_seconds = NOTIFIER_TIMEOUT_MS / 1000
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )
        
        if result.returncode == 0:
            with open(temp_path, 'rb') as f:
                image_data = f.read()
            os.unlink(temp_path)
            logger.info("Successfully captured snapshot")
            return image_data
        else:
            logger.error(f"ffmpeg failed: {result.stderr}")
            os.unlink(temp_path)
            return None
            
    except subprocess.TimeoutExpired:
        logger.error("ffmpeg timeout expired")
        return None
    except Exception as e:
        logger.error(f"Error capturing snapshot: {e}")
        return None

def format_notification_text(event: NotifyEventRequest) -> str:
    """Format notification text for Telegram"""
    person_info = event.person_name or event.person_id or "desconhecida"
    
    # Parse timestamp
    try:
        dt = datetime.fromisoformat(event.ts.replace('Z', '+00:00'))
        time_str = dt.strftime('%H:%M:%S')
    except:
        time_str = event.ts
    
    face_sim = f"{event.face_similarity:.2f}" if event.face_similarity else "N/A"
    reid_sim = f"{event.reid_similarity:.2f}" if event.reid_similarity else "N/A"
    frames = event.frames_confirmed or 0
    movement = f"{event.movement_px:.1f}" if event.movement_px else "N/A"
    
    if TELEGRAM_PARSE_MODE == "HTML":
        text = f"""<b>[Visão de Águia]</b>
<b>Câmera:</b> {event.camera_id} | {time_str}
<b>Motivo:</b> {event.reason}
<b>Face:</b> {face_sim} | <b>ReID:</b> {reid_sim}
<b>Pessoa:</b> {person_info}
<b>Frames:</b> {frames} | <b>Move:</b> {movement}px"""
    else:
        text = f"""[Visão de Águia]
Câmera: {event.camera_id} | {time_str}
Motivo: {event.reason}
Face: {face_sim} | ReID: {reid_sim}
Pessoa: {person_info}
Frames: {frames} | Move: {movement}px"""
    
    return text

def send_telegram_message(chat_id: str, text: str, image_data: Optional[bytes] = None, retries: int = 1) -> bool:
    """Send message to Telegram with optional image"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        return False
    
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
    
    for attempt in range(retries + 1):
        try:
            if image_data:
                # Send photo with caption
                url = f"{base_url}/sendPhoto"
                files = {
                    'photo': ('snapshot.jpg', BytesIO(image_data), 'image/jpeg')
                }
                data = {
                    'chat_id': chat_id,
                    'caption': text,
                    'parse_mode': TELEGRAM_PARSE_MODE
                }
                response = requests.post(url, files=files, data=data, timeout=NOTIFIER_TIMEOUT_MS/1000)
            else:
                # Send text only
                url = f"{base_url}/sendMessage"
                data = {
                    'chat_id': chat_id,
                    'text': text,
                    'parse_mode': TELEGRAM_PARSE_MODE
                }
                response = requests.post(url, json=data, timeout=NOTIFIER_TIMEOUT_MS/1000)
            
            if response.status_code == 200:
                logger.info(f"Message sent successfully to chat {chat_id}")
                return True
            elif response.status_code >= 500 and attempt < retries:
                logger.warning(f"Server error {response.status_code}, retrying... (attempt {attempt + 1})")
                time.sleep(0.5)
                continue
            else:
                logger.error(f"Telegram API error {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.Timeout:
            logger.error(f"Timeout sending message to chat {chat_id}")
            if attempt < retries:
                logger.info(f"Retrying... (attempt {attempt + 1})")
                time.sleep(0.5)
                continue
            return False
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            if attempt < retries:
                logger.info(f"Retrying... (attempt {attempt + 1})")
                time.sleep(0.5)
                continue
            return False
    
    return False

@app.post("/notify_event")
async def notify_event(event: NotifyEventRequest):
    """Receive event from Fusion and send Telegram notification"""
    start_time = time.time()
    
    logger.info(f"Received event: camera_id={event.camera_id}, reason={event.reason}")
    
    # Check rate limit
    if not check_rate_limit(event.camera_id):
        logger.warning(f"Rate limit exceeded for camera {event.camera_id}")
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Parse chat IDs
    chat_ids = parse_chat_ids()
    if not chat_ids:
        logger.error("No TELEGRAM_CHAT_ID configured")
        raise HTTPException(status_code=500, detail="No chat IDs configured")
    
    # Prepare image
    image_data = None
    if event.jpg_b64:
        try:
            image_data = base64.b64decode(event.jpg_b64)
            logger.info("Using provided base64 image")
        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
    
    # Fallback: capture snapshot if no image provided
    if not image_data:
        image_data = capture_snapshot_with_ffmpeg()
        if not image_data:
            logger.warning("Could not capture snapshot, sending text-only message")
    
    # Format message text
    text = format_notification_text(event)
    
    # Send to all chat IDs
    success_count = 0
    for chat_id in chat_ids:
        if send_telegram_message(chat_id, text, image_data, retries=1):
            success_count += 1
    
    # Calculate latency
    latency_ms = (time.time() - start_time) * 1000
    
    # Log structured info
    logger.info(json.dumps({
        "event": "notification_sent",
        "camera_id": event.camera_id,
        "reason": event.reason,
        "chat_ids": chat_ids,
        "success_count": success_count,
        "total_chats": len(chat_ids),
        "lat_ms": round(latency_ms, 2),
        "has_image": image_data is not None
    }))
    
    if success_count == 0:
        raise HTTPException(status_code=500, detail="Failed to send to any chat")
    
    return {
        "status": "ok",
        "sent_to_chats": success_count,
        "total_chats": len(chat_ids),
        "latency_ms": round(latency_ms, 2)
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    chat_ids = parse_chat_ids()
    return {
        "status": "ok",
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN),
        "chat_ids_count": len(chat_ids),
        "stream_url": STREAM_SNAPSHOT_URL,
        "timeout_ms": NOTIFIER_TIMEOUT_MS
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8085)