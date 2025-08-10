import os
import base64
import json
from datetime import datetime
from typing import List, Optional, Dict, Any

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from supabase import create_client, Client
import uvicorn

PORT = int(os.getenv("PORT", "8080"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
EDU_NOTIFY_MIN_SEVERITY = os.getenv("EDU_NOTIFY_MIN_SEVERITY", "HIGH")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app = FastAPI(title="EduBehavior Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

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
        # Lazy: we do not decode JPEG to ndarray here to keep deps light in skeleton
        # cv2.imdecode(...) would go here when needed
        return None
    except Exception:
        return None

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
    return {"status": "ok", "service": "edubehavior"}

@app.post("/analyze_frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(req: AnalyzeFrameRequest):
    # Skeleton: accept input, optionally compute features later
    _ = decode_image_if_any(req.frame_jpeg_b64)

    signals: List[SignalOut] = []
    telemetry: List[Dict[str, Any]] = []

    # Placeholders: no automatic generation here. Clients can send pre-computed signals in details if desired.
    # Example of telemetry passthrough per track (affect state, activity index, etc.) can be added later.
    if req.tracks:
        for t in req.tracks:
            telemetry.append({"track_id": t.track_id, "info": "ok"})

    incidents: List[Dict[str, Any]] = []

    # Persist any signals that were decided upstream (none by default)
    for s in signals:
        sid = await insert_signal(req, s)
        inc_id = await upsert_incident(req, s)
        s.id = sid
        incidents.append({"incident_id": inc_id, "severity": s.severity, "type": s.type})

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
