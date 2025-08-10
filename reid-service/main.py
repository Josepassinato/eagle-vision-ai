#!/usr/bin/env python3
"""
Microserviço Person Re-ID usando OSNet - Visão de Águia
Gera embeddings corporais para identificação quando face não está disponível
"""

import base64
import io
import os
import time
from typing import List, Dict, Any, Optional, Tuple

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import uvicorn
import requests
import json

# Configuração
REID_MODEL_PATH = os.getenv("REID_MODEL_PATH", "/models/osnet_x0_75.onnx")
REID_MODEL_URL = os.getenv("REID_MODEL_URL")
REID_INPUT_FORMAT = os.getenv("REID_INPUT_FORMAT", "RGB")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
MAX_IMAGE_SIZE_MB = 2
INFERENCE_TIMEOUT = 0.015  # 15ms target

app = FastAPI(
    title="OSNet Person Re-ID API",
    description="Person Re-Identification usando OSNet para Visão de Águia",
    version="1.0.0"
)

# Sessão ONNX global
ort_session = None

class EmbeddingRequest(BaseModel):
    jpg_b64: str = Field(..., description="Imagem JPEG em base64")
    xyxy: Optional[List[int]] = Field(None, description="Coordenadas de crop [x1,y1,x2,y2]")

class MatchRequest(BaseModel):
    jpg_b64: str = Field(..., description="Imagem JPEG em base64")
    top_k: int = Field(5, description="Número máximo de resultados")
    xyxy: Optional[List[int]] = Field(None, description="Coordenadas de crop [x1,y1,x2,y2]")

class EmbeddingResponse(BaseModel):
    vec: List[float] = Field(..., description="Vetor de embedding 512D")
    norm: float = Field(..., description="Norma L2 do vetor (deve ser ~1.0)")

class MatchResult(BaseModel):
    id: str = Field(..., description="ID da pessoa")
    name: str = Field(..., description="Nome da pessoa")
    similarity: float = Field(..., description="Similaridade corporal")

class MatchResponse(BaseModel):
    results: List[MatchResult]

@app.on_event("startup")
async def startup_event():
    """Inicializa o modelo OSNet ONNX"""
    global ort_session
    
    print(f"Carregando modelo OSNet: {REID_MODEL_PATH}")
    
    # Baixar modelo se não existir e URL fornecida
    if not os.path.exists(REID_MODEL_PATH) and REID_MODEL_URL:
        try:
            import urllib.request
            os.makedirs(os.path.dirname(REID_MODEL_PATH), exist_ok=True)
            print(f"Baixando OSNet de {REID_MODEL_URL} para {REID_MODEL_PATH}")
            urllib.request.urlretrieve(REID_MODEL_URL, REID_MODEL_PATH)
        except Exception as e:
            print(f"❌ Falha ao baixar modelo: {e}")
    
    if not os.path.exists(REID_MODEL_PATH):
        print(f"❌ Modelo não encontrado: {REID_MODEL_PATH}")
        print("Por favor, defina REID_MODEL_URL ou monte /models com o arquivo onnx")
        return
    
    # Configurar providers ONNX
    available = ort.get_available_providers()
    providers = []
    # Preferir TensorRT se disponível, depois CUDA, por fim CPU
    if 'TensorrtExecutionProvider' in available:
        providers.append('TensorrtExecutionProvider')
    if 'CUDAExecutionProvider' in available:
        providers.append('CUDAExecutionProvider')
    providers.append('CPUExecutionProvider')
    
    try:
        ort_session = ort.InferenceSession(REID_MODEL_PATH, providers=providers)
        print(f"✓ Modelo carregado com providers: {ort_session.get_providers()}")
        
        # Verificar input shape
        input_shape = ort_session.get_inputs()[0].shape
        print(f"✓ Input shape: {input_shape}")
        
        if input_shape != [1, 3, 256, 128] and input_shape != ['batch', 3, 256, 128]:
            print(f"⚠️ Input shape inesperado: {input_shape}, esperado: [1, 3, 256, 128]")
        
        # Warm-up
        print("Fazendo warm-up...")
        dummy_input = np.random.rand(1, 3, 256, 128).astype(np.float32)
        _ = ort_session.run(None, {ort_session.get_inputs()[0].name: dummy_input})
        print("✓ Warm-up concluído!")
        
    except Exception as e:
        print(f"❌ Erro ao carregar modelo: {e}")
        ort_session = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model": REID_MODEL_PATH,
        "model_loaded": ort_session is not None,
        "input_format": REID_INPUT_FORMAT,
        "providers": ort_session.get_providers() if ort_session else [],
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
    }

def decode_base64_image(b64_string: str) -> np.ndarray:
    """Decodifica imagem base64 para numpy array"""
    try:
        # Remove header se presente
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

def crop_image(img: np.ndarray, xyxy: List[int]) -> np.ndarray:
    """Recorta região da imagem"""
    x1, y1, x2, y2 = xyxy
    h, w = img.shape[:2]
    
    # Validar coordenadas
    x1 = max(0, min(x1, w))
    y1 = max(0, min(y1, h))
    x2 = max(x1, min(x2, w))
    y2 = max(y1, min(y2, h))
    
    return img[y1:y2, x1:x2]

def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Pré-processamento para OSNet"""
    # Resize para 256x128
    img_resized = cv2.resize(img, (128, 256))
    
    # Converter BGR para RGB se necessário
    if REID_INPUT_FORMAT.upper() == "RGB":
        img_resized = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
    # Se format é BGR, manter como está (OpenCV padrão)
    
    # Normalizar (ImageNet stats)
    img_normalized = img_resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406])
    std = np.array([0.229, 0.224, 0.225])
    
    img_normalized = (img_normalized - mean) / std
    
    # Converter para NCHW (batch, channel, height, width)
    img_tensor = np.transpose(img_normalized, (2, 0, 1))  # HWC -> CHW
    img_batch = np.expand_dims(img_tensor, axis=0)  # CHW -> NCHW
    
    return img_batch.astype(np.float32)

def l2_normalize(vec: np.ndarray) -> Tuple[np.ndarray, float]:
    """L2 normalize o vetor"""
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec, 0.0
    normalized = vec / norm
    return normalized, float(norm)

@app.post("/embedding", response_model=EmbeddingResponse)
async def generate_embedding(request: EmbeddingRequest):
    """Gera embedding corporal usando OSNet"""
    if ort_session is None:
        raise HTTPException(status_code=503, detail="Modelo OSNet não carregado")
    
    # Decodificar imagem
    img = decode_base64_image(request.jpg_b64)
    
    # Aplicar crop se fornecido
    if request.xyxy:
        img = crop_image(img, request.xyxy)
    
    # Verificar se imagem não está vazia após crop
    if img.size == 0:
        raise HTTPException(status_code=400, detail="Imagem vazia após crop")
    
    start_time = time.time()
    
    try:
        # Pré-processamento
        input_tensor = preprocess_image(img)
        
        # Inferência
        input_name = ort_session.get_inputs()[0].name
        outputs = ort_session.run(None, {input_name: input_tensor})
        
        # Extrair features (primeiro output)
        features = outputs[0]
        
        # Flatten se necessário
        if features.ndim > 1:
            features = features.flatten()
        
        # L2 normalize
        normalized_features, norm = l2_normalize(features)
        
        inference_time = time.time() - start_time
        
        if inference_time > INFERENCE_TIMEOUT:
            print(f"Warning: Inferência Re-ID demorou {inference_time:.3f}s (alvo: {INFERENCE_TIMEOUT}s)")
        
        # Verificar dimensão
        if len(normalized_features) != 512:
            raise HTTPException(
                status_code=500, 
                detail=f"Embedding deve ter 512 dimensões, obteve {len(normalized_features)}"
            )
        
        return EmbeddingResponse(
            vec=normalized_features.tolist(),
            norm=norm
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro na inferência: {str(e)}")

@app.post("/match", response_model=MatchResponse)
async def match_body(request: MatchRequest):
    """Encontra corpos similares usando RPC match_body do Supabase"""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503, 
            detail="Configuração Supabase não encontrada"
        )
    
    try:
        # Gerar embedding
        embedding_request = EmbeddingRequest(
            jpg_b64=request.jpg_b64,
            xyxy=request.xyxy
        )
        embedding_response = await generate_embedding(embedding_request)
        
        # Chamar RPC match_body no Supabase
        rpc_url = f"{SUPABASE_URL}/rest/v1/rpc/match_body"
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "query": embedding_response.vec,
            "k": request.top_k
        }
        
        response = requests.post(rpc_url, headers=headers, json=payload, timeout=10)
        response.raise_for_status()
        
        results_data = response.json()
        
        # Formatar resultados
        results = []
        for row in results_data:
            results.append(MatchResult(
                id=row["id"],
                name=row["name"],
                similarity=float(row["similarity"])
            ))
        
        return MatchResponse(results=results)
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Erro ao conectar com Supabase: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no matching: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 18090))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )