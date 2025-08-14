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
import hashlib
import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from ultralytics import YOLO
import uvicorn
import asyncio
from typing import List, Optional

# Import batch processor
import sys
sys.path.append('/common_schemas')
from batch_processor import get_batch_processor, BatchProcessor

# Configuração
YOLO_MODEL = os.getenv("YOLO_MODEL", "/app/models/yolov8x.pt")
YOLO_MODEL_URL = os.getenv("YOLO_MODEL_URL")
YOLO_DEVICE = os.getenv("YOLO_DEVICE", "auto")  # auto|cuda|cpu
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "8"))  # GPU batching
MAX_IMAGE_SIZE_MB = 2
INFERENCE_TIMEOUT = 2.0

app = FastAPI(
    title="YOLO Person Detection API",
    description="Detecção de pessoas usando YOLO para Visão de Águia",
    version="1.0.0"
)

# Modelo global e batch processor
model = None
batch_processor = None


def _verify_integrity(model_path: str):
    sha_path = Path(f"{model_path}.sha256")
    if not sha_path.exists():
        print(f"[integrity] Nenhum arquivo de checksum encontrado para {model_path}")
        return
    try:
        expected = sha_path.read_text().strip().split()[0]
        h = hashlib.sha256()
        with open(model_path, 'rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        actual = h.hexdigest()
        if actual != expected:
            print(f"❌ Checksum MISMATCH: esperado {expected[:8]}..., obtido {actual[:8]}...")
            raise SystemExit(1)
        else:
            print(f"✓ Checksum OK: {actual[:8]}... para {Path(model_path).name}")
    except Exception as e:
        print(f"⚠️ Falha ao verificar integridade de {model_path}: {e}")



class DetectionRequest(BaseModel):
    jpg_b64: str = Field(..., description="Imagem JPEG em base64")
    use_batch: bool = Field(default=True, description="Use batch processing for better performance")

class BatchDetectionRequest(BaseModel):
    images: List[str] = Field(..., description="Lista de imagens JPEG em base64")
    batch_id: Optional[str] = Field(default=None, description="ID do batch para tracking")

class BoundingBox(BaseModel):
    score: float = Field(..., description="Confiança da detecção")
    cls: str = Field(..., description="Classe detectada (person)")
    xyxy: List[int] = Field(..., description="Coordenadas absolutas [x1,y1,x2,y2]")
    xywhn: List[float] = Field(..., description="Coordenadas normalizadas [x,y,w,h]")

class DetectionResponse(BaseModel):
    boxes: List[BoundingBox]

@app.on_event("startup")
async def startup_event():
    """Inicializa o modelo YOLO e batch processor"""
    global model, batch_processor

    # Garantir diretório de modelos
    os.makedirs(os.path.dirname(YOLO_MODEL), exist_ok=True)

    # Baixar pesos se não existir e URL fornecida
    if not os.path.exists(YOLO_MODEL) and YOLO_MODEL_URL:
        try:
            import urllib.request
            print(f"Baixando pesos YOLO de {YOLO_MODEL_URL} para {YOLO_MODEL}")
            urllib.request.urlretrieve(YOLO_MODEL_URL, YOLO_MODEL)
        except Exception as e:
            print(f"Falha ao baixar pesos: {e}. Usando fallback do Ultralytics.")

    # Carregar modelo (usa fallback do Ultralytics se caminho não existir)
    load_id = YOLO_MODEL if os.path.exists(YOLO_MODEL) else "yolov8x.pt"
    if os.path.exists(YOLO_MODEL):
        _verify_integrity(YOLO_MODEL)
    print(f"Carregando modelo YOLO: {load_id}")
    model = YOLO(load_id)

    # Seleção de device
    device = "cpu"
    if YOLO_DEVICE == "cuda" and torch.cuda.is_available():
        device = "cuda"
    elif YOLO_DEVICE == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"

    print(f"Dispositivo: {device}")
    if device == "cuda":
        try:
            torch.backends.cudnn.benchmark = True
            print(f"GPU: {torch.cuda.get_device_name(0)}")
        except Exception:
            pass
        model.to(device)

    # Initialize batch processor for GPU optimization
    try:
        batch_processor = get_batch_processor(
            'yolo',
            model=model,
            batch_size=BATCH_SIZE,
            max_wait_time=0.05,  # 50ms max wait
            device=device
        )
        print(f"✓ Batch processor initialized (batch_size={BATCH_SIZE}, device={device})")
    except Exception as e:
        print(f"⚠️ Failed to initialize batch processor: {e}")
        batch_processor = None

    # Warm-up com imagem dummy
    print("Fazendo warm-up...")
    dummy_img = np.random.randint(0, 255, (640, 480, 3), dtype=np.uint8)
    _ = model(dummy_img, verbose=False)
    print("Warm-up concluído!")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    batch_stats = batch_processor.get_stats() if batch_processor else {}
    return {
        "status": "ok",
        "model": YOLO_MODEL,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "gpu_available": torch.cuda.is_available(),
        "batch_processing": batch_processor is not None,
        "batch_stats": batch_stats
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
    """Detecta pessoas na imagem com batching opcional"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo não carregado")
    
    # Decodifica imagem
    img = decode_base64_image(request.jpg_b64)
    h, w, _ = img.shape
    
    start_time = time.time()
    
    try:
        # Use batch processing if available and enabled
        if batch_processor and request.use_batch:
            # Generate unique item ID
            item_id = f"detect_{int(time.time() * 1000000)}"
            
            # Add to batch queue
            await batch_processor.add_item(
                item_id=item_id,
                data=img,
                metadata={'image_shape': (h, w)}
            )
            
            # Get result
            batch_result = await batch_processor.get_result(item_id, timeout=3.0)
            
            if batch_result and batch_result.result:
                yolo_results = batch_result.result
            else:
                # Fallback to individual processing
                yolo_results = await _process_single_image(img)
        else:
            # Process individually
            yolo_results = await _process_single_image(img)
        
        inference_time = time.time() - start_time
        
        if inference_time > INFERENCE_TIMEOUT:
            print(f"Warning: Inferência demorou {inference_time:.3f}s (limite: {INFERENCE_TIMEOUT}s)")
        
        # Convert to API format
        boxes = []
        if yolo_results and 'boxes' in yolo_results:
            for box_data in yolo_results['boxes']:
                # Coordenadas absolutas
                xyxy = box_data['xyxy']
                x1, y1, x2, y2 = xyxy
                
                # Coordenadas normalizadas (xywh)
                x_center = (x1 + x2) / 2 / w
                y_center = (y1 + y2) / 2 / h
                width = (x2 - x1) / w
                height = (y2 - y1) / h
                xywhn = [x_center, y_center, width, height]
                
                boxes.append(BoundingBox(
                    score=box_data['score'],
                    cls=box_data['cls'],
                    xyxy=xyxy,
                    xywhn=xywhn
                ))
        
        return DetectionResponse(boxes=boxes)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na inferência: {str(e)}")

async def _process_single_image(img: np.ndarray) -> Dict:
    """Process single image without batching"""
    try:
        # Inferência individual
        with torch.cuda.amp.autocast(enabled=torch.cuda.is_available()):
            results = model(img, verbose=False)
        
        # Processa resultados
        boxes = []
        for result in results:
            if result.boxes is not None:
                for box in result.boxes:
                    # Verifica se é pessoa (classe 0 no COCO)
                    cls_id = int(box.cls.item())
                    if cls_id == 0:  # pessoa
                        score = float(box.conf.item())
                        xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                        
                        boxes.append({
                            'score': score,
                            'cls': 'person',
                            'xyxy': xyxy
                        })
        
        return {'boxes': boxes}
        
    except Exception as e:
        print(f"Error in single image processing: {e}")
        return {'boxes': []}

@app.post("/detect_batch", response_model=List[DetectionResponse])
async def detect_batch(request: BatchDetectionRequest):
    """Detecta pessoas em múltiplas imagens usando batching otimizado"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo não carregado")
    
    if not batch_processor:
        raise HTTPException(status_code=503, detail="Batch processor não disponível")
    
    try:
        batch_id = request.batch_id or f"batch_{int(time.time() * 1000)}"
        results = []
        
        # Process all images in batch
        tasks = []
        for i, img_b64 in enumerate(request.images):
            item_id = f"{batch_id}_{i}"
            img = decode_base64_image(img_b64)
            h, w, _ = img.shape
            
            # Add to batch processor
            task = batch_processor.add_item(
                item_id=item_id,
                data=img,
                metadata={'image_shape': (h, w), 'batch_id': batch_id}
            )
            tasks.append((item_id, h, w))
        
        # Wait for all results
        for item_id, h, w in tasks:
            batch_result = await batch_processor.get_result(item_id, timeout=5.0)
            
            boxes = []
            if batch_result and batch_result.result and 'boxes' in batch_result.result:
                for box_data in batch_result.result['boxes']:
                    xyxy = box_data['xyxy']
                    x1, y1, x2, y2 = xyxy
                    
                    # Normalized coordinates
                    x_center = (x1 + x2) / 2 / w
                    y_center = (y1 + y2) / 2 / h
                    width = (x2 - x1) / w
                    height = (y2 - y1) / h
                    xywhn = [x_center, y_center, width, height]
                    
                    boxes.append(BoundingBox(
                        score=box_data['score'],
                        cls=box_data['cls'],
                        xyxy=xyxy,
                        xywhn=xywhn
                    ))
            
            results.append(DetectionResponse(boxes=boxes))
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no batch processing: {str(e)}")

@app.get("/batch_stats")
async def get_batch_stats():
    """Get batch processing statistics"""
    if batch_processor:
        return batch_processor.get_stats()
    else:
        return {"error": "Batch processor not available"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=18060,
        reload=False
    )