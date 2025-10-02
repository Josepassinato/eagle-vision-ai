#!/usr/bin/env python3
"""
Face Recognition Service - Visão de Águia
FastAPI service usando InsightFace-REST + Supabase
"""

import os
import base64
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging

from face_client import FaceClient

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Face Recognition Service",
    description="Serviço de reconhecimento facial usando ArcFace",
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

# Initialize Face Client
try:
    face_client = FaceClient(
        face_service_url=os.getenv("FACE_SERVICE_URL", "http://insightface-rest:18080"),
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_service_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    )
    logger.info("Face client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize face client: {e}")
    face_client = None


# Request/Response models
class EmbedRequest(BaseModel):
    image_b64: str


class EmbedResponse(BaseModel):
    embedding: List[float]
    dimensions: int


class MatchRequest(BaseModel):
    image_b64: str
    top_k: Optional[int] = 5


class MatchResult(BaseModel):
    id: str
    name: str
    similarity: float


class MatchResponse(BaseModel):
    matches: List[MatchResult]


class AddPersonRequest(BaseModel):
    name: str
    image_b64: str


class AddPersonResponse(BaseModel):
    person_id: str
    name: str


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "face-recognition",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    if not face_client:
        raise HTTPException(status_code=503, detail="Face client not initialized")
    
    health_status = face_client.health_check()
    
    if health_status["status"] != "ok":
        raise HTTPException(
            status_code=503,
            detail=f"Face service unhealthy: {health_status.get('error')}"
        )
    
    return {
        "status": "healthy",
        "face_service": health_status
    }


@app.post("/embed", response_model=EmbedResponse)
async def embed_face(request: EmbedRequest):
    """
    Gera embedding facial de uma imagem
    
    Args:
        image_b64: Imagem em base64 (com ou sem header)
        
    Returns:
        Embedding de 512 dimensões
    """
    if not face_client:
        raise HTTPException(status_code=503, detail="Face client not initialized")
    
    try:
        embedding = face_client.embed_face(request.image_b64)
        
        return EmbedResponse(
            embedding=embedding,
            dimensions=len(embedding)
        )
        
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/match", response_model=MatchResponse)
async def match_face(request: MatchRequest):
    """
    Busca faces similares no banco de dados
    
    Args:
        image_b64: Imagem em base64
        top_k: Número máximo de resultados (default: 5)
        
    Returns:
        Lista de matches ordenados por similaridade
    """
    if not face_client:
        raise HTTPException(status_code=503, detail="Face client not initialized")
    
    try:
        matches = face_client.match_face(request.image_b64, top_k=request.top_k)
        
        return MatchResponse(
            matches=[
                MatchResult(**match) for match in matches
            ]
        )
        
    except Exception as e:
        logger.error(f"Error matching face: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/person", response_model=AddPersonResponse)
async def add_person(request: AddPersonRequest):
    """
    Adiciona nova pessoa com embedding facial
    
    Args:
        name: Nome da pessoa
        image_b64: Foto da pessoa em base64
        
    Returns:
        ID e nome da pessoa criada
    """
    if not face_client:
        raise HTTPException(status_code=503, detail="Face client not initialized")
    
    try:
        person_id = face_client.add_person_face(request.name, request.image_b64)
        
        logger.info(f"Added person: {request.name} (ID: {person_id})")
        
        return AddPersonResponse(
            person_id=person_id,
            name=request.name
        )
        
    except Exception as e:
        logger.error(f"Error adding person: {e}")
        raise HTTPException(status_code=400, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8017"))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
