import os
import base64
import json
import cv2
import numpy as np
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
from prometheus_client import start_http_server, generate_latest, CONTENT_TYPE_LATEST
import uvicorn
import logging

# Import unified metrics and events
import sys
sys.path.append('/common_schemas')
from common_schemas.metrics import FRAMES_IN, FRAMES_PROC, INFER_SEC, SIGNALS, init_service_metrics
from common_schemas.events import Signal, Incident, AnalysisResponse, create_signal, create_incident

try:
    from ppe_pipeline import SafetyVisionPipeline
    from yolo_client import get_yolo_client, cleanup_yolo_client
    PIPELINE_AVAILABLE = True
except ImportError as e:
    logger.warning(f"Pipeline modules not available: {e}")
    PIPELINE_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Settings
PORT = int(os.getenv("PORT", "8089"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
REQUEST_LOG_LEVEL = os.getenv("REQUEST_LOG_LEVEL", "info")

# SafetyVision specific settings
SAFETY_ENABLED = os.getenv("SAFETY_ENABLED", "true").lower() == "true" and PIPELINE_AVAILABLE
YOLO_SERVICE_URL = os.getenv("YOLO_SERVICE_URL", "http://yolo-detection:8080")
FALL_DETECTION_ENABLED = os.getenv("FALL_DETECTION_ENABLED", "true").lower() == "true"
POSE_ANALYSIS_ENABLED = os.getenv("POSE_ANALYSIS_ENABLED", "true").lower() == "true"

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Initialize safety pipeline
safety_pipeline = None
if SAFETY_ENABLED and PIPELINE_AVAILABLE:
    try:
        safety_pipeline = SafetyVisionPipeline(
            yolo_service_url=YOLO_SERVICE_URL,
            fall_detection_enabled=FALL_DETECTION_ENABLED,
            pose_analysis_enabled=POSE_ANALYSIS_ENABLED
        )
        logger.info("SafetyVision pipeline initialized")
    except Exception as e:
        logger.error(f"Failed to initialize SafetyVision pipeline: {e}")
        safety_pipeline = None

# Initialize service metrics
service_metrics = init_service_metrics('safetyvision')

# Start Prometheus metrics server
try:
    start_http_server(9090)
    logger.info("Prometheus metrics server started on port 9090")
except Exception as e:
    logger.warning(f"Could not start Prometheus server: {e}")

app = FastAPI(title="SafetyVision Service", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Models
class Track(BaseModel):
    track_id: str
    bbox: List[float] = Field(..., description="[x1,y1,x2,y2]")
    meta: Optional[Dict[str, Any]] = None

class AnalyzeFrameRequest(BaseModel):
    camera_id: Optional[str] = None
    org_id: Optional[str] = None
    zone_type: Optional[str] = "default"
    ts: Optional[datetime] = None
    frame_jpeg_b64: Optional[str] = None
    tracks: Optional[List[Track]] = None

class SignalOut(BaseModel):
    id: Optional[str] = None
    type: str
    severity: str
    track_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    ppe_type: Optional[str] = None
    risk_factors: Optional[List[str]] = None

class AnalyzeFrameResponse(BaseModel):
    signals: List[Dict[str, Any]] = []  # Will be converted to Signal format
    incidents: List[Dict[str, Any]] = [] # Will be converted to Incident format
    telemetry: List[Dict[str, Any]] = []

# Utils
def decode_image_if_any(b64: Optional[str]) -> Optional[np.ndarray]:
    if not b64:
        return None
    try:
        raw = base64.b64decode(b64)
        nparr = np.frombuffer(raw, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return frame
    except Exception as e:
        logger.error(f"Failed to decode image: {e}")
        return None

@app.get("/health")
def health():
    health_data = {
        "status": "ok",
        "service": "safetyvision", 
        "version": "0.2.0",
        "safety_enabled": SAFETY_ENABLED,
        "pipeline_ready": safety_pipeline is not None,
        "yolo_service_url": YOLO_SERVICE_URL,
        "features": {
            "fall_detection": FALL_DETECTION_ENABLED,
            "pose_analysis": POSE_ANALYSIS_ENABLED
        }
    }
    
    if PIPELINE_AVAILABLE and safety_pipeline:
        try:
            yolo_client = get_yolo_client()
            health_data["cache_stats"] = yolo_client.get_cache_stats()
        except:
            pass
    
    return health_data

@app.get("/metrics")
def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/analyze_frame", response_model=AnalysisResponse)
async def analyze_frame(req: AnalyzeFrameRequest):
    """Analyze frame for safety violations"""
    
    with INFER_SEC.labels(
        service='safetyvision', 
        org_id=req.org_id or 'unknown',
        camera_id=req.camera_id or 'unknown',
        model_name='safety_pipeline',
        model_version='v1'
    ).time():
        # Update metrics
        FRAMES_IN.labels(
            service='safetyvision',
            camera_id=req.camera_id or 'unknown',
            org_id=req.org_id or 'unknown'
        ).inc()
        
        signals: List[Signal] = []
        incidents: List[Incident] = []
        telemetry: List[Dict[str, Any]] = []
        
        # Try advanced pipeline first
        if safety_pipeline and req.frame_jpeg_b64 and req.tracks:
            try:
                frame = decode_image_if_any(req.frame_jpeg_b64)
                if frame is not None:
                    # Convert tracks to expected format
                    track_data = []
                    for track in req.tracks:
                        track_info = {
                            'track_id': track.track_id,
                            'bbox': track.bbox,
                            'confidence': track.meta.get('confidence', 0.8) if track.meta else 0.8
                        }
                        track_data.append(track_info)
                    
                    # Run safety analysis
                    pipeline_signals = await safety_pipeline.process_frame(
                        frame, track_data,
                        camera_id=req.camera_id or 'unknown',
                        org_id=req.org_id or 'unknown', 
                        zone_type=req.zone_type or 'default',
                        timestamp=req.ts
                    )
                    
                    # Convert to standardized Signal format
                    for sig in pipeline_signals:
                        signal = create_signal(
                            service='safetyvision',
                            camera_id=req.camera_id or 'unknown',
                            org_id=req.org_id or 'unknown',
                            signal_type=f"ppe.{sig['type']}" if 'ppe' in sig['type'] else f"safety.{sig['type']}",
                            severity=sig['severity'],
                            details=sig.get('details', {}),
                            track_id=sig.get('track_id'),
                            confidence=sig.get('confidence')
                        )
                        signals.append(signal)
                        
                        # Update standardized metrics
                        SIGNALS.labels(
                            service='safetyvision',
                            org_id=req.org_id or 'unknown',
                            camera_id=req.camera_id or 'unknown',
                            type=signal.type,
                            severity=signal.severity
                        ).inc()
                    
                    FRAMES_PROC.labels(
                        service='safetyvision',
                        camera_id=req.camera_id or 'unknown',
                        org_id=req.org_id or 'unknown'
                    ).inc()
            except Exception as e:
                logger.error(f"Advanced pipeline failed: {e}")
        
        # Fallback: basic rule-based detection
        if not signals and req.zone_type:
            # Simple zone-based PPE requirement
            if req.zone_type in ['construction', 'industrial']:
                # Create standardized PPE violation signal
                signal = create_signal(
                    service='safetyvision',
                    camera_id=req.camera_id or 'unknown',
                    org_id=req.org_id or 'unknown',
                    signal_type='ppe.missing',
                    severity='HIGH',
                    details={
                        'required_ppe': ['hardhat', 'vest'], 
                        'zone': req.zone_type,
                        'ppe_type': 'hardhat'
                    },
                    track_id=req.tracks[0].track_id if req.tracks else 'unknown'
                )
                signals.append(signal)
                
                SIGNALS.labels(
                    service='safetyvision',
                    org_id=req.org_id or 'unknown',
                    camera_id=req.camera_id or 'unknown',
                    type='ppe.missing',
                    severity='HIGH'
                ).inc()
        
        # Create incidents from signals
        for signal in signals:
            incident = create_incident(
                service='safetyvision',
                camera_id=signal.camera_id,
                org_id=signal.org_id,
                incident_type=signal.type,
                severity=signal.severity,
                aggregation_key=f"safety:{signal.type}:{signal.camera_id}:{signal.track_id or 'none'}"
            )
            incidents.append(incident)
        
        # Generate telemetry
        if req.tracks:
            for track in req.tracks:
                telemetry.append({
                    "track_id": track.track_id,
                    "safety_processed": len(signals) > 0,
                    "pipeline_used": safety_pipeline is not None,
                    "bbox": track.bbox
                })
    
    # Convert to response format
    return AnalysisResponse(
        signals=[signal.dict() for signal in signals],
        incidents=[incident.dict() for incident in incidents],
        telemetry={"tracks": telemetry}
    )

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    if PIPELINE_AVAILABLE:
        try:
            await cleanup_yolo_client()
        except:
            pass
    logger.info("SafetyVision service shutdown complete")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
