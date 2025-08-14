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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Import resilient HTTP components and outbox pattern
import sys
sys.path.append('/common_schemas')
from http_resilient import get_http_client, ResilientHTTPClient
from correlation_logger import set_correlation_context, with_correlation, generate_correlation_id

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Visão de Águia - Notifier")

# CORS configurado por ALLOWED_ORIGINS (csv)
ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://panel.inigrai.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
STREAM_SNAPSHOT_URL = os.getenv("STREAM_SNAPSHOT_URL", "http://mediamtx:8888/simulador/index.m3u8")
NOTIFIER_TIMEOUT_MS = int(os.getenv("NOTIFIER_TIMEOUT_MS", "4000"))
TELEGRAM_PARSE_MODE = os.getenv("TELEGRAM_PARSE_MODE", "HTML")

# Rate limiting: max 10 messages per minute per camera
RATE_LIMIT_PER_CAMERA = 10
RATE_LIMIT_WINDOW = 60  # seconds
rate_limit_tracker: Dict[str, List[float]] = {}

# Deduplicação: suprimir repetições por (camera, pessoa) por janela mínima
ALERT_WINDOW_MIN = int(os.getenv("ALERT_WINDOW_MIN", "5"))
_last_sent: Dict[str, float] = {}

# Initialize resilient HTTP client for Telegram API
http_client: ResilientHTTPClient = get_http_client(service_name="notifier")

# Outbox for idempotent message delivery
outbox_queue = asyncio.Queue()
outbox_storage: Dict[str, Dict] = {}  # In-memory storage, replace with persistent storage in production

class NotifyEventRequest(BaseModel):
    camera_id: str
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    reason: str  # "face" or "reid+motion" or other
    face_similarity: Optional[float] = None
    reid_similarity: Optional[float] = None
    frames_confirmed: Optional[int] = None
    movement_px: Optional[float] = None
    ts: str
    jpg_b64: Optional[str] = None
    plate: Optional[str] = None
    clip_url: Optional[str] = None

class NotifyClipRequest(BaseModel):
    event_id: int
    camera_id: Optional[str] = None
    ts: Optional[str] = None
    clip_url: str

class OutboxMessage(BaseModel):
    message_id: str
    chat_id: str
    text: str
    image_data: Optional[bytes] = None
    max_retries: int = 3
    retry_count: int = 0
    created_at: float
    status: str = "pending"  # pending, processing, completed, failed

def should_notify(cam: str, pid: Optional[str]) -> bool:
    key = f"{cam}:{pid or 'unknown'}"
    now = time.time()
    ts = _last_sent.get(key, 0.0)
    if now - ts < ALERT_WINDOW_MIN * 60:
        return False
    _last_sent[key] = now
    return True

def fetch_chat_ids_from_updates() -> List[str]:
    """Fetch chat IDs from Telegram getUpdates when TELEGRAM_CHAT_ID=auto"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        return []
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
    try:
        import requests
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

    plate_line_html = f"\n<b>Placa:</b> {event.plate}" if event.plate else ""
    plate_line_txt = f"\nPlaca: {event.plate}" if event.plate else ""

    clip_line_html = f"\n<b>Clip:</b> <a href=\"{event.clip_url}\">download</a>" if event.clip_url else ""
    clip_line_txt = f"\nClip: {event.clip_url}" if event.clip_url else ""
    
    if TELEGRAM_PARSE_MODE == "HTML":
        text = f"""<b>[Visão de Águia]</b>
<b>Câmera:</b> {event.camera_id} | {time_str}
<b>Motivo:</b> {event.reason}
<b>Face:</b> {face_sim} | <b>ReID:</b> {reid_sim}
<b>Pessoa:</b> {person_info}
<b>Frames:</b> {frames} | <b>Move:</b> {movement}px{plate_line_html}{clip_line_html}"""
    else:
        text = f"""[Visão de Águia]
Câmera: {event.camera_id} | {time_str}
Motivo: {event.reason}
Face: {face_sim} | ReID: {reid_sim}
Pessoa: {person_info}
Frames: {frames} | Move: {movement}px{plate_line_txt}{clip_line_txt}"""
    
    return text

async def add_to_outbox(message_id: str, chat_id: str, text: str, image_data: Optional[bytes] = None) -> None:
    """Add message to outbox for guaranteed delivery"""
    outbox_msg = OutboxMessage(
        message_id=message_id,
        chat_id=chat_id,
        text=text,
        image_data=image_data,
        created_at=time.time()
    )
    
    outbox_storage[message_id] = outbox_msg.dict()
    await outbox_queue.put(message_id)
    logger.info(f"Added message {message_id} to outbox")

@with_correlation
async def send_telegram_message_resilient(chat_id: str, text: str, image_data: Optional[bytes] = None) -> bool:
    """Send message to Telegram using resilient HTTP client"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        return False
    
    base_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
    
    try:
        if image_data:
            # For file uploads, we need to use the original method temporarily
            # TODO: Enhance resilient client to support multipart uploads
            import requests
            url = f"{base_url}/sendPhoto"
            files = {
                'photo': ('snapshot.jpg', BytesIO(image_data), 'image/jpeg')
            }
            data = {
                'chat_id': chat_id,
                'caption': text,
                'parse_mode': TELEGRAM_PARSE_MODE
            }
            response = await asyncio.get_event_loop().run_in_executor(
                None, 
                lambda: requests.post(url, files=files, data=data, timeout=NOTIFIER_TIMEOUT_MS/1000)
            )
            success = response.status_code == 200
            if not success:
                logger.error(f"Telegram API error {response.status_code}: {response.text}")
        else:
            # Use resilient client for text messages
            url = f"{base_url}/sendMessage"
            data = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': TELEGRAM_PARSE_MODE
            }
            response = await http_client.post(url, json=data, timeout=NOTIFIER_TIMEOUT_MS/1000)
            success = response.status_code == 200
            if not success:
                logger.error(f"Telegram API error {response.status_code}: {response.text}")
        
        if success:
            logger.info(f"Message sent successfully to chat {chat_id}")
        
        return success
        
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        return False

async def process_outbox():
    """Background task to process outbox messages with guaranteed delivery"""
    while True:
        try:
            # Wait for message ID from queue
            message_id = await outbox_queue.get()
            
            if message_id not in outbox_storage:
                continue
            
            msg_data = outbox_storage[message_id]
            msg = OutboxMessage(**msg_data)
            
            if msg.status == "completed":
                continue
            
            if msg.retry_count >= msg.max_retries:
                msg.status = "failed"
                outbox_storage[message_id] = msg.dict()
                logger.error(f"Message {message_id} failed after {msg.max_retries} retries")
                continue
            
            # Set processing status
            msg.status = "processing"
            msg.retry_count += 1
            outbox_storage[message_id] = msg.dict()
            
            # Attempt delivery
            success = await send_telegram_message_resilient(
                msg.chat_id, 
                msg.text, 
                msg.image_data
            )
            
            if success:
                msg.status = "completed"
                logger.info(f"Outbox message {message_id} delivered successfully")
            else:
                msg.status = "pending"
                # Exponential backoff for retry
                retry_delay = min(2 ** msg.retry_count, 60)  # Max 60s delay
                logger.warning(f"Message {message_id} failed, retrying in {retry_delay}s")
                await asyncio.sleep(retry_delay)
                await outbox_queue.put(message_id)  # Re-queue for retry
            
            outbox_storage[message_id] = msg.dict()
            
        except Exception as e:
            logger.error(f"Error processing outbox: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    """Start background outbox processor"""
    asyncio.create_task(process_outbox())

@app.post("/notify_event")
async def notify_event(event: NotifyEventRequest):
    """Receive event from Fusion and send Telegram notification"""
    # Set up correlation context
    correlation_id = generate_correlation_id()
    set_correlation_context(
        correlation_id=correlation_id,
        service_name="notifier",
        camera_id=event.camera_id
    )
    
    start_time = time.time()
    
    logger.info(f"Received event: camera_id={event.camera_id}, reason={event.reason}")
    
    # Check rate limit
    if not check_rate_limit(event.camera_id):
        logger.warning(f"Rate limit exceeded for camera {event.camera_id}")
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    # Deduplication by (camera, person) within ALERT_WINDOW_MIN
    if not should_notify(event.camera_id, event.person_id):
        logger.info(
            f"Duplicate suppressed for camera={event.camera_id} person_id={event.person_id} within {ALERT_WINDOW_MIN}min"
        )
        return {"status": "skipped_duplicate", "window_min": ALERT_WINDOW_MIN}
    
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
    
    # Add messages to outbox for guaranteed delivery
    for chat_id in chat_ids:
        message_id = f"{correlation_id}_{chat_id}_{int(time.time() * 1000)}"
        await add_to_outbox(message_id, chat_id, text, image_data)
    
    # Calculate latency
    latency_ms = (time.time() - start_time) * 1000
    
    # Log structured info
    logger.info(json.dumps({
        "event": "notification_queued",
        "camera_id": event.camera_id,
        "reason": event.reason,
        "chat_ids": chat_ids,
        "total_chats": len(chat_ids),
        "lat_ms": round(latency_ms, 2),
        "has_image": image_data is not None,
        "correlation_id": correlation_id
    }))
    
    return {
        "status": "queued",
        "total_chats": len(chat_ids),
        "latency_ms": round(latency_ms, 2),
        "correlation_id": correlation_id
    }

@app.post("/notify_clip")
async def notify_clip_endpoint(req: NotifyClipRequest):
    """Send a simple clip link notification to all chats"""
    if not req.clip_url:
        raise HTTPException(status_code=400, detail="clip_url required")
    
    correlation_id = generate_correlation_id()
    set_correlation_context(
        correlation_id=correlation_id,
        service_name="notifier",
        camera_id=req.camera_id or "unknown"
    )
    
    if TELEGRAM_PARSE_MODE == "HTML":
        text = f"""<b>[Visão de Águia]</b>
<b>Replay disponível</b>
<b>Clip:</b> <a href=\"{req.clip_url}\">download</a>"""
    else:
        text = f"""[Visão de Águia]
Replay disponível
Clip: {req.clip_url}"""
    
    chat_ids = parse_chat_ids()
    if not chat_ids:
        raise HTTPException(status_code=500, detail="No chat IDs configured")
    
    # Add to outbox
    for chat_id in chat_ids:
        message_id = f"{correlation_id}_clip_{chat_id}_{int(time.time() * 1000)}"
        await add_to_outbox(message_id, chat_id, text)
    
    return {
        "status": "queued", 
        "total_chats": len(chat_ids),
        "correlation_id": correlation_id
    }

@app.get("/health")
async def health():
    """Health check endpoint"""
    chat_ids = parse_chat_ids()
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return {
        "status": "ok",
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN),
        "chat_ids_count": len(chat_ids),
        "stream_url": STREAM_SNAPSHOT_URL,
        "timeout_ms": NOTIFIER_TIMEOUT_MS,
        "outbox_queue_size": outbox_queue.qsize(),
        "outbox_storage_size": len(outbox_storage),
        "circuit_breakers": circuit_stats
    }

@app.get("/outbox_status")
async def outbox_status():
    """Get outbox processing status"""
    pending = sum(1 for msg in outbox_storage.values() if msg["status"] == "pending")
    processing = sum(1 for msg in outbox_storage.values() if msg["status"] == "processing")
    completed = sum(1 for msg in outbox_storage.values() if msg["status"] == "completed")
    failed = sum(1 for msg in outbox_storage.values() if msg["status"] == "failed")
    
    return {
        "queue_size": outbox_queue.qsize(),
        "total_messages": len(outbox_storage),
        "pending": pending,
        "processing": processing,
        "completed": completed,
        "failed": failed
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8085)