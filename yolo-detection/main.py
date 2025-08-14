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
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Import batch processor
import sys
sys.path.append('/common_schemas')
from batch_processor import get_batch_processor, BatchProcessor

# Prometheus metrics
inference_duration = Histogram('yolo_inference_duration_seconds', 'YOLO inference duration')
batch_size_metric = Histogram('yolo_batch_size', 'Actual batch sizes processed')
output_queue_size = Gauge('yolo_output_queue_size', 'Current output queue size')
backpressure_rejections = Counter('yolo_backpressure_rejections_total', 'Requests rejected due to backpressure')
fp16_usage = Counter('yolo_fp16_inferences_total', 'Number of FP16 inferences')

# Configuração
YOLO_MODEL = os.getenv("YOLO_MODEL", "/app/models/yolov8x.pt")
YOLO_MODEL_URL = os.getenv("YOLO_MODEL_URL")
YOLO_DEVICE = os.getenv("YOLO_DEVICE", "auto")  # auto|cuda|cpu
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "4"))  # Real batching ≥2 under load
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "8"))
OUTPUT_QUEUE_LIMIT = int(os.getenv("OUTPUT_QUEUE_LIMIT", "50"))  # Backpressure limit
ENABLE_FP16 = os.getenv("ENABLE_FP16", "true").lower() == "true"  # FP16 precision
ENABLE_TENSORRT = os.getenv("ENABLE_TENSORRT", "false").lower() == "true"  # TensorRT flag for v1.1
NMS_ON_DEVICE = os.getenv("NMS_ON_DEVICE", "true").lower() == "true"  # NMS on device
MAX_IMAGE_SIZE_MB = 2
INFERENCE_TIMEOUT = 2.0

app = FastAPI(
    title="YOLO Person Detection API",
    description="Detecção de pessoas usando YOLO para Visão de Águia",
    version="1.0.0"
)

# Modelo global, batch processor e HTTP client
model = None
batch_processor = None
output_queue = asyncio.Queue(maxsize=OUTPUT_QUEUE_LIMIT)
http_client = get_http_client(service_name="yolo-detection")


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
            if ENABLE_FP16:
                model.half()  # Enable FP16
                print("✓ FP16 precision enabled")
            print(f"GPU: {torch.cuda.get_device_name(0)}")
        except Exception:
            pass
        model.to(device)
    
    # Verify model checksum and download with resilient fallback
    await verify_and_download_model()
    
    # Configure NMS on device
    if hasattr(model, 'model') and hasattr(model.model, 'model'):
        for m in model.model.model.modules():
            if hasattr(m, 'nms'):
                if NMS_ON_DEVICE and device == "cuda":
                    # Ensure NMS runs on GPU
                    print("✓ NMS configured for GPU")
                    
    # TensorRT preparation (flag for v1.1)
    if ENABLE_TENSORRT and device == "cuda":
        print("⚠️ TensorRT flag enabled - will be implemented in v1.1")

    # Initialize batch processor for GPU optimization with dynamic batching
    try:
        batch_processor = get_batch_processor(
            'yolo',
            model=model,
            batch_size=BATCH_SIZE,
            max_batch_size=MAX_BATCH_SIZE,
            max_wait_time=0.05,  # 50ms max wait for real batching
            device=device,
            enable_fp16=ENABLE_FP16
        )
        print(f"✓ Batch processor initialized (batch_size={BATCH_SIZE}, max_batch_size={MAX_BATCH_SIZE}, device={device})")
    except Exception as e:
        print(f"⚠️ Failed to initialize batch processor: {e}")
        batch_processor = None

    # Warm-up com imagem dummy
    print("Fazendo warm-up...")
    dummy_img = np.random.randint(0, 255, (640, 480, 3), dtype=np.uint8)
    _ = model(dummy_img, verbose=False)
    print("Warm-up concluído!")


async def verify_and_download_model():
    """Verify model checksum and download with resilient HTTP fallback"""
    if os.path.exists(YOLO_MODEL):
        _verify_integrity(YOLO_MODEL)
        return
    
    if not YOLO_MODEL_URL:
        logger.warning("No YOLO_MODEL_URL provided, using Ultralytics default")
        return
    
    try:
        logger.info(f"Downloading YOLO model from {YOLO_MODEL_URL} with resilient HTTP")
        
        # Use resilient HTTP client with timeout and backoff
        response = await http_client.get(
            YOLO_MODEL_URL,
            timeout=300.0  # 5 minute timeout for large model
        )
        
        if response.status_code == 200:
            with open(YOLO_MODEL, 'wb') as f:
                f.write(response.content)
            logger.info("Model downloaded successfully with resilient HTTP")
            _verify_integrity(YOLO_MODEL)
        else:
            logger.error(f"Failed to download model: HTTP {response.status_code}")
            
    except Exception as e:
        logger.error(f"Resilient download failed: {e}. Using Ultralytics fallback.")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    batch_stats = batch_processor.get_stats() if batch_processor else {}
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return {
        "status": "ok",
        "model": YOLO_MODEL,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "gpu_available": torch.cuda.is_available(),
        "batch_processing": batch_processor is not None,
        "batch_stats": batch_stats,
        "circuit_breakers": circuit_stats,
        "model_checksum_verified": os.path.exists(f"{YOLO_MODEL}.sha256")
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
    """Detecta pessoas na imagem com batching opcional e backpressure"""
    if model is None:
        raise HTTPException(status_code=503, detail="Modelo não carregado")
    
    # Check backpressure - reject if output queue is full
    if output_queue.qsize() >= OUTPUT_QUEUE_LIMIT:
        backpressure_rejections.inc()
        raise HTTPException(status_code=503, detail=f"Sistema sobrecarregado - fila de saída cheia ({output_queue.qsize()}/{OUTPUT_QUEUE_LIMIT})")
    
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
        
        # Update metrics
        inference_duration.observe(inference_time)
        output_queue_size.set(output_queue.qsize())
        if ENABLE_FP16 and torch.cuda.is_available():
            fp16_usage.inc()
        
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
        # Inferência individual with FP16 if enabled
        with torch.cuda.amp.autocast(enabled=ENABLE_FP16 and torch.cuda.is_available()):
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
    stats = {"batch_processor_available": batch_processor is not None}
    if batch_processor:
        stats.update(batch_processor.get_stats())
    
    # Add queue and performance stats
    stats.update({
        "output_queue_size": output_queue.qsize(),
        "output_queue_limit": OUTPUT_QUEUE_LIMIT,
        "fp16_enabled": ENABLE_FP16,
        "nms_on_device": NMS_ON_DEVICE,
        "tensorrt_enabled": ENABLE_TENSORRT
    })
    
    return stats

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=18060,
        reload=False
    )