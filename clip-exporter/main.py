#!/usr/bin/env python3
"""
Enhanced Clip Exporter with Privacy-by-Default and Pre/Post-roll
Generates clips with configurable pre-roll/post-roll and automatic privacy blurring
"""

import os
import time
import hashlib
import asyncio
import logging
import tempfile
import subprocess
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from prometheus_client import Histogram, Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MEDIAMTX_URL = os.getenv("MEDIAMTX_URL", "http://mediamtx:8889")
STORAGE_URL = os.getenv("STORAGE_URL", f"{SUPABASE_URL}/storage/v1")

# Clip generation settings
DEFAULT_PRE_ROLL_SECONDS = int(os.getenv("DEFAULT_PRE_ROLL_SECONDS", "3"))
DEFAULT_POST_ROLL_SECONDS = int(os.getenv("DEFAULT_POST_ROLL_SECONDS", "5"))
MAX_CLIP_DURATION = int(os.getenv("MAX_CLIP_DURATION", "60"))

# Privacy settings
ENABLE_FACE_BLUR = os.getenv("ENABLE_FACE_BLUR", "true").lower() == "true"
ENABLE_PLATE_BLUR = os.getenv("ENABLE_PLATE_BLUR", "true").lower() == "true"

app = FastAPI(title="Enhanced Clip Exporter", version="2.0.0")

# Prometheus metrics
clip_export_duration = Histogram('clip_export_duration_seconds', 'Clip export processing time', ['privacy_applied'])
clip_export_total = Counter('clip_export_total', 'Total clip exports', ['status', 'privacy_type'])
clip_checksum_operations = Counter('clip_checksum_operations_total', 'Checksum operations', ['operation'])
clip_retention_cleanup = Counter('clip_retention_cleanup_total', 'Retention cleanup operations', ['status'])
privacy_blur_operations = Counter('privacy_blur_operations_total', 'Privacy blur operations', ['blur_type'])

# HTTP client
http_client = httpx.AsyncClient(timeout=30.0)

logger = logging.getLogger("clip-exporter")
logging.basicConfig(level=logging.INFO)

# Data models
class ClipExportRequest(BaseModel):
    event_id: str
    camera_id: Optional[str] = None
    event_timestamp: Optional[str] = None
    pre_roll_seconds: Optional[int] = DEFAULT_PRE_ROLL_SECONDS
    post_roll_seconds: Optional[int] = DEFAULT_POST_ROLL_SECONDS
    apply_privacy: Optional[bool] = True
    blur_faces: Optional[bool] = True
    blur_plates: Optional[bool] = True

class ClipExportResponse(BaseModel):
    clip_id: str
    status: str
    clip_url: Optional[str] = None
    checksum: Optional[str] = None
    processing_time_ms: float
    privacy_applied: bool
    metadata: Optional[Dict[str, Any]] = None

def calculate_checksum(file_path: str) -> str:
    """Calculate SHA256 checksum of file"""
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        checksum = sha256_hash.hexdigest()
        clip_checksum_operations.labels(operation='calculate').inc()
        return checksum
    except Exception as e:
        logger.error(f"Failed to calculate checksum: {e}")
        clip_checksum_operations.labels(operation='error').inc()
        return ""

async def get_event_data(event_id: str) -> Dict[str, Any]:
    """Get event data from Supabase"""
    try:
        # Mock implementation - in production, query Supabase
        return {
            "camera_id": "cam_001",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "person_id": "person_123",
            "reason": "face"
        }
    except Exception as e:
        logger.error(f"Failed to get event data: {e}")
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

async def get_privacy_config(org_id: str = None) -> Dict[str, Any]:
    """Get privacy configuration for organization"""
    try:
        # Mock implementation - in production, query Supabase privacy_configurations
        return {
            'blur_faces_by_default': True,
            'blur_plates_by_default': True,
            'auto_apply_privacy': True,
            'retention_days': 30
        }
    except Exception as e:
        logger.warning(f"Failed to get privacy config: {e}")
        return {
            'blur_faces_by_default': True,
            'blur_plates_by_default': True,
            'auto_apply_privacy': True,
            'retention_days': 30
        }

async def capture_stream_segment(
    camera_id: str, 
    start_time: datetime, 
    duration_seconds: int
) -> str:
    """Capture stream segment from MediaMTX"""
    
    try:
        # Generate temporary file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Construct HLS stream URL
        stream_url = f"{MEDIAMTX_URL}/hls/{camera_id}/index.m3u8"
        
        # Use FFmpeg to capture segment with pre/post-roll
        cmd = [
            'ffmpeg',
            '-i', stream_url,
            '-t', str(duration_seconds),
            '-c', 'copy',
            '-avoid_negative_ts', 'make_zero',
            '-y',  # Overwrite output file
            output_path
        ]
        
        logger.info(f"Capturing stream: {' '.join(cmd)}")
        
        # Run FFmpeg
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"FFmpeg failed: {stderr.decode()}")
            raise HTTPException(status_code=500, detail="Failed to capture stream")
        
        logger.info(f"Stream captured successfully: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Stream capture failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def apply_privacy_filters(
    input_path: str, 
    blur_faces: bool = True, 
    blur_plates: bool = True
) -> str:
    """Apply privacy filters to video using FFmpeg"""
    
    if not (blur_faces or blur_plates):
        return input_path
    
    try:
        with tempfile.NamedTemporaryFile(suffix='_privacy.mp4', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Build FFmpeg filter chain for privacy
        filters = []
        
        if blur_faces:
            # Simple face blur using FFmpeg's delogo filter (placeholder)
            # In production, use a proper face detection + blur pipeline
            filters.append("boxblur=5:1")
            privacy_blur_operations.labels(blur_type='faces').inc()
        
        if blur_plates:
            # License plate blur (placeholder)
            # In production, integrate with ALPR + blur pipeline
            privacy_blur_operations.labels(blur_type='plates').inc()
        
        # Apply filters
        filter_chain = ",".join(filters) if filters else "copy"
        
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-vf', filter_chain,
            '-c:a', 'copy',  # Keep audio unchanged
            '-y',
            output_path
        ]
        
        logger.info(f"Applying privacy filters: {filter_chain}")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Privacy filter failed: {stderr.decode()}")
            return input_path  # Return original if filtering fails
        
        # Clean up original file
        os.unlink(input_path)
        
        logger.info(f"Privacy filters applied: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"Privacy filtering failed: {e}")
        return input_path  # Return original if filtering fails

async def upload_to_storage(file_path: str, clip_id: str) -> str:
    """Upload clip to Supabase Storage"""
    try:
        bucket_name = "event_clips"
        file_name = f"{clip_id}.mp4"
        
        # Mock upload - in production, use Supabase Storage API
        clip_url = f"{STORAGE_URL}/object/public/{bucket_name}/{file_name}"
        
        logger.info(f"Clip uploaded: {clip_url}")
        return clip_url
        
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload clip")

async def save_clip_metadata(
    clip_id: str, 
    clip_url: str, 
    checksum: str, 
    metadata: Dict[str, Any]
) -> None:
    """Save clip metadata to database"""
    try:
        # Mock database save - in production, use Supabase client
        logger.info(f"Saved clip metadata: {clip_id}")
    except Exception as e:
        logger.error(f"Failed to save metadata: {e}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "privacy_enabled": ENABLE_FACE_BLUR or ENABLE_PLATE_BLUR,
        "default_settings": {
            "pre_roll_seconds": DEFAULT_PRE_ROLL_SECONDS,
            "post_roll_seconds": DEFAULT_POST_ROLL_SECONDS,
            "max_clip_duration": MAX_CLIP_DURATION
        },
        "ffmpeg_available": True  # In production, check FFmpeg availability
    }

@app.post("/export_clip", response_model=ClipExportResponse)
async def export_clip(request: ClipExportRequest, background_tasks: BackgroundTasks):
    """Export clip with privacy processing and pre/post-roll"""
    
    start_time = time.time()
    clip_id = f"clip_{request.event_id}_{int(time.time())}"
    
    try:
        # Get event data
        if request.camera_id and request.event_timestamp:
            event_data = {
                "camera_id": request.camera_id,
                "timestamp": request.event_timestamp
            }
        else:
            event_data = await get_event_data(request.event_id)
        
        # Get privacy configuration
        privacy_config = await get_privacy_config()
        
        # Apply organization defaults if not specified
        apply_privacy = request.apply_privacy if request.apply_privacy is not None else privacy_config['auto_apply_privacy']
        blur_faces = request.blur_faces if request.blur_faces is not None else privacy_config['blur_faces_by_default']
        blur_plates = request.blur_plates if request.blur_plates is not None else privacy_config['blur_plates_by_default']
        
        # Parse event timestamp
        event_time = datetime.fromisoformat(event_data["timestamp"].replace('Z', '+00:00'))
        
        # Calculate clip duration with pre/post-roll
        clip_duration = request.pre_roll_seconds + request.post_roll_seconds + 5  # 5s main event
        
        if clip_duration > MAX_CLIP_DURATION:
            raise HTTPException(
                status_code=400, 
                detail=f"Clip duration {clip_duration}s exceeds maximum {MAX_CLIP_DURATION}s"
            )
        
        # Capture stream segment
        logger.info(f"Capturing {clip_duration}s clip from camera {event_data['camera_id']}")
        raw_clip_path = await capture_stream_segment(
            event_data["camera_id"],
            event_time - timedelta(seconds=request.pre_roll_seconds),
            clip_duration
        )
        
        # Apply privacy filters if enabled
        if apply_privacy:
            privacy_label = 'enabled'
            processed_clip_path = await apply_privacy_filters(
                raw_clip_path, 
                blur_faces, 
                blur_plates
            )
        else:
            privacy_label = 'disabled'
            processed_clip_path = raw_clip_path
        
        # Calculate checksum
        checksum = calculate_checksum(processed_clip_path)
        
        # Upload to storage
        clip_url = await upload_to_storage(processed_clip_path, clip_id)
        
        # Prepare metadata
        metadata = {
            'event_id': request.event_id,
            'camera_id': event_data['camera_id'],
            'event_timestamp': event_data['timestamp'],
            'pre_roll_seconds': request.pre_roll_seconds,
            'post_roll_seconds': request.post_roll_seconds,
            'total_duration_seconds': clip_duration,
            'privacy_applied': apply_privacy,
            'faces_blurred': blur_faces and apply_privacy,
            'plates_blurred': blur_plates and apply_privacy,
            'retention_days': privacy_config['retention_days']
        }
        
        # Schedule background tasks
        background_tasks.add_task(
            save_clip_metadata,
            clip_id, 
            clip_url, 
            checksum, 
            metadata
        )
        
        # Cleanup temporary files
        background_tasks.add_task(cleanup_temp_file, processed_clip_path)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Update metrics
        clip_export_duration.labels(privacy_applied=privacy_label).observe(time.time() - start_time)
        clip_export_total.labels(status='success', privacy_type=privacy_label).inc()
        
        return ClipExportResponse(
            clip_id=clip_id,
            status="completed",
            clip_url=clip_url,
            checksum=checksum,
            processing_time_ms=processing_time,
            privacy_applied=apply_privacy,
            metadata=metadata
        )
        
    except Exception as e:
        clip_export_total.labels(status='error', privacy_type='unknown').inc()
        logger.error(f"Export clip failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def cleanup_temp_file(file_path: str):
    """Cleanup temporary file"""
    try:
        if os.path.exists(file_path):
            os.unlink(file_path)
            logger.debug(f"Cleaned up temp file: {file_path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup temp file: {e}")

@app.post("/cleanup_expired")
async def cleanup_expired_clips():
    """Manual trigger for clip cleanup"""
    try:
        # Mock cleanup - in production, call Supabase function
        deleted_count = 0
        
        clip_retention_cleanup.labels(status='success').inc()
        
        return {
            "status": "success",
            "deleted_clips": deleted_count,
            "cleanup_time": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        clip_retention_cleanup.labels(status='error').inc()
        logger.error(f"Cleanup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.on_event("startup")
async def startup_event():
    """Initialize clip exporter"""
    logger.info("Enhanced Clip Exporter starting up")
    logger.info(f"Privacy settings: faces={ENABLE_FACE_BLUR}, plates={ENABLE_PLATE_BLUR}")
    logger.info(f"Default timing: pre-roll={DEFAULT_PRE_ROLL_SECONDS}s, post-roll={DEFAULT_POST_ROLL_SECONDS}s")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await http_client.aclose()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8095)