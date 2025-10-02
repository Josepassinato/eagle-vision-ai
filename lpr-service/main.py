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

# Real LPR using EasyOCR for license plate recognition
import easyocr
import re

# Initialize EasyOCR reader for Brazilian license plates
LPR_LANGUAGES = os.getenv("LPR_LANGUAGES", "pt,en").split(",")  # Suporte para PT e EN
ocr_reader = None

# Padrões de placas brasileiras
PLATE_PATTERN_MERCOSUL = r'^[A-Z]{3}\d[A-Z]\d{2}$'  # ABC1D23
PLATE_PATTERN_OLD = r'^[A-Z]{3}\d{4}$'  # ABC1234

lpr_latency = Histogram('lpr_detect_seconds', 'Latency of plate detection')
lpr_detect_total = Counter('lpr_detect_total', 'Plate detection outcomes', ['outcome'])

app = FastAPI(title="LPR Service")

class PlateDetectRequest(BaseModel):
    image_jpg_b64: str  # Match clip-exporter esperado

class PlateDetectResponse(BaseModel):
    plate_text: Optional[str] = None
    confidence: Optional[float] = None
    bbox: Optional[Dict[str, int]] = None

def init_ocr():
    """Initialize EasyOCR reader"""
    global ocr_reader
    try:
        ocr_reader = easyocr.Reader(LPR_LANGUAGES, gpu=True)
        logger.info(f"EasyOCR initialized with languages: {LPR_LANGUAGES}")
    except Exception as e:
        logger.warning(f"GPU OCR failed, falling back to CPU: {e}")
        ocr_reader = easyocr.Reader(LPR_LANGUAGES, gpu=False)

def clean_plate_text(text: str) -> str:
    """
    Clean and normalize detected text for Brazilian plates.
    Removes spaces, special chars, converts to upper case.
    """
    text = text.upper().strip()
    text = re.sub(r"[^A-Z0-9]", "", text)
    return text

def is_valid_brazilian_plate(text: str) -> bool:
    """
    Valida se o texto corresponde a uma placa brasileira válida.
    Suporta tanto placas Mercosul (ABC1D23) quanto antigas (ABC1234).
    """
    text = text.upper().strip()
    return bool(
        re.match(PLATE_PATTERN_MERCOSUL, text) or 
        re.match(PLATE_PATTERN_OLD, text)
    )

def _detect_plate(img: Image.Image) -> Optional[Dict[str, Any]]:
    """Real license plate detection using EasyOCR"""
    if ocr_reader is None:
        return None
    
    try:
        # Convert PIL to numpy array
        img_array = np.array(img)
        
        # Run OCR detection
        results = ocr_reader.readtext(img_array)
        
        best_plate = None
        best_confidence = 0.0
        best_bbox = None
        
        for (bbox, text, confidence) in results:
            # Filtrar e validar placas brasileiras
            clean_text = clean_plate_text(text)
            
            # Validar padrões de placas brasileiras (Mercosul ou antigas)
            if is_valid_brazilian_plate(clean_text):
                logger.info(f"Placa válida detectada: {clean_text} (conf: {confidence:.2f})")
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_plate = clean_text
                    
                    # Convert bbox to x1,y1,x2,y2 format
                    bbox_points = np.array(bbox)
                    x1, y1 = bbox_points.min(axis=0)
                    x2, y2 = bbox_points.max(axis=0)
                    best_bbox = [int(x1), int(y1), int(x2), int(y2)]
        
        if best_plate and best_confidence > 0.5:  # Minimum confidence threshold
            return {
                "plate_text": best_plate,
                "confidence": float(best_confidence),
                "bbox": {"x1": best_bbox[0], "y1": best_bbox[1], 
                        "x2": best_bbox[2], "y2": best_bbox[3]}
            }
        
        return None
        
    except Exception as e:
        logger.error(f"Error in plate detection: {e}")
        return None

@app.on_event("startup")
async def startup_event():
    """Initialize OCR on startup"""
    init_ocr()

@app.post('/plate_detect', response_model=PlateDetectResponse)
def plate_detect(req: PlateDetectRequest):
    start = time.time()
    try:
        b64 = req.image_jpg_b64.split(',')[-1]
        img = Image.open(BytesIO(base64.b64decode(b64))).convert('RGB')
        result = _detect_plate(img)
        if not result:
            lpr_detect_total.labels('none').inc()
            return PlateDetectResponse(plate_text=None, confidence=None, bbox=None)
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
