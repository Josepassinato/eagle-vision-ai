import os
import time
import base64
import logging
from io import BytesIO
from typing import Optional, List, Dict, Any

import numpy as np
from PIL import Image
import requests
from fastapi import FastAPI
from pydantic import BaseModel
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lpr")

# Placeholder: would integrate OpenALPR/PaddleOCR here
# For now, we return no-plate unless a pattern is easily recognized (stub)

lpr_latency = Histogram('lpr_detect_seconds', 'Latency of plate detection')
lpr_detect_total = Counter('lpr_detect_total', 'Plate detection outcomes', ['outcome'])

app = FastAPI(title="LPR Service")

class PlateDetectRequest(BaseModel):
    jpg_b64: str

class PlateBBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int

class PlateDetectResponse(BaseModel):
    plate: Optional[str]
    confidence: Optional[float]
    bbox: Optional[PlateBBox]


def _naive_detect(img: Image.Image) -> Optional[Dict[str, Any]]:
    # Stub: no real LPR. Return None.
    return None

@app.post('/plate_detect', response_model=PlateDetectResponse)
def plate_detect(req: PlateDetectRequest):
    start = time.time()
    try:
        b64 = req.jpg_b64.split(',')[-1]
        img = Image.open(BytesIO(base64.b64decode(b64))).convert('RGB')
        result = _naive_detect(img)
        if not result:
            lpr_detect_total.labels('none').inc()
            return PlateDetectResponse(plate=None, confidence=None, bbox=None)
        lpr_detect_total.labels('ok').inc()
        return PlateDetectResponse(**result)
    finally:
        lpr_latency.observe(time.time() - start)

@app.get('/health')
def health():
    return { 'status': 'ok' }

@app.get('/metrics')
def metrics():
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=18070)
