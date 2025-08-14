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

# Persistent outbox for idempotent message delivery
outbox_queue = asyncio.Queue()
outbox_storage: Dict[str, Dict] = {}
outbox_file = "/tmp/notifier_outbox.json"

# Load persistent outbox on startup
def load_outbox_storage():
    global outbox_storage
    try:
        if os.path.exists(outbox_file):
            with open(outbox_file, 'r') as f:
                outbox_storage = json.load(f)
            logger.info(f"Loaded {len(outbox_storage)} messages from persistent outbox")
    except Exception as e:
        logger.error(f"Failed to load outbox storage: {e}")
        outbox_storage = {}

def save_outbox_storage():
    try:
        with open(outbox_file, 'w') as f:
            json.dump(outbox_storage, f, default=str)
    except Exception as e:
        logger.error(f"Failed to save outbox storage: {e}")

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

def check_rate_limit(camera_id: str) -> bool:
    """Check if camera is within rate limit"""
    now = time.time()
    if camera_id not in rate_limit_tracker:
        rate_limit_tracker[camera_id] = []
    
    # Remove old entries
    rate_limit_tracker[camera_id] = [
        ts for ts in rate_limit_tracker[camera_id] 
        if now - ts < RATE_LIMIT_WINDOW
    ]
    
    if len(rate_limit_tracker[camera_id]) >= RATE_LIMIT_PER_CAMERA:
        return False
    
    rate_limit_tracker[camera_id].append(now)
    return True

def capture_snapshot_with_ffmpeg(stream_url: str) -> Optional[bytes]:
    """Capture a frame from stream using ffmpeg"""
    try:
        cmd = [
            'ffmpeg', '-i', stream_url, '-frames:v', '1', 
            '-f', 'image2', '-c:v', 'mjpeg', '-y', '-'
        ]
        result = subprocess.run(
            cmd, capture_output=True, timeout=8
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout
        else:
            logger.warning(f"ffmpeg failed: {result.stderr.decode()}")
            return None
    except Exception as e:
        logger.error(f"Failed to capture snapshot: {e}")
        return None

def format_notification_text(event: NotifyEventRequest) -> str:
    """Format notification text based on TELEGRAM_PARSE_MODE"""
    try:
        dt = datetime.fromisoformat(event.ts.replace('Z', '+00:00'))
        time_str = dt.strftime('%H:%M:%S')
    except:
        time_str = event.ts

    person_info = event.person_name if event.person_name else f"ID:{event.person_id}" if event.person_id else "Desconhecida"
    face_sim = f"{event.face_similarity:.0%}" if event.face_similarity else "N/A"
    reid_sim = f"{event.reid_similarity:.0%}" if event.reid_similarity else "N/A"
    frames = str(event.frames_confirmed) if event.frames_confirmed else "?"
    movement = f"{event.movement_px:.0f}" if event.movement_px else "?"
    
    plate_line_txt = f"\nPlaca: {event.plate}" if event.plate else ""
    clip_line_txt = f"\n🎥 Clip: {event.clip_url}" if event.clip_url else ""
    
    if TELEGRAM_PARSE_MODE.upper() == "MARKDOWN":
        text = f"""*[Visão de Águia]*
📹 Câmera: `{event.camera_id}` | {time_str}
🔍 Motivo: `{event.reason}`
👤 Face: `{face_sim}` | ReID: `{reid_sim}`
🏷️ Pessoa: `{person_info}`
📊 Frames: `{frames}` | Move: `{movement}px`{plate_line_txt}{clip_line_txt}"""
        
    elif TELEGRAM_PARSE_MODE.upper() == "HTML":
        text = f"""<b>[Visão de Águia]</b>
📹 Câmera: <code>{event.camera_id}</code> | {time_str}
🔍 Motivo: <code>{event.reason}</code>
👤 Face: <code>{face_sim}</code> | ReID: <code>{reid_sim}</code>
🏷️ Pessoa: <code>{person_info}</code>
📊 Frames: <code>{frames}</code> | Move: <code>{movement}px</code>{plate_line_txt}{clip_line_txt}"""
    else:
        text = f"""[Visão de Águia]
Câmera: {event.camera_id} | {time_str}
Motivo: {event.reason}
Face: {face_sim} | ReID: {reid_sim}
Pessoa: {person_info}
Frames: {frames} | Move: {movement}px{plate_line_txt}{clip_line_txt}"""
    
    return text

async def add_to_outbox(chat_id: str, text: str, image_data: Optional[bytes] = None):
    """Add message to outbox for idempotent guaranteed delivery"""
    correlation_id = generate_correlation_id()
    message_id = f"{int(time.time() * 1000000)}_{chat_id}_{correlation_id[:8]}"
    
    # Check for duplicate messages (idempotency)
    text_hash = hash(f"{chat_id}:{text}")
    existing_msg = None
    for msg_id, msg_data in outbox_storage.items():
        if (msg_data.get('chat_id') == chat_id and 
            hash(f"{chat_id}:{msg_data.get('text', '')}") == text_hash and
            time.time() - msg_data.get('created_at', 0) < 300):  # 5 minutes window
            existing_msg = msg_id
            break
    
    if existing_msg:
        logger.info(f"Message already exists in outbox: {existing_msg}, skipping duplicate")
        return existing_msg
    
    message = OutboxMessage(
        message_id=message_id,
        chat_id=chat_id,
        text=text,
        image_data=image_data,
        created_at=time.time()
    )
    
    # Store persistently
    outbox_storage[message_id] = message.dict()
    save_outbox_storage()
    
    # Add to processing queue
    await outbox_queue.put(message_id)
    
    logger.info(f"Added message {message_id} to persistent outbox")
    return message_id

@with_correlation
async def send_telegram_message_resilient(chat_id: str, text: str, image_data: Optional[bytes] = None) -> bool:
    """Send message to Telegram using resilient HTTP client"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not configured")
        return False
    
    try:
        if image_data:
            # Send photo with caption
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
            
            files = {
                'photo': ('image.jpg', image_data, 'image/jpeg')
            }
            data = {
                'chat_id': chat_id,
                'caption': text,
                'parse_mode': TELEGRAM_PARSE_MODE
            }
            
            response = await http_client.post(url, data=data, files=files, timeout=30.0)
        else:
            # Send text message
            url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            data = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': TELEGRAM_PARSE_MODE
            }
            
            response = await http_client.post(url, json=data, timeout=15.0)
        
        if response.status_code == 200:
            return True
        else:
            logger.error(f"Telegram API error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"Failed to send Telegram message: {e}")
        return False

async def fetch_chat_ids_from_updates() -> List[str]:
    """Fetch chat IDs from Telegram getUpdates API using resilient HTTP client"""
    if not TELEGRAM_BOT_TOKEN:
        return []
    
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getUpdates"
        response = await http_client.get(url, timeout=10.0)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('ok'):
                return parse_chat_ids(data.get('result', []))
        
        logger.warning(f"Failed to fetch Telegram updates: {response.status_code}")
        return []
        
    except Exception as e:
        logger.error(f"Error fetching Telegram chat IDs: {e}")
        return []

def parse_chat_ids(updates: List[Dict]) -> List[str]:
    """Parse chat IDs from Telegram updates"""
    chat_ids = set()
    for update in updates:
        if 'message' in update:
            chat_id = update['message']['chat']['id']
            chat_ids.add(str(chat_id))
    return list(chat_ids)

async def delayed_requeue(message_id: str, delay: float):
    """Re-queue message after delay for retry"""
    await asyncio.sleep(delay)
    await outbox_queue.put(message_id)

async def process_outbox():
    """Background task to process outbox messages with resilient delivery"""
    logger.info("Starting outbox processor")
    
    while True:
        try:
            # Get message from queue with timeout
            message_id = await asyncio.wait_for(outbox_queue.get(), timeout=5.0)
            
            if message_id not in outbox_storage:
                logger.warning(f"Message {message_id} not found in storage")
                continue
            
            msg_data = outbox_storage[message_id]
            
            # Skip if already completed
            if msg_data.get('status') == 'completed':
                continue
            
            # Update status to processing
            outbox_storage[message_id]['status'] = 'processing'
            save_outbox_storage()
            
            # Send message
            success = await send_telegram_message_resilient(
                chat_id=msg_data['chat_id'],
                text=msg_data['text'],
                image_data=msg_data.get('image_data')
            )
            
            if success:
                # Update status and persist
                outbox_storage[message_id]['status'] = 'completed'
                save_outbox_storage()
                logger.info(f"Message {message_id} sent successfully and persisted")
            else:
                # Handle retry logic
                retry_count = msg_data.get('retry_count', 0)
                max_retries = msg_data.get('max_retries', 3)
                
                if retry_count >= max_retries:
                    outbox_storage[message_id]['status'] = 'failed'
                    save_outbox_storage()
                    logger.error(f"Message {message_id} failed after {max_retries} retries")
                else:
                    # Exponential backoff: wait before retry
                    backoff_time = min(60, 2 ** retry_count)
                    logger.warning(f"Message {message_id} failed, retrying in {backoff_time}s (attempt {retry_count + 1}/{max_retries})")
                    outbox_storage[message_id]['retry_count'] = retry_count + 1
                    outbox_storage[message_id]['status'] = 'pending'
                    save_outbox_storage()
                    
                    # Re-queue with delay
                    asyncio.create_task(delayed_requeue(message_id, backoff_time))
            
        except asyncio.TimeoutError:
            # No messages in queue, continue
            continue
        except Exception as e:
            logger.error(f"Error in outbox processor: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    """Initialize persistent outbox and start background processing"""
    load_outbox_storage()
    
    # Re-queue pending messages from persistent storage
    for msg_id, msg_data in outbox_storage.items():
        if msg_data.get('status') in ['pending', 'processing']:
            await outbox_queue.put(msg_id)
    
    asyncio.create_task(process_outbox())

@app.post("/notify_event")
@with_correlation
async def notify_event(event: NotifyEventRequest):
    """Receive event notification and queue for delivery"""
    set_correlation_context(
        camera_id=event.camera_id,
        org_id=event.person_id or "unknown"
    )
    
    try:
        # Apply rate limiting
        if not check_rate_limit(event.camera_id):
            logger.warning(f"Rate limit exceeded for camera {event.camera_id}")
            raise HTTPException(status_code=429, detail="Rate limit exceeded")
        
        # Apply deduplication
        if not should_notify(event.camera_id, event.person_id):
            logger.info(f"Suppressing duplicate notification for {event.camera_id}:{event.person_id}")
            return {"status": "suppressed", "reason": "duplicate"}
        
        # Get chat IDs
        chat_ids = []
        if TELEGRAM_CHAT_ID:
            chat_ids = [id.strip() for id in TELEGRAM_CHAT_ID.split(",") if id.strip()]
        else:
            chat_ids = await fetch_chat_ids_from_updates()
        
        if not chat_ids:
            logger.warning("No chat IDs available for notification")
            return {"status": "no_recipients"}
        
        # Capture snapshot if needed
        image_data = None
        if event.jpg_b64:
            try:
                if ',' in event.jpg_b64:
                    event.jpg_b64 = event.jpg_b64.split(',')[1]
                image_data = base64.b64decode(event.jpg_b64)
            except Exception as e:
                logger.error(f"Failed to decode base64 image: {e}")
        elif STREAM_SNAPSHOT_URL:
            image_data = capture_snapshot_with_ffmpeg(STREAM_SNAPSHOT_URL)
        
        # Format message
        message_text = format_notification_text(event)
        
        # Add to outbox for all chat IDs
        sent_count = 0
        for chat_id in chat_ids:
            try:
                await add_to_outbox(chat_id, message_text, image_data)
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to queue message for chat {chat_id}: {e}")
        
        return {
            "status": "queued", 
            "recipients": sent_count,
            "total_chats": len(chat_ids)
        }
        
    except Exception as e:
        logger.error(f"Error in notify_event: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/notify_clip")
@with_correlation
async def notify_clip(clip_request: NotifyClipRequest):
    """Receive clip notification and queue for delivery"""
    set_correlation_context(
        camera_id=clip_request.camera_id or "unknown"
    )
    
    try:
        # Get chat IDs
        chat_ids = []
        if TELEGRAM_CHAT_ID:
            chat_ids = [id.strip() for id in TELEGRAM_CHAT_ID.split(",") if id.strip()]
        else:
            chat_ids = await fetch_chat_ids_from_updates()
        
        if not chat_ids:
            return {"status": "no_recipients"}
        
        # Format clip message
        ts_str = clip_request.ts or datetime.now().strftime('%H:%M:%S')
        camera_str = clip_request.camera_id or "N/A"
        
        message_text = f"""🎥 [Visão de Águia - Clip]
Evento: {clip_request.event_id}
Câmera: {camera_str}
Horário: {ts_str}
📎 Link: {clip_request.clip_url}"""
        
        # Add to outbox for all chat IDs
        sent_count = 0
        for chat_id in chat_ids:
            try:
                await add_to_outbox(chat_id, message_text)
                sent_count += 1
            except Exception as e:
                logger.error(f"Failed to queue clip message for chat {chat_id}: {e}")
        
        return {
            "status": "queued",
            "recipients": sent_count,
            "total_chats": len(chat_ids)
        }
        
    except Exception as e:
        logger.error(f"Error in notify_clip: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint with outbox status"""
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    outbox_stats = {
        "total_messages": len(outbox_storage),
        "pending": len([m for m in outbox_storage.values() if m.get('status') == 'pending']),
        "processing": len([m for m in outbox_storage.values() if m.get('status') == 'processing']),
        "completed": len([m for m in outbox_storage.values() if m.get('status') == 'completed']),
        "failed": len([m for m in outbox_storage.values() if m.get('status') == 'failed']),
        "queue_size": outbox_queue.qsize()
    }
    
    return {
        "status": "ok",
        "telegram_configured": bool(TELEGRAM_BOT_TOKEN),
        "outbox": outbox_stats,
        "circuit_breakers": circuit_stats,
        "rate_limits": {
            "tracked_cameras": len(rate_limit_tracker),
            "limit_per_camera": RATE_LIMIT_PER_CAMERA,
            "window_seconds": RATE_LIMIT_WINDOW
        }
    }

@app.get("/outbox_status")
async def get_outbox_status():
    """Get detailed outbox status"""
    messages = []
    for msg_id, msg_data in outbox_storage.items():
        messages.append({
            "message_id": msg_id,
            "chat_id": msg_data.get('chat_id'),
            "status": msg_data.get('status'),
            "retry_count": msg_data.get('retry_count', 0),
            "created_at": msg_data.get('created_at'),
            "age_seconds": time.time() - msg_data.get('created_at', 0)
        })
    
    return {
        "total_messages": len(messages),
        "queue_size": outbox_queue.qsize(),
        "messages": sorted(messages, key=lambda x: x['created_at'], reverse=True)[:50]  # Last 50 messages
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8092,
        reload=False
    )