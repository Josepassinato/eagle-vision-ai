#!/usr/bin/env python3
"""
Person Re-ID Service - Visão de Águia
FastAPI service usando OSNet (ONNX Runtime) + Supabase
"""

import os
import base64
import io
import logging
from typing import List, Optional, Tuple
import numpy as np
from PIL import Image
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import onnxruntime as ort

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Person Re-ID Service",
    description="Serviço de Person Re-Identification usando OSNet",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for model and preprocessing
ort_session = None
INPUT_SIZE = (256, 128)  # height, width for OSNet
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def load_model():
    """Load OSNet ONNX model"""
    global ort_session
    
    model_path = os.getenv("REID_MODEL_PATH", "/models/osnet_x0_75.onnx")
    
    if not os.path.exists(model_path):
        logger.warning(f"Model not found at {model_path}, using dummy mode")
        return None
    
    try:
        # Configure ONNX Runtime
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        
        ort_session = ort.InferenceSession(
            model_path,
            sess_options=sess_options,
            providers=providers
        )
        
        logger.info(f"✓ Model loaded: {model_path}")
        logger.info(f"✓ Providers: {ort_session.get_providers()}")
        
        return ort_session
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        return None


def preprocess_image(
    img: Image.Image,
    target_size: Tuple[int, int] = INPUT_SIZE
) -> np.ndarray:
    """
    Preprocess image for OSNet
    
    Args:
        img: PIL Image (RGB)
        target_size: (height, width) tuple
        
    Returns:
        Preprocessed numpy array [1, 3, H, W]
    """
    # Resize
    img = img.resize((target_size[1], target_size[0]), Image.BILINEAR)
    
    # Convert to numpy array [H, W, 3] and normalize to [0, 1]
    img_array = np.array(img, dtype=np.float32) / 255.0
    
    # Apply ImageNet normalization
    img_array = (img_array - IMAGENET_MEAN) / IMAGENET_STD
    
    # Transpose to [3, H, W]
    img_array = img_array.transpose(2, 0, 1)
    
    # Add batch dimension [1, 3, H, W]
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array.astype(np.float32)


def extract_embedding(img_b64: str, xyxy: Optional[List[int]] = None) -> np.ndarray:
    """
    Extract Re-ID embedding from image
    
    Args:
        img_b64: Base64 encoded image
        xyxy: Optional crop coordinates [x1, y1, x2, y2]
        
    Returns:
        512-dimensional L2-normalized embedding
    """
    if ort_session is None:
        # Dummy mode - return random embedding
        logger.warning("Model not loaded, returning dummy embedding")
        embedding = np.random.randn(512).astype(np.float32)
        embedding = embedding / np.linalg.norm(embedding)
        return embedding
    
    try:
        # Decode base64
        img_bytes = base64.b64decode(img_b64)
        img = Image.open(io.BytesIO(img_bytes))
        
        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Crop if coordinates provided
        if xyxy is not None:
            x1, y1, x2, y2 = xyxy
            img = img.crop((x1, y1, x2, y2))
        
        # Preprocess
        input_array = preprocess_image(img)
        
        # Run inference
        input_name = ort_session.get_inputs()[0].name
        output_name = ort_session.get_outputs()[0].name
        
        embedding = ort_session.run([output_name], {input_name: input_array})[0]
        
        # Flatten and normalize
        embedding = embedding.flatten().astype(np.float32)
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding
        
    except Exception as e:
        logger.error(f"Error extracting embedding: {e}")
        raise


# Request/Response models
class EmbedRequest(BaseModel):
    jpg_b64: str
    xyxy: Optional[List[int]] = None


class EmbedResponse(BaseModel):
    vec: List[float]
    norm: float


class MatchRequest(BaseModel):
    jpg_b64: str
    top_k: Optional[int] = 5
    xyxy: Optional[List[int]] = None


class MatchResult(BaseModel):
    id: str
    name: str
    similarity: float


class MatchResponse(BaseModel):
    results: List[MatchResult]


# API Endpoints
@app.on_event("startup")
async def startup_event():
    """Load model on startup"""
    load_model()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "person-reid",
        "status": "running",
        "version": "1.0.0",
        "model": "OSNet x0.75"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    model_path = os.getenv("REID_MODEL_PATH", "/models/osnet_x0_75.onnx")
    model_exists = os.path.exists(model_path)
    
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    return {
        "status": "ok" if (ort_session is not None or model_exists) else "degraded",
        "model": model_path,
        "model_loaded": ort_session is not None,
        "model_exists": model_exists,
        "input_format": "RGB",
        "input_size": f"{INPUT_SIZE[0]}x{INPUT_SIZE[1]}",
        "providers": ort_session.get_providers() if ort_session else [],
        "supabase_configured": bool(supabase_url and supabase_key)
    }


@app.post("/embedding", response_model=EmbedResponse)
async def embed_body(request: EmbedRequest):
    """
    Gera embedding corporal de uma imagem
    
    Args:
        jpg_b64: Imagem em base64
        xyxy: Coordenadas de crop (opcional)
        
    Returns:
        Embedding de 512 dimensões L2-normalizado
    """
    try:
        embedding = extract_embedding(request.jpg_b64, request.xyxy)
        norm = float(np.linalg.norm(embedding))
        
        return EmbedResponse(
            vec=embedding.tolist(),
            norm=norm
        )
        
    except Exception as e:
        logger.error(f"Error in /embedding: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/match", response_model=MatchResponse)
async def match_body(request: MatchRequest):
    """
    Busca corpos similares no banco de dados
    
    Args:
        jpg_b64: Imagem em base64
        top_k: Número máximo de resultados
        xyxy: Coordenadas de crop (opcional)
        
    Returns:
        Lista de matches ordenados por similaridade
    """
    try:
        # Extract embedding
        embedding = extract_embedding(request.jpg_b64, request.xyxy)
        
        # Query Supabase (using match_body RPC)
        from supabase import create_client, Client
        
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(
                status_code=503,
                detail="Supabase not configured"
            )
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Call match_body RPC
        result = supabase.rpc(
            "match_body",
            {
                "query": embedding.tolist(),
                "k": request.top_k
            }
        ).execute()
        
        if result.data is None:
            return MatchResponse(results=[])
        
        # Format results
        matches = []
        for row in result.data:
            matches.append(MatchResult(
                id=row["id"],
                name=row["name"],
                similarity=float(row["similarity"])
            ))
        
        return MatchResponse(results=matches)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in /match: {e}")
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "18090"))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )
