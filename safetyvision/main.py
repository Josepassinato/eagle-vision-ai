import os
import base64
from typing import List, Optional, Dict, Any
from datetime import datetime

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE")
NOTIFY_MIN_SEV = os.getenv("SAFETY_NOTIFY_MIN_SEVERITY", "HIGH").upper()
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL não definido")
if not SUPABASE_SERVICE_ROLE:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY/ SUPABASE_SERVICE_ROLE não definido")

REST_URL = f"{SUPABASE_URL}/rest/v1"
HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

class ZoneHit(BaseModel):
    zone_id: Optional[str] = None
    label: Optional[str] = None  # 'restricted','critical','general'

class AnalyzeRequest(BaseModel):
    site_id: str
    camera_id: Optional[str] = None
    ts: Optional[datetime] = None
    frame_jpeg_b64: Optional[str] = None
    zone_hits: List[ZoneHit] = Field(default_factory=list)

class SignalOut(BaseModel):
    id: str
    type: str
    severity: str
    details: Dict[str, Any] = {}

class AnalyzeResponse(BaseModel):
    signals: List[SignalOut] = Field(default_factory=list)
    incident_id: Optional[str] = None

app = FastAPI(title="SafetyVision API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()] or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}

def choose_severity(sig_type: str, zone_label: Optional[str]) -> str:
    if sig_type == "missing_ppe":
        return "HIGH" if (zone_label == "critical") else "MEDIUM"
    if sig_type == "unauthorized_zone":
        return "HIGH"
    if sig_type == "unsafe_lifting":
        return "MEDIUM"
    if sig_type == "fall_suspected":
        return "CRITICAL"
    return "LOW"

async def insert_row(table: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f"{REST_URL}/{table}", headers=HEADERS, json=payload)
        if r.status_code >= 300:
            raise HTTPException(status_code=500, detail={"table": table, "error": r.text})
        data = r.json()
        return data[0] if isinstance(data, list) and data else data

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "supabase": bool(SUPABASE_URL),
        "notify_min_sev": NOTIFY_MIN_SEV,
    }

@app.post("/analyze_frame", response_model=AnalyzeResponse)
async def analyze_frame(req: AnalyzeRequest):
    ts = req.ts or datetime.utcnow()

    # Placeholder simples: a lógica real de visão deve ser implementada aqui
    detected_types: List[str] = []
    # Exemplo: se não veio frame, apenas marca verificação de zona restrita
    if any((z.label or "").lower() == "restricted" for z in req.zone_hits):
        detected_types.append("unauthorized_zone")

    # Sempre verificamos EPIs como exemplo (placeholder)
    detected_types.append("missing_ppe")

    signals_payloads = []
    for sig in detected_types:
        zlabel = (req.zone_hits[0].label if req.zone_hits else None)
        sev = choose_severity(sig, (zlabel or "").lower() if zlabel else None)
        signals_payloads.append({
            "site_id": req.site_id,
            "zone_id": req.zone_hits[0].zone_id if req.zone_hits else None,
            "camera_id": req.camera_id,
            "ts": ts.isoformat(),
            "type": sig,
            "details": {"note": "placeholder logic"},
            "frame_url": None,
            "severity": sev  # not stored in table, returned to client only
        })

    # Insere safety_signals (sem severity na tabela; vai em details se necessário)
    out_signals: List[SignalOut] = []
    for sp in signals_payloads:
        row = await insert_row("safety_signals", {
            k: v for k, v in sp.items() if k not in ("severity",)
        })
        out_signals.append(SignalOut(id=row["id"], type=sp["type"], severity=sp["severity"], details=sp["details"]))

    # Agrega incidente simples por chamada (exemplo):
    max_sev = "LOW"
    for s in out_signals:
        if SEVERITY_ORDER[s.severity] > SEVERITY_ORDER[max_sev]:
            max_sev = s.severity

    incident = await insert_row("safety_incidents", {
        "site_id": req.site_id,
        "first_ts": ts.isoformat(),
        "last_ts": ts.isoformat(),
        "severity": max_sev,
        "status": "open",
        "aggregation_key": f"{req.camera_id or 'cam'}:{max_sev}:{ts.strftime('%Y%m%d%H%M')}",
        "signals_count": len(out_signals)
    })

    return AnalyzeResponse(signals=out_signals, incident_id=incident["id"])

class NotifyClip(BaseModel):
    incident_id: str
    clip_url: Optional[str] = None

@app.post("/notify_clip")
async def notify_clip(body: NotifyClip):
    # Atualiza incidente com clip_url
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.patch(
            f"{REST_URL}/safety_incidents?id=eq.{body.incident_id}",
            headers={**HEADERS, "Prefer": "return=minimal"},
            json={"clip_url": body.clip_url, "updated_at": datetime.utcnow().isoformat()},
        )
        if r.status_code >= 300:
            raise HTTPException(status_code=500, detail=r.text)
    return {"ok": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8089")))
