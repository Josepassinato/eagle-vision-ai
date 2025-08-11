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
    from inference_pipeline import EmotionPipeline, FaceROI
    from settings import *
    PIPELINE_AVAILABLE = True
except ImportError as e:
    logging.warning(f"Pipeline modules not available: {e}")
    PIPELINE_AVAILABLE = False
    # Fallback settings
    PORT = int(os.getenv("PORT", "8087"))
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
    EMOTION_MODEL_PATH = os.getenv("EMOTION_MODEL_PATH", "/models/emotion_model.onnx")
    EDU_AFFECT_EMA_ALPHA = float(os.getenv("EDU_AFFECT_EMA_ALPHA", "0.1"))
    EDU_AFFECT_MIN_QUALITY = float(os.getenv("EDU_AFFECT_MIN_QUALITY", "0.7"))
    EDU_NOTIFY_MIN_SEVERITY = os.getenv("EDU_NOTIFY_MIN_SEVERITY", "HIGH")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Initialize emotion pipeline
emotion_pipeline = EmotionPipeline(
    model_path=EMOTION_MODEL_PATH,
    ema_alpha=EDU_AFFECT_EMA_ALPHA,
    hysteresis_threshold=5
)

# Prometheus metrics
affect_infer_seconds = Histogram('affect_infer_seconds', 'Time spent on emotion inference')
affect_events_total = Counter('affect_events_total', 'Total affect events generated', ['event_type', 'severity'])
affect_quality_below_threshold_total = Counter('affect_quality_below_threshold_total', 'Faces below quality threshold')

# Start Prometheus metrics server
try:
    start_http_server(9090)
    logger.info("Prometheus metrics server started on port 9090")
except Exception as e:
    logger.warning(f"Could not start Prometheus server: {e}")

app = FastAPI(title="EduBehavior Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Cache for policies
policy_cache = {}
policy_cache_timeout = datetime.now()

# ---------- Models ----------
class Track(BaseModel):
    track_id: str
    bbox: List[float] = Field(..., description="[x1,y1,x2,y2]")
    meta: Optional[Dict[str, Any]] = None

class AnalyzeFrameRequest(BaseModel):
    class_id: str
    camera_id: Optional[str] = None
    ts: Optional[datetime] = None
    frame_jpeg_b64: Optional[str] = None
    tracks: Optional[List[Track]] = None

class SignalOut(BaseModel):
    id: Optional[str] = None
    type: str
    severity: str
    student_id: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    frame_url: Optional[str] = None
    affect_probs: Optional[Dict[str, float]] = None
    affect_state: Optional[str] = None

class AnalyzeFrameResponse(BaseModel):
    signals: List[SignalOut] = []
    incidents: List[Dict[str, Any]] = []
    telemetry: List[Dict[str, Any]] = []

class ReviewRequest(BaseModel):
    incident_id: str
    reviewer_user_id: str
    decision: str
    notes: Optional[str] = None

# ---------- Utils ----------
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

async def get_class_policies(class_id: str) -> Dict[str, Any]:
    """Get policies for class with caching"""
    global policy_cache, policy_cache_timeout
    
    # Check cache (5 minute TTL)
    cache_key = f"class_{class_id}"
    now = datetime.now()
    if cache_key in policy_cache and (now - policy_cache_timeout).total_seconds() < 300:
        return policy_cache[cache_key]
    
    try:
        # Fetch from database
        res = supabase.table("edu_policies").select("*").eq("class_id", class_id).execute()
        
        if res.data and len(res.data) > 0:
            policies = res.data[0]["thresholds"]
        else:
            # Default policies
            policies = {
                "emotion_confidence_threshold": 0.65,
                "attention_threshold": 0.55,
                "aggression_threshold": 0.85,
                "distress_threshold": 0.75,
                "disengagement_threshold": 0.25,
                "incident_window_minutes": 6,
                "min_signals_for_incident": 4
            }
        
        # Update cache
        policy_cache[cache_key] = policies
        policy_cache_timeout = now
        
        return policies
        
    except Exception as e:
        logger.error(f"Failed to fetch policies for class {class_id}: {e}")
        # Return defaults on error
        return {
            "emotion_confidence_threshold": 0.65,
            "attention_threshold": 0.55,
            "aggression_threshold": 0.85,
            "distress_threshold": 0.75,
            "disengagement_threshold": 0.25,
            "incident_window_minutes": 6,
            "min_signals_for_incident": 4
        }

# ---------- Persistence ----------
SEVERITY_ORDER = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

def should_notify(sev: str) -> bool:
    return SEVERITY_ORDER.get(sev, 0) >= SEVERITY_ORDER.get(EDU_NOTIFY_MIN_SEVERITY, 3)

async def insert_signal(payload: AnalyzeFrameRequest, sig: SignalOut) -> Optional[str]:
    row = {
        "class_id": payload.class_id,
        "student_id": sig.student_id,
        "camera_id": payload.camera_id,
        "type": sig.type,
        "severity": sig.severity,
        "details": sig.details,
        "frame_url": sig.frame_url,
        "affect_probs": sig.affect_probs,
        "affect_state": sig.affect_state,
    }
    res = supabase.table("edu_signals").insert(row).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]["id"]
    return None

async def upsert_incident(payload: AnalyzeFrameRequest, sig: SignalOut) -> Optional[str]:
    # Simple aggregation by (class,type,student) within short window could be added later
    inc = {
        "class_id": payload.class_id,
        "severity": sig.severity,
        "status": "pending_review",
        "student_id": sig.student_id,
        "aggregation_key": f"{payload.class_id}:{sig.type}:{sig.student_id or 'anon'}",
        "signals_count": 1,
    }
    res = supabase.table("edu_incidents").insert(inc).execute()
    if res.data and len(res.data) > 0:
        return res.data[0]["id"]
    return None

# ---------- API ----------
@app.get("/health")
def health():
    return {
        "status": "ok", 
        "service": "edubehavior",
        "pipeline_ready": emotion_pipeline.emotion_model.session is not None,
        "model_path": EMOTION_MODEL_PATH,
        "ema_alpha": EDU_AFFECT_EMA_ALPHA,
        "min_quality": EDU_AFFECT_MIN_QUALITY,
        "active_students": len(emotion_pipeline.student_states)
    }

@app.get("/metrics")
def metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/analyze_frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(req: AnalyzeFrameRequest):
    """Analyze frame for emotional and behavioral signals"""
    
    with affect_infer_seconds.time():
        # Decode frame
        frame = decode_image_if_any(req.frame_jpeg_b64)
        if frame is None and req.tracks:
            logger.warning("No frame provided but tracks available - using placeholder")
            frame = np.zeros((480, 640, 3), dtype=np.uint8)  # Placeholder frame
        
        signals: List[SignalOut] = []
        telemetry: List[Dict[str, Any]] = []
        
        # Get class policies
        policies = await get_class_policies(req.class_id)
        
        # Process tracks with faces
        if req.tracks and frame is not None:
            # Convert tracks to face format for pipeline
            faces = []
            for track in req.tracks:
                face_data = {
                    'bbox': track.bbox,
                    'confidence': track.meta.get('confidence', 0.8) if track.meta else 0.8,
                    'track_id': track.track_id,
                    'student_id': track.meta.get('student_id') if track.meta else None
                }
                faces.append(face_data)
            
            try:
                # Run emotion pipeline
                pipeline_signals = emotion_pipeline.process_frame(
                    frame, faces, req.class_id, req.ts
                )
                
                # Convert pipeline signals to API format
                for sig in pipeline_signals:
                    # Check quality threshold
                    if sig.get('quality', 1.0) < EDU_AFFECT_MIN_QUALITY:
                        affect_quality_below_threshold_total.inc()
                        continue
                    
                    # Apply policy thresholds
                    if sig['type'] == 'distress' and sig.get('confidence', 1.0) < policies.get('distress_threshold', 0.75):
                        continue
                    elif sig['type'] == 'disengagement' and sig.get('confidence', 1.0) < policies.get('disengagement_threshold', 0.25):
                        continue
                    elif sig['type'] == 'high_attention' and sig.get('confidence', 1.0) < policies.get('attention_threshold', 0.55):
                        continue
                    
                    signal_out = SignalOut(
                        type=sig['type'],
                        severity=sig['severity'],
                        student_id=sig.get('student_id'),
                        details=sig.get('details', {}),
                        affect_probs=sig.get('affect_probs'),
                        affect_state=sig.get('affect_state')
                    )
                    
                    signals.append(signal_out)
                    
                    # Update metrics
                    affect_events_total.labels(
                        event_type=sig['type'], 
                        severity=sig['severity']
                    ).inc()
                
                # Generate telemetry for each student
                for student_id, state in emotion_pipeline.student_states.items():
                    if student_id in [f.get('student_id') or f.get('track_id') for f in faces]:
                        telemetry.append({
                            'student_id': student_id,
                            'track_id': state.track_id,
                            'engagement_ema': round(state.engagement_ema, 3),
                            'valence_ema': round(state.valence_ema, 3),
                            'arousal_ema': round(state.arousal_ema, 3),
                            'quality_avg': round(np.mean(list(state.quality_history)) if state.quality_history else 0.0, 3),
                            'last_emotion': state.emotion_history[-1]['emotion'] if state.emotion_history else 'unknown'
                        })
                        
            except Exception as e:
                logger.error(f"Pipeline processing failed: {e}")
        
        # Persist signals
        incidents: List[Dict[str, Any]] = []
        for s in signals:
            try:
                sid = await insert_signal(req, s)
                inc_id = await upsert_incident(req, s)
                s.id = sid
                incidents.append({"incident_id": inc_id, "severity": s.severity, "type": s.type})
            except Exception as e:
                logger.error(f"Failed to persist signal: {e}")
    
    return AnalyzeFrameResponse(signals=signals, incidents=incidents, telemetry=telemetry)

@app.post("/review")
async def review(req: ReviewRequest):
    # Update incident status to ack and store review row
    upd = supabase.table("edu_incidents").update({"status": "ack"}).eq("id", req.incident_id).execute()
    if upd.error:
        raise HTTPException(status_code=400, detail=str(upd.error))
    rev = supabase.table("edu_reviews").insert({
        "incident_id": req.incident_id,
        "reviewer_user_id": req.reviewer_user_id,
        "decision": req.decision,
        "notes": req.notes
    }).execute()
    if rev.error:
        raise HTTPException(status_code=400, detail=str(rev.error))
    return {"status": "ack"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
