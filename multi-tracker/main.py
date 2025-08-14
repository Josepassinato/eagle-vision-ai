import os
import time
import logging
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prometheus_client import Histogram, Counter, generate_latest, CONTENT_TYPE_LATEST
from supabase import create_client, Client
import signal
from contextlib import contextmanager

# Import resilient HTTP components
import sys
sys.path.append('/common_schemas')
from http_resilient import get_http_client, resilient_post_json
from correlation_logger import set_correlation_context, with_correlation, generate_correlation_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("multi-tracker")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
FACE_URL = os.getenv("FACE_URL", "http://face-service:18080").rstrip('/')
T_FACE = float(os.getenv("T_FACE", "0.65"))
T_REID = float(os.getenv("T_REID", "0.86"))
EMA_ALPHA = float(os.getenv("EMA_ALPHA", "0.30"))  # Temporal smoothing (EMA already exists)
ASSOCIATION_TIMEOUT = float(os.getenv("ASSOCIATION_TIMEOUT", "1.5"))  # Clear association timeout 1.5-2.0s

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    logger.error("Missing Supabase configuration")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Initialize resilient HTTP client
http_client = get_http_client(service_name="multi-tracker")

mt_latency = Histogram('multi_tracker_latency_seconds', 'Latency of resolve endpoint')
mt_resolutions = Counter('multi_tracker_resolutions_total', 'Outcomes of resolutions', ['outcome'])

app = FastAPI(title="Multi-Camera Tracker")

class ResolveRequest(BaseModel):
    camera_id: str
    ts: Optional[str] = None
    face_embedding: Optional[List[float]] = None
    body_embedding: Optional[List[float]] = None
    jpg_b64: Optional[str] = None
    prelim_person_id: Optional[str] = None
    face_similarity: Optional[float] = None
    reid_similarity: Optional[float] = None

class ResolveResponse(BaseModel):
    global_person_id: str
    source: str
    similarity: float

@contextmanager
def time_limit(seconds: int):
    def handler(signum, frame):
        raise TimeoutError("operation timed out")
    old = signal.signal(signal.SIGALRM, handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old)

@with_correlation
async def get_face_embedding_from_image(jpg_b64: str) -> Optional[List[float]]:
    """Extract face embedding using resilient HTTP client"""
    try:
        payload = {
            "images": {"data": [jpg_b64]},
            "extract_embedding": True,
            "extract_ga": False,
            "api_ver": "1"
        }
        
        data = await resilient_post_json(
            f"{FACE_URL}/extract",
            json=payload,
            service_name="multi-tracker",
            timeout=10.0
        )
        
        if not data:
            logger.warning("Empty response from face service")
            return None
            
        embedding_data = data.get("data", [])
        if not embedding_data:
            return None
            
        emb = embedding_data[0].get("embedding")
        return emb
        
    except Exception as e:
        logger.error(f"get_face_embedding_from_image error: {e}")
        return None

def ema_update(old: Optional[List[float]], new: List[float], alpha: float) -> List[float]:
    if not old or len(old) != len(new):
        return new
    return [alpha * n + (1 - alpha) * o for o, n in zip(old, new)]

def resolve_identity(face_emb: Optional[List[float]], body_emb: Optional[List[float]], prelim_person_id: Optional[str], face_sim: Optional[float], reid_sim: Optional[float]) -> Dict[str, Any]:
    # Prefer face matching when embedding available with clear timeout
    if face_emb is not None:
        try:
            with time_limit(int(ASSOCIATION_TIMEOUT)):  # Use configurable timeout
                res = supabase.rpc('match_face', { 'query': face_emb, 'k': 1 }).execute()
        except TimeoutError:
            logger.warning(f"match_face RPC timed out ({ASSOCIATION_TIMEOUT}s)")
            res = type('obj', (), {'data': []})()
        if res.data:
            cand = res.data[0]
            sim = float(cand['similarity'])
            if sim >= T_FACE:
                return { 'person_id': cand['id'], 'source': 'face', 'similarity': sim, 'update_face': True }
    # Fallback to body with clear timeout
    if body_emb is not None:
        try:
            with time_limit(int(ASSOCIATION_TIMEOUT)):  # Use configurable timeout
                res = supabase.rpc('match_body', { 'query': body_emb, 'k': 1 }).execute()
        except TimeoutError:
            logger.warning(f"match_body RPC timed out ({ASSOCIATION_TIMEOUT}s)")
            res = type('obj', (), {'data': []})()
        if res.data:
            cand = res.data[0]
            sim = float(cand['similarity'])
            if sim >= T_REID:
                return { 'person_id': cand['id'], 'source': 'reid', 'similarity': sim, 'update_body': True }
    # Use prelim if strong
    if prelim_person_id and ((face_sim and face_sim >= T_FACE) or (reid_sim and reid_sim >= T_REID)):
        return { 'person_id': prelim_person_id, 'source': 'prelim', 'similarity': max(face_sim or 0.0, reid_sim or 0.0), 'update_face': face_emb is not None, 'update_body': body_emb is not None }

    # Create new person
    name = f"p-{str(int(time.time()))[-6:]}"
    insert = supabase.table('people').insert({ 'name': name, 'face_embedding': face_emb, 'body_embedding': body_emb }).execute()
    pid = insert.data[0]['id']
    return { 'person_id': pid, 'source': 'new', 'similarity': 1.0 if face_emb or body_emb else 0.0, 'update_face': False, 'update_body': False }

def update_embeddings(person_id: str, face_emb: Optional[List[float]], body_emb: Optional[List[float]], update_face: bool, update_body: bool):
    try:
        if not update_face and not update_body:
            return
        current = supabase.table('people').select('face_embedding, body_embedding').eq('id', person_id).execute()
        row = current.data[0] if current.data else {}
        upd: Dict[str, Any] = {}
        if update_face and face_emb is not None:
            upd['face_embedding'] = ema_update(row.get('face_embedding'), face_emb, EMA_ALPHA)
        if update_body and body_emb is not None:
            upd['body_embedding'] = ema_update(row.get('body_embedding'), body_emb, EMA_ALPHA)
        if upd:
            supabase.table('people').update(upd).eq('id', person_id).execute()
    except Exception as e:
        logger.warning(f"update_embeddings error: {e}")

@app.post('/resolve', response_model=ResolveResponse)
async def resolve(req: ResolveRequest):
    # Set up correlation context
    correlation_id = generate_correlation_id()
    set_correlation_context(
        correlation_id=correlation_id,
        service_name="multi-tracker",
        camera_id=req.camera_id
    )
    
    start = time.time()
    try:
        face_emb = req.face_embedding
        if face_emb is None and req.jpg_b64:
            face_emb = await get_face_embedding_from_image(req.jpg_b64)
        # body_emb could be later added: req.body_embedding
        outcome = resolve_identity(face_emb, req.body_embedding, req.prelim_person_id, req.face_similarity, req.reid_similarity)
        update_embeddings(outcome['person_id'], face_emb, req.body_embedding, outcome.get('update_face', False), outcome.get('update_body', False))
        mt_resolutions.labels(outcome['source']).inc()
        return ResolveResponse(global_person_id=outcome['person_id'], source=outcome['source'], similarity=outcome['similarity'])
    finally:
        mt_latency.observe(time.time() - start)

@app.get('/health')
def health():
    # Get circuit breaker stats from HTTP client
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return { 
        'status': 'ok', 
        't_face': T_FACE, 
        't_reid': T_REID, 
        'ema_alpha': EMA_ALPHA,
        'association_timeout': ASSOCIATION_TIMEOUT,
        'circuit_breakers': circuit_stats
    }

@app.get('/metrics')
def metrics():
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8087)