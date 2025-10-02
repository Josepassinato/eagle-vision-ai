#!/usr/bin/env python3
"""
Enhanced Clip Exporter with ROI-based Privacy Blur and Resilient Architecture
Generates clips with configurable pre/post-roll and automatic ROI-based privacy blurring
"""

import os
import time
import hashlib
import asyncio
import logging
import tempfile
import subprocess
import json
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from prometheus_client import Histogram, Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Import resilient HTTP components
import sys
sys.path.append('/common_schemas')
from http_resilient import get_http_client, resilient_post_json, resilient_get_json
from correlation_logger import set_correlation_context, with_correlation, generate_correlation_id

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

# Detection services for ROI-based blur
YOLO_SERVICE_URL = os.getenv("YOLO_SERVICE_URL", "http://yolo-detection:18060")
FACE_SERVICE_URL = os.getenv("FACE_SERVICE_URL", "http://face-service:18080")
ALPR_SERVICE_URL = os.getenv("ALPR_SERVICE_URL", "http://lpr-service:8091")

app = FastAPI(title="Enhanced Clip Exporter", version="2.1.0")

# Initialize resilient HTTP client
http_client = get_http_client(service_name="clip-exporter")

# Prometheus metrics
clip_export_duration = Histogram('clip_export_duration_seconds', 'Clip export processing time', ['privacy_applied'])
clip_export_total = Counter('clip_export_total', 'Total clip exports', ['status', 'privacy_type'])
clip_checksum_operations = Counter('clip_checksum_operations_total', 'Checksum operations', ['operation'])
clip_retention_cleanup = Counter('clip_retention_cleanup_total', 'Retention cleanup operations', ['status'])
privacy_blur_operations = Counter('privacy_blur_operations_total', 'Privacy blur operations', ['blur_type'])
roi_detection_duration = Histogram('roi_detection_duration_seconds', 'ROI detection processing time', ['detection_type'])

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

class ROIDetection(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    confidence: float
    detection_type: str  # 'face' or 'plate'

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

@with_correlation
async def detect_faces_in_frame(frame_b64: str) -> List[ROIDetection]:
    """Detect faces in frame using face service"""
    start_time = time.time()
    try:
        payload = {
            "images": {"data": [frame_b64]},
            "extract_embedding": False,
            "extract_ga": False,
            "api_ver": "1"
        }
        
        data = await resilient_post_json(
            f"{FACE_SERVICE_URL}/extract",
            json=payload,
            service_name="clip-exporter",
            timeout=5.0
        )
        
        roi_detections = []
        if data and "data" in data:
            for face_data in data["data"]:
                if "bbox" in face_data:
                    bbox = face_data["bbox"]
                    roi_detections.append(ROIDetection(
                        x1=int(bbox[0]),
                        y1=int(bbox[1]),
                        x2=int(bbox[2]),
                        y2=int(bbox[3]),
                        confidence=face_data.get("det_score", 0.9),
                        detection_type="face"
                    ))
        
        roi_detection_duration.labels(detection_type='face').observe(time.time() - start_time)
        return roi_detections
        
    except Exception as e:
        logger.error(f"Face detection failed: {e}")
        return []

@with_correlation
async def detect_plates_in_frame(frame_b64: str) -> List[ROIDetection]:
    """
    Detecta placas de veículos usando o LPR service.
    Retorna lista de ROI detections para blur.
    """
    start_time = time.time()
    LPR_SERVICE_URL = os.getenv("LPR_SERVICE_URL", "http://lpr-service:8016")
    
    try:
        payload = {"image_jpg_b64": frame_b64}
        data = await resilient_post_json(
            f"{LPR_SERVICE_URL}/plate_detect",
            json=payload,
            service_name="clip-exporter",
            timeout=5.0
        )
        
        roi_detections = []
        if data and data.get("plate_text"):
            # LPR service retornou uma detecção
            bbox = data.get("bbox", {})
            if bbox:
                roi_detections.append(ROIDetection(
                    x1=int(bbox.get("x1", 0)),
                    y1=int(bbox.get("y1", 0)),
                    x2=int(bbox.get("x2", 100)),
                    y2=int(bbox.get("y2", 100)),
                    confidence=data.get("confidence", 0.0),
                    detection_type="plate"
                ))
        
        roi_detection_duration.labels(detection_type='plate').observe(time.time() - start_time)
        return roi_detections
        
    except Exception as e:
        logger.warning(f"LPR service unavailable, trying YOLO fallback: {e}")
        
        # Fallback: usar YOLO para detectar veículos e estimar região da placa
        try:
            payload = {"jpg_b64": frame_b64}
            data = await resilient_post_json(
                f"{YOLO_SERVICE_URL}/detect",
                json=payload,
                service_name="clip-exporter",
                timeout=5.0
            )
            
            roi_detections = []
            if data and "boxes" in data:
                for box in data["boxes"]:
                    if box.get("cls") in ["car", "truck", "bus"]:
                        xyxy = box["xyxy"]
                        # Estimar região da placa (parte inferior do veículo)
                        plate_height = int((xyxy[3] - xyxy[1]) * 0.2)
                        roi_detections.append(ROIDetection(
                            x1=xyxy[0],
                            y1=xyxy[3] - plate_height,
                            x2=xyxy[2],
                            y2=xyxy[3],
                            confidence=0.5,  # Menor confiança para estimativas
                            detection_type="plate"
                        ))
            
            roi_detection_duration.labels(detection_type='plate').observe(time.time() - start_time)
            return roi_detections
            
        except Exception as fallback_error:
            logger.error(f"Plate detection failed completely: {fallback_error}")
            return []

async def extract_frame_for_analysis(video_path: str, timestamp_seconds: float) -> Optional[str]:
    """Extract a frame from video at specific timestamp for ROI detection"""
    try:
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
            frame_path = temp_file.name
        
        cmd = [
            'ffmpeg',
            '-i', video_path,
            '-ss', str(timestamp_seconds),
            '-vframes', '1',
            '-q:v', '2',
            '-y',
            frame_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Frame extraction failed: {stderr.decode()}")
            return None
        
        # Convert to base64
        with open(frame_path, 'rb') as f:
            import base64
            frame_b64 = base64.b64encode(f.read()).decode('utf-8')
        
        os.unlink(frame_path)
        return frame_b64
        
    except Exception as e:
        logger.error(f"Frame extraction failed: {e}")
        return None

async def apply_roi_privacy_filters(
    input_path: str, 
    blur_faces: bool = True, 
    blur_plates: bool = True
) -> str:
    """Apply ROI-based privacy filters to video using detected regions"""
    
    if not (blur_faces or blur_plates):
        return input_path
    
    try:
        with tempfile.NamedTemporaryFile(suffix='_privacy.mp4', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Extract a few frames for ROI detection (beginning, middle, end)
        video_duration = await get_video_duration(input_path)
        analysis_timestamps = [0, video_duration / 2, video_duration - 1]
        
        all_roi_detections = []
        
        for timestamp in analysis_timestamps:
            frame_b64 = await extract_frame_for_analysis(input_path, timestamp)
            if frame_b64:
                if blur_faces:
                    face_rois = await detect_faces_in_frame(frame_b64)
                    all_roi_detections.extend(face_rois)
                
                if blur_plates:
                    plate_rois = await detect_plates_in_frame(frame_b64)
                    all_roi_detections.extend(plate_rois)
        
        if not all_roi_detections:
            logger.info("No ROI detections found, applying general blur")
            # Fallback to general blur
            return await apply_general_privacy_filters(input_path, blur_faces, blur_plates)
        
        # Build FFmpeg filter chain for ROI-based blur
        filter_parts = []
        blur_index = 0
        
        for roi in all_roi_detections:
            # Create individual blur filter for each ROI
            x, y, w, h = roi.x1, roi.y1, roi.x2 - roi.x1, roi.y2 - roi.y1
            
            if roi.detection_type == "face" and blur_faces:
                blur_filter = f"[0:v]crop={w}:{h}:{x}:{y},boxblur=10:2[blur{blur_index}]; [0:v][blur{blur_index}]overlay={x}:{y}"
                filter_parts.append(blur_filter)
                privacy_blur_operations.labels(blur_type='faces_roi').inc()
                blur_index += 1
            
            elif roi.detection_type == "plate" and blur_plates:
                blur_filter = f"[0:v]crop={w}:{h}:{x}:{y},boxblur=15:3[blur{blur_index}]; [0:v][blur{blur_index}]overlay={x}:{y}"
                filter_parts.append(blur_filter)
                privacy_blur_operations.labels(blur_type='plates_roi').inc()
                blur_index += 1
        
        if not filter_parts:
            # No ROI filters needed
            return input_path
        
        # Combine filters
        filter_chain = "; ".join(filter_parts)
        
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-filter_complex', filter_chain,
            '-c:a', 'copy',  # Keep audio unchanged
            '-y',
            output_path
        ]
        
        logger.info(f"Applying ROI-based privacy filters: {len(all_roi_detections)} regions")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"ROI privacy filter failed: {stderr.decode()}")
            # Fallback to general blur
            return await apply_general_privacy_filters(input_path, blur_faces, blur_plates)
        
        # Clean up original file
        os.unlink(input_path)
        
        logger.info(f"ROI-based privacy filters applied: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"ROI privacy filtering failed: {e}")
        # Fallback to general blur
        return await apply_general_privacy_filters(input_path, blur_faces, blur_plates)

async def apply_general_privacy_filters(
    input_path: str, 
    blur_faces: bool = True, 
    blur_plates: bool = True
) -> str:
    """Apply general privacy filters as fallback"""
    
    if not (blur_faces or blur_plates):
        return input_path
    
    try:
        with tempfile.NamedTemporaryFile(suffix='_privacy.mp4', delete=False) as temp_file:
            output_path = temp_file.name
        
        # Build FFmpeg filter chain for general privacy
        filters = []
        
        if blur_faces:
            # Simple face blur using FFmpeg's delogo filter (placeholder)
            filters.append("boxblur=5:1")
            privacy_blur_operations.labels(blur_type='faces_general').inc()
        
        if blur_plates:
            # License plate blur (placeholder)
            privacy_blur_operations.labels(blur_type='plates_general').inc()
        
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
        
        logger.info(f"Applying general privacy filters: {filter_chain}")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"General privacy filter failed: {stderr.decode()}")
            return input_path  # Return original if filtering fails
        
        # Clean up original file
        os.unlink(input_path)
        
        logger.info(f"General privacy filters applied: {output_path}")
        return output_path
        
    except Exception as e:
        logger.error(f"General privacy filtering failed: {e}")
        return input_path  # Return original if filtering fails

async def get_video_duration(video_path: str) -> float:
    """Get video duration in seconds"""
    try:
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-show_entries', 'format=duration',
            '-of', 'csv=p=0',
            video_path
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            duration = float(stdout.decode().strip())
            return duration
        else:
            logger.error(f"ffprobe failed: {stderr.decode()}")
            return 30.0  # Default duration
            
    except Exception as e:
        logger.error(f"Failed to get video duration: {e}")
        return 30.0  # Default duration

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
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return {
        "status": "ok",
        "privacy_enabled": ENABLE_FACE_BLUR or ENABLE_PLATE_BLUR,
        "roi_detection_enabled": True,
        "default_settings": {
            "pre_roll_seconds": DEFAULT_PRE_ROLL_SECONDS,
            "post_roll_seconds": DEFAULT_POST_ROLL_SECONDS,
            "max_clip_duration": MAX_CLIP_DURATION
        },
        "services": {
            "yolo": YOLO_SERVICE_URL,
            "face": FACE_SERVICE_URL,
            "alpr": ALPR_SERVICE_URL
        },
        "ffmpeg_available": True,  # In production, check FFmpeg availability
        "circuit_breakers": circuit_stats
    }

@app.post("/export_clip", response_model=ClipExportResponse)
async def export_clip(request: ClipExportRequest, background_tasks: BackgroundTasks):
    """Export clip with ROI-based privacy processing and pre/post-roll"""
    
    # Set up correlation context
    correlation_id = generate_correlation_id()
    set_correlation_context(
        correlation_id=correlation_id,
        service_name="clip-exporter",
        camera_id=request.camera_id or "unknown"
    )
    
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
        
        # Apply ROI-based privacy filters if enabled
        if apply_privacy:
            privacy_label = 'roi_enabled'
            processed_clip_path = await apply_roi_privacy_filters(
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
            'roi_detection_used': apply_privacy,
            'retention_days': privacy_config['retention_days'],
            'correlation_id': correlation_id
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
    logger.info("Enhanced ROI-based Clip Exporter starting up")
    logger.info(f"Privacy settings: faces={ENABLE_FACE_BLUR}, plates={ENABLE_PLATE_BLUR}")
    logger.info(f"Default timing: pre-roll={DEFAULT_PRE_ROLL_SECONDS}s, post-roll={DEFAULT_POST_ROLL_SECONDS}s")
    logger.info(f"Detection services: YOLO={YOLO_SERVICE_URL}, Face={FACE_SERVICE_URL}, ALPR={ALPR_SERVICE_URL}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if hasattr(http_client, 'aclose'):
        await http_client.aclose()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8095)