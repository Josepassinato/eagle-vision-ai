#!/usr/bin/env python3
"""
Fusion API - Serviço de fusão temporal confiável
Integra YOLO, Face, Re-ID, Tracking com janelas temporais e explain payload
"""

import os
import logging
import time
import asyncio
import json
import base64
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any, Tuple
from io import BytesIO

import uvicorn
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from prometheus_client import Histogram, Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST

from resilient_http_service import ResilientServiceCaller
from temporal_fusion import get_fusion_engine, TemporalFusionEngine
import sys
sys.path.append('/vision_tracking')
sys.path.append('/common_schemas')
from tracker import VisionTracker
from motion import MotionAnalyzer
from http_resilient import ResilientHTTPClient, RetryConfig
from correlation_logger import get_correlation_logger, generate_correlation_id

# Configuração com janelas temporais e pesos
FACE_URL = os.getenv("FACE_URL", "http://face-service:18080")
REID_URL = os.getenv("REID_URL", "http://reid-service:18070")
MULTI_TRACKER_URL = os.getenv("MULTI_TRACKER_URL", "http://multi-tracker:8087")
SUPABASE_INGEST_URL = os.getenv("SUPABASE_INGEST_URL")
NOTIFIER_URL = os.getenv("NOTIFIER_URL", "http://notifier:8086")
CLIP_EXPORTER_URL = os.getenv("CLIP_EXPORTER_URL", "http://clip-exporter:8095")

# Temporal windows and weights for fusion decision
FACE_WINDOW_SECONDS = float(os.getenv("FACE_WINDOW_SECONDS", "3.0"))
REID_WINDOW_SECONDS = float(os.getenv("REID_WINDOW_SECONDS", "5.0"))
DETECTOR_WINDOW_SECONDS = float(os.getenv("DETECTOR_WINDOW_SECONDS", "2.0"))

# Signal weights for temporal fusion
FACE_WEIGHT = float(os.getenv("FACE_WEIGHT", "0.6"))
REID_WEIGHT = float(os.getenv("REID_WEIGHT", "0.3"))
DETECTOR_WEIGHT = float(os.getenv("DETECTOR_WEIGHT", "0.1"))

# Decision thresholds
T_FACE = float(os.getenv("T_FACE", "0.75"))
T_REID = float(os.getenv("T_REID", "0.85"))
T_MOVE = float(os.getenv("T_MOVE", "5.0"))
N_FRAMES = int(os.getenv("N_FRAMES", "3"))  # Required confirmed frames

# Timeouts and retries for external services
FACE_TIMEOUT = float(os.getenv("FACE_TIMEOUT", "1.0"))
REID_TIMEOUT = float(os.getenv("REID_TIMEOUT", "1.2"))
MULTI_TRACKER_TIMEOUT = float(os.getenv("MULTI_TRACKER_TIMEOUT", "0.8"))

# Retry configuration
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BASE_DELAY = float(os.getenv("RETRY_BASE_DELAY", "0.1"))

# Circuit breaker configuration
CIRCUIT_FAILURE_THRESHOLD = int(os.getenv("CIRCUIT_FAILURE_THRESHOLD", "5"))
CIRCUIT_RECOVERY_TIMEOUT = float(os.getenv("CIRCUIT_RECOVERY_TIMEOUT", "30.0"))

# URLs dos serviços
YOLO_URL = os.getenv("YOLO_URL", "http://yolo-detection:18060")

app = FastAPI(title="Fusion API - Temporal Decision", version="2.0.0")

# Prometheus metrics with decision latency percentiles
fusion_infer_seconds = Histogram('fusion_inference_duration_seconds', 'Fusion inference time by stage', ['stage'])
fusion_similarity_face = Histogram('fusion_face_similarity', 'Face similarity scores', buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0])
fusion_similarity_reid = Histogram('fusion_reid_similarity', 'Re-ID similarity scores', buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0])
fusion_decisions_total = Counter('fusion_decisions_total', 'Fusion decisions by reason', ['reason'])
fusion_frame_processing_seconds = Histogram('fusion_frame_processing_seconds', 'Total frame processing time')

# Decision latency with percentiles (p50, p95, p99)
decision_latency_ms = Histogram(
    'fusion_decision_latency_milliseconds', 
    'Decision making latency',
    ['signal_type', 'decision_reason'],
    buckets=[1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
)

# Decision counters by rule/reason
decision_outcomes = Counter(
    'fusion_decision_outcomes_total',
    'Decision outcomes by rule and reason',
    ['rule', 'reason', 'signal_source']
)

# External service metrics
service_call_duration = Histogram('fusion_service_call_duration_seconds', 'External service call duration', ['service', 'operation'])
service_call_failures = Counter('fusion_service_call_failures_total', 'External service call failures', ['service', 'error_type'])
service_circuit_breaker_state = Gauge('fusion_service_circuit_breaker_open', 'Circuit breaker state (1=open)', ['service'])

# Temporal window metrics
temporal_window_signals = Counter('fusion_temporal_window_signals_total', 'Signals collected in temporal windows', ['signal_type'])
temporal_fusion_scores = Histogram('fusion_temporal_fusion_scores', 'Weighted temporal fusion scores', ['fusion_type'])

# Global instances
vision_tracker = VisionTracker()
motion_analyzer = MotionAnalyzer()
fusion_engine = get_fusion_engine()

# Resilient HTTP clients for external services
face_client = ResilientHTTPClient(
    service_name="face-service",
    base_timeout=FACE_TIMEOUT,
    retry_config=RetryConfig(max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY)
)

reid_client = ResilientHTTPClient(
    service_name="reid-service", 
    base_timeout=REID_TIMEOUT,
    retry_config=RetryConfig(max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY)
)

multi_tracker_client = ResilientHTTPClient(
    service_name="multi-tracker",
    base_timeout=MULTI_TRACKER_TIMEOUT,
    retry_config=RetryConfig(max_retries=MAX_RETRIES, base_delay=RETRY_BASE_DELAY)
)

logger = get_correlation_logger('fusion')

# Data models com explain payload
class IngestFrameRequest(BaseModel):
    camera_id: str
    ts: float
    jpg_b64: str

class EventResponse(BaseModel):
    camera_id: str
    person_id: str
    reason: str
    face_similarity: Optional[float] = None
    reid_similarity: Optional[float] = None
    frames_confirmed: int
    movement_px: float
    ts: str
    # Explain payload with detailed decision information
    explain: Optional[Dict[str, Any]] = None

class IngestFrameResponse(BaseModel):
    events: List[EventResponse]

class DecisionExplain:
    """Generate detailed explanation for fusion decisions"""
    
    @staticmethod
    def create_explain_payload(
        decision_reason: str,
        fusion_data: Dict[str, Any],
        thresholds: Dict[str, float],
        track_info: Dict[str, Any],
        processing_times: Dict[str, float]
    ) -> Dict[str, Any]:
        """Create comprehensive explain payload for decision transparency"""
        
        current_time = time.time()
        
        explain = {
            'decision_timestamp': datetime.fromtimestamp(current_time, timezone.utc).isoformat(),
            'decision_reason': decision_reason,
            'fusion_method': 'temporal_weighted',
            
            # Fusion scores and weights
            'fusion_score': fusion_data.get('weighted_score', 0.0),
            'temporal_consistency': fusion_data.get('temporal_consistency', 0.0),
            'total_weight': fusion_data.get('total_weight', 0.0),
            
            # Signal contributions
            'signal_contributions': fusion_data.get('signal_contributions', {}),
            'signal_counts': fusion_data.get('signal_counts', {}),
            'best_signals': fusion_data.get('best_signals', {}),
            
            # Thresholds applied
            'thresholds': thresholds,
            
            # Track information
            'track_info': {
                'track_id': track_info.get('track_id'),
                'frames_confirmed': track_info.get('frames_confirmed', 0),
                'movement_px': track_info.get('movement_px', 0.0),
                'track_age': track_info.get('age', 0),
                'hit_streak': track_info.get('hit_streak', 0)
            },
            
            # Processing performance
            'processing_times_ms': processing_times,
            'total_processing_time_ms': sum(processing_times.values()),
            
            # Decision rules applied
            'rules_evaluated': [],
            'rules_passed': [],
            'rules_failed': []
        }
        
        # Populate decision rules
        if decision_reason == 'face':
            explain['rules_evaluated'] = ['face_similarity_threshold', 'confirmed_frames_threshold']
            if fusion_data.get('signal_contributions', {}).get('face', {}).get('score', 0) >= thresholds.get('face', 0.75):
                explain['rules_passed'].append('face_similarity_threshold')
            else:
                explain['rules_failed'].append('face_similarity_threshold')
                
        elif decision_reason == 'reid+motion':
            explain['rules_evaluated'] = ['reid_similarity_threshold', 'movement_threshold', 'confirmed_frames_threshold']
            # Add rule evaluation results based on actual values
            
        return explain

# Utility functions
def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decode base64 to numpy array"""
    if ',' in b64_string:
        b64_string = b64_string.split(',')[1]
    
    image_bytes = base64.b64decode(b64_string)
    image = Image.open(BytesIO(image_bytes))
    return np.array(image.convert("RGB"))

def crop_image(img: np.ndarray, xyxy: List[float]) -> np.ndarray:
    """Crop image using bbox [x1, y1, x2, y2]"""
    x1, y1, x2, y2 = map(int, xyxy)
    return img[y1:y2, x1:x2]

def encode_image_b64(img: np.ndarray) -> str:
    """Convert numpy array to base64 JPEG"""
    pil_img = Image.fromarray(img)
    buffer = BytesIO()
    pil_img.save(buffer, format="JPEG", quality=85)
    return base64.b64encode(buffer.getvalue()).decode()

async def send_to_ingest_event(event_data: Dict) -> Optional[int]:
    """Send event to Supabase with resilient HTTP"""
    # Implementation would use resilient HTTP client
    # For now, return a mock event ID
    return 12345

async def send_to_notifier(event_data: Dict, jpg_b64: Optional[str] = None) -> bool:
    """Send to notifier service"""
    return True

async def call_service_with_retry(url: str, payload: Dict, headers: Dict, service_name: str) -> Optional[Dict]:
    """Legacy function - replaced by resilient HTTP clients"""
    return None

@app.get("/health")
async def health_check():
    """Health check with service status"""
    return {
        "status": "ok",
        "fusion_engine": "temporal_weighted",
        "temporal_windows": {
            "face": FACE_WINDOW_SECONDS,
            "reid": REID_WINDOW_SECONDS,
            "detector": DETECTOR_WINDOW_SECONDS
        },
        "signal_weights": {
            "face": FACE_WEIGHT,
            "reid": REID_WEIGHT,
            "detector": DETECTOR_WEIGHT
        },
        "thresholds": {
            "face": T_FACE,
            "reid": T_REID,
            "movement": T_MOVE,
            "confirmed_frames": N_FRAMES
        }
    }

@app.post("/ingest_frame", response_model=IngestFrameResponse)
async def ingest_frame(request: IngestFrameRequest):
    """Main temporal fusion processing pipeline with explain payload"""
    
    correlation_id = generate_correlation_id()
    start_time = time.time()
    events = []
    
    try:
        # Decode image
        img = decode_base64_image(request.jpg_b64)
        
        # 1. YOLO Detection 
        with fusion_infer_seconds.labels(stage="yolo").time():
            yolo_payload = {"jpg_b64": request.jpg_b64}
            # Mock YOLO result for now
            detections = [{"x1": 100, "y1": 100, "x2": 200, "y2": 300, "confidence": 0.9}]
        
        # Extract bboxes for tracker
        boxes_xyxy = [[det["x1"], det["y1"], det["x2"], det["y2"]] for det in detections]
        
        # 2. Update tracker
        with fusion_infer_seconds.labels(stage="tracking").time():
            track_ids = vision_tracker.update(request.camera_id, boxes_xyxy)
        
        # 3. Process each detection with temporal fusion
        for i, (detection, track_id) in enumerate(zip(detections, track_ids)):
            decision_start_time = time.time()
            processing_times = {}
            
            bbox = [detection["x1"], detection["y1"], detection["x2"], detection["y2"]]
            
            # Update movement
            move_px = motion_analyzer.update_and_displacement(request.camera_id, track_id, bbox)
            frames_confirmed = vision_tracker.frames_confirmed(request.camera_id, track_id)
            
            # Get track info for explain payload
            track_info = vision_tracker.get_track_info(request.camera_id, track_id) or {}
            track_info.update({'movement_px': move_px, 'frames_confirmed': frames_confirmed})
            
            # Skip if not enough confirmed frames
            if frames_confirmed < N_FRAMES:
                logger.debug(f"Track {track_id} skipped: only {frames_confirmed}/{N_FRAMES} confirmed frames")
                continue
            
            # Crop body
            crop_body = crop_image(img, bbox)
            crop_b64 = encode_image_b64(crop_body)

            # Variables for decision
            face_sim = None
            reid_sim = None
            person_id = None
            reason = None
            
            # 4. Face recognition with timeout/retry
            face_processing_start = time.time()
            if crop_body.shape[0] > 50 and crop_body.shape[1] > 50:
                try:
                    with service_call_duration.labels(service="face", operation="extract").time():
                        face_payload = {"jpg_b64": crop_b64}
                        face_result = await face_client.post(
                            f"{FACE_URL}/extract",
                            json=face_payload
                        )
                    
                    if face_result and len(face_result) > 0 and "embedding" in face_result[0]:
                        # Mock face similarity for demonstration
                        face_sim = 0.85
                        fusion_similarity_face.observe(face_sim)
                        
                        # Add to temporal fusion
                        fusion_engine.add_signal(
                            request.camera_id, track_id, 'face', face_sim,
                            metadata={'source': 'face_service', 'match_id': 'person_123'},
                            source='face_service'
                        )
                        
                        temporal_window_signals.labels(signal_type='face').inc()
                        
                except Exception as e:
                    service_call_failures.labels(service="face", error_type="service_error").inc()
                    logger.warning(f"Face service call failed: {e}")
                    
            processing_times['face_ms'] = (time.time() - face_processing_start) * 1000
            
            # 5. Re-ID with timeout/retry
            reid_processing_start = time.time()
            try:
                with service_call_duration.labels(service="reid", operation="match").time():
                    reid_payload = {"jpg_b64": crop_b64}
                    reid_result = await reid_client.post(
                        f"{REID_URL}/match",
                        json=reid_payload
                    )
                
                if reid_result and "results" in reid_result and reid_result["results"]:
                    reid_sim = reid_result["results"][0]["similarity"]
                    fusion_similarity_reid.observe(reid_sim)
                    
                    # Add to temporal fusion
                    fusion_engine.add_signal(
                        request.camera_id, track_id, 'reid', reid_sim,
                        metadata={'source': 'reid_service', 'match_id': reid_result["results"][0]["id"]},
                        source='reid_service'
                    )
                    
                    temporal_window_signals.labels(signal_type='reid').inc()
                    
            except Exception as e:
                service_call_failures.labels(service="reid", error_type="service_error").inc()
                logger.warning(f"ReID service call failed: {e}")
                
            processing_times['reid_ms'] = (time.time() - reid_processing_start) * 1000
            
            # Add detector signal
            fusion_engine.add_signal(
                request.camera_id, track_id, 'detector', detection.get("confidence", 0.9),
                metadata={'bbox': bbox, 'yolo_confidence': detection.get("confidence")},
                source='yolo_detector'
            )
            temporal_window_signals.labels(signal_type='detector').inc()
            
            # 6. Temporal fusion decision with weighted scores
            fusion_start_time = time.time()
            fusion_data = fusion_engine.compute_weighted_fusion_score(
                request.camera_id, track_id, ['face', 'reid', 'detector']
            )
            processing_times['fusion_ms'] = (time.time() - fusion_start_time) * 1000
            
            # Decision thresholds for explain payload
            thresholds = {
                'face': T_FACE,
                'reid': T_REID,
                'movement': T_MOVE,
                'confirmed_frames': N_FRAMES,
                'weighted_fusion': 0.7  # Minimum weighted score threshold
            }
            
            # Decision logic with temporal fusion
            decision_reason = None
            
            # Check face-based decision
            face_contrib = fusion_data.get('signal_contributions', {}).get('face', {})
            if face_contrib and face_contrib.get('score', 0) >= T_FACE:
                person_id = face_contrib.get('source', 'person_123')
                decision_reason = 'face'
                reason = 'face'
                decision_outcomes.labels(rule='face_threshold', reason='face_similarity', signal_source='face').inc()
                
            # Check reid+motion decision
            elif fusion_data.get('weighted_score', 0) >= thresholds['weighted_fusion']:
                reid_contrib = fusion_data.get('signal_contributions', {}).get('reid', {})
                if reid_contrib and reid_contrib.get('score', 0) >= T_REID and move_px >= T_MOVE:
                    person_id = reid_contrib.get('source', 'person_456')
                    decision_reason = 'reid+motion'
                    reason = 'reid+motion'
                    decision_outcomes.labels(rule='reid_motion_fusion', reason='weighted_score', signal_source='reid').inc()
            
            # Record decision latency
            decision_time_ms = (time.time() - decision_start_time) * 1000
            if decision_reason:
                decision_latency_ms.labels(
                    signal_type=decision_reason.split('+')[0], 
                    decision_reason=decision_reason
                ).observe(decision_time_ms)
            
            # 7. If confirmed identification, create event with explain payload
            if person_id and decision_reason:
                ts_iso = datetime.fromtimestamp(request.ts, timezone.utc).isoformat()

                # Resolve global identity in multi-tracker with timeout/retry
                multi_tracker_start = time.time()
                try:
                    with service_call_duration.labels(service="multi-tracker", operation="resolve").time():
                        resolve_req = {
                            "camera_id": request.camera_id,
                            "ts": ts_iso,
                            "jpg_b64": crop_b64,
                            "prelim_person_id": person_id,
                            "face_similarity": face_sim,
                            "reid_similarity": reid_sim,
                        }
                        resolve_res = await multi_tracker_client.post(
                            f"{MULTI_TRACKER_URL}/resolve",
                            json=resolve_req
                        )
                        
                        if resolve_res and resolve_res.get("global_person_id"):
                            person_id = resolve_res["global_person_id"]
                            
                except Exception as e:
                    service_call_failures.labels(service="multi-tracker", error_type="resolve_error").inc()
                    logger.warning(f"multi-tracker resolve failed: {e}")

                processing_times['multi_tracker_ms'] = (time.time() - multi_tracker_start) * 1000

                # Generate explain payload
                explain_payload = DecisionExplain.create_explain_payload(
                    decision_reason=decision_reason,
                    fusion_data=fusion_data,
                    thresholds=thresholds,
                    track_info=track_info,
                    processing_times=processing_times
                )

                event_data = {
                    "camera_id": request.camera_id,
                    "person_id": person_id,
                    "reason": reason,
                    "face_similarity": face_sim,
                    "reid_similarity": reid_sim,
                    "frames_confirmed": frames_confirmed,
                    "movement_px": move_px,
                    "ts": ts_iso,
                    "explain": explain_payload
                }
                
                # Send to Supabase
                event_id = await send_to_ingest_event(event_data)
                
                if event_id:
                    events.append(EventResponse(**event_data))
                    fusion_decisions_total.labels(reason=decision_reason).inc()
                    
                    # Send to Notifier asynchronously
                    asyncio.create_task(send_to_notifier(event_data, crop_b64))
                    
                    logger.info(
                        f"Event confirmed: track_id={track_id}, person_id={person_id}, "
                        f"reason={decision_reason}, weighted_score={fusion_data.get('weighted_score', 0):.3f}, "
                        f"face_sim={face_sim}, reid_sim={reid_sim}, frames={frames_confirmed}, "
                        f"move_px={move_px:.2f}, decision_time={decision_time_ms:.1f}ms"
                    )
        
        # Cleanup old tracks from fusion engine
        active_track_ids = [tid for tid in track_ids if tid > 0]
        fusion_engine.cleanup_old_tracks(request.camera_id, active_track_ids)
        
        total_time = time.time() - start_time
        fusion_frame_processing_seconds.observe(total_time)
        logger.info(f"Frame processed in {total_time:.3f}s, {len(events)} events generated")
        
        return IngestFrameResponse(events=events)
        
    except Exception as e:
        logger.error(f"Error processing frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def metrics():
    """Métricas Prometheus com latências de decisão"""
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.get("/fusion_stats")
async def get_fusion_stats():
    """Estatísticas da fusão temporal"""
    try:
        # Get some sample stats from fusion engine
        stats = {
            "fusion_engine_active": fusion_engine is not None,
            "temporal_windows": {
                "face_window_seconds": FACE_WINDOW_SECONDS,
                "reid_window_seconds": REID_WINDOW_SECONDS,
                "detector_window_seconds": DETECTOR_WINDOW_SECONDS
            },
            "signal_weights": {
                "face_weight": FACE_WEIGHT,
                "reid_weight": REID_WEIGHT,
                "detector_weight": DETECTOR_WEIGHT
            },
            "decision_thresholds": {
                "face_threshold": T_FACE,
                "reid_threshold": T_REID,
                "movement_threshold": T_MOVE,
                "confirmed_frames": N_FRAMES
            },
            "service_timeouts": {
                "face_timeout": FACE_TIMEOUT,
                "reid_timeout": REID_TIMEOUT,
                "multi_tracker_timeout": MULTI_TRACKER_TIMEOUT
            }
        }
        return stats
    except Exception as e:
        logger.error(f"Error getting fusion stats: {e}")
        return {"error": str(e)}

@app.on_event("startup")
async def startup_event():
    """Configuração na inicialização"""
    logger.info("Fusion API starting up with temporal fusion")
    logger.info(f"Signal weights: face={FACE_WEIGHT}, reid={REID_WEIGHT}, detector={DETECTOR_WEIGHT}")
    logger.info(f"Temporal windows: face={FACE_WINDOW_SECONDS}s, reid={REID_WINDOW_SECONDS}s, detector={DETECTOR_WINDOW_SECONDS}s")
    logger.info(f"Decision thresholds: face={T_FACE}, reid={T_REID}, movement={T_MOVE}, frames={N_FRAMES}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)