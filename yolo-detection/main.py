#!/usr/bin/env python3
"""
Microserviço de Detecção YOLO - Visão de Águia
Detecta pessoas em imagens usando YOLOv8/v10
"""

import base64
import io
import os
import time
from typing import List, Dict, Any

import cv2
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from ultralytics import YOLO
import uvicorn

# Configuração
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8x.pt")
MAX_IMAGE_SIZE_MB = 2
INFERENCE_TIMEOUT = 2.0

app = FastAPI(
    title="YOLO Person Detection API",
    description="Detecção de pessoas usando YOLO para Visão de Águia",
    version="1.0.0"
)

# Modelo global
model = None

class DetectionRequest(BaseModel):
    jpg_b64: str = Field(..., description="Imagem JPEG em base64")

class BoundingBox(BaseModel):
    score: float = Field(..., description="Confiança da detecção")
    cls: str = Field(..., description="Classe detectada (person)")
    xyxy: List[int] = Field(..., description="Coordenadas absolutas [x1,y1,x2,y2]")
    xywhn: List[float] = Field(..., description="Coordenadas normalizadas [x,y,w,h]")

class DetectionResponse(BaseModel):
    boxes: List[BoundingBox]

@app.on_event("startup")
async def startup_event():
    """Inicializa o modelo YOLO e faz warm-up"""
    global model
    
    print(f"Carregando modelo YOLO: {YOLO_MODEL}")
    model = YOLO(YOLO_MODEL)
    
    # Verificar se GPU está disponível
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Dispositivo: {device}")
    
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name()}")
        model.to(device)
    
    # Warm-up com imagem dummy
    print("Fazendo warm-up...")
    dummy_img = np.random.randint(0, 255, (640, 480, 3), dtype=np.uint8)
    _ = model(dummy_img, verbose=False)
    print("Warm-up concluído!")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model": YOLO_MODEL,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "gpu_available": torch.cuda.is_available()
    }

def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decodifica imagem base64 para numpy array"""
    try:
        # Remove header se presente (data:image/jpeg;base64,)
        if ',' in b64_string:
            b64_string = b64_string.split(',')[1]
        
        # Decodifica base64
        img_bytes = base64.b64decode(b64_string)
        
        # Verifica tamanho
        size_mb = len(img_bytes) / (1024 * 1024)
        if size_mb > MAX_IMAGE_SIZE_MB:
            raise HTTPException(
                status_code=413, 
                detail=f"Imagem muito grande: {size_mb:.2f}MB. Máximo: {MAX_IMAGE_SIZE_MB}MB"
            )
        
        # Converte para numpy array
        img_array = np.frombuffer(img_bytes, dtype=np.uint8)
        img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Imagem inválida")
        
        return img
        
    except base64.binascii.Error:
        raise HTTPException(status_code=400, detail="Base64 inválido")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao decodificar imagem: {str(e)}")

def crop_body(img: np.ndarray, xyxy: List[int]) -> np.ndarray:
    """Recorta região do corpo da imagem"""
    x1, y1, x2, y2 = xyxy
    return img[y1:y2, x1:x2]

@app.post("/detect", response_model=DetectionResponse)
async def detect_persons(request: DetectionRequest):
    """Detecta pessoas na imagem"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo não carregado")
    
    # Decodifica imagem
    img = decode_base64_image(request.jpg_b64)
    h, w, _ = img.shape
    
    start_time = time.time()
    
    try:
        # Inferência com timeout
        with torch.cuda.amp.autocast(enabled=torch.cuda.is_available()):
            results = model(img, verbose=False)
        
        inference_time = time.time() - start_time
        
        if inference_time > INFERENCE_TIMEOUT:
            print(f"Warning: Inferência demorou {inference_time:.3f}s (limite: {INFERENCE_TIMEOUT}s)")
        
        # Processa resultados
        boxes = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    # Verifica se é pessoa (classe 0 no COCO)
                    cls_id = int(box.cls.item())
                    if cls_id == 0:  # pessoa
                        score = float(box.conf.item())
                        
                        # Coordenadas absolutas
                        xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                        x1, y1, x2, y2 = xyxy
                        
                        # Coordenadas normalizadas (xywh)
                        x_center = (x1 + x2) / 2 / w
                        y_center = (y1 + y2) / 2 / h
                        width = (x2 - x1) / w
                        height = (y2 - y1) / h
                        xywhn = [x_center, y_center, width, height]
                        
                        boxes.append(BoundingBox(
                            score=score,
                            cls="person",
                            xyxy=xyxy,
                            xywhn=xywhn
                        ))
        
        return DetectionResponse(boxes=boxes)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na inferência: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=18060,
        reload=False
    )