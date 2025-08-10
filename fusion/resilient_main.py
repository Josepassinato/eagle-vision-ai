"""
Resilient fusion service with integrated improvements
"""

import sys
sys.path.append('/common_schemas')

import os
import logging
import asyncio
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager

# Import common schemas and resilience components
from common_schemas import (
    FusionSettings,
    ResilienceManager,
    PolicyManager,
    AnonymizationMiddleware,
    BlurConfig,
    apply_service_optimizations,
    export_service_contracts
)
from common_schemas.events import Signal, TrackUpdate
from common_schemas.anonymization import ClipAnonymizer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load settings with validation
try:
    settings = FusionSettings()
    logger.info("Settings loaded successfully")
except Exception as e:
    logger.error(f"Settings validation failed: {e}")
    raise

# Apply performance optimizations
apply_service_optimizations("fusion")

# Global resilience manager
resilience_manager = ResilienceManager("fusion")
policy_manager = PolicyManager("fusion")
anonymization_middleware = AnonymizationMiddleware()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting Fusion service with resilience features")
    
    # Start resilience components
    await resilience_manager.start_all()
    await policy_manager.start_hot_reload()
    
    # Register policy reload callback
    policy_manager.register_reload_callback(reload_fusion_policies)
    
    yield
    
    # Cleanup
    await resilience_manager.stop_all()
    await policy_manager.stop_hot_reload()
    logger.info("Fusion service stopped")

# Create FastAPI app with lifespan
app = FastAPI(
    title="Resilient Fusion Service",
    version="2.0.0",
    description="AI Vision Fusion with resilience, policies, and anonymization",
    lifespan=lifespan
)

# Global policy cache
current_policies = {}

async def reload_fusion_policies():
    """Reload fusion policies callback"""
    global current_policies
    try:
        # Reload privacy policies for anonymization
        privacy_policy = await policy_manager.get_policy("privacy")
        if privacy_policy:
            current_policies['privacy'] = privacy_policy
            logger.info("Privacy policies reloaded")
        
        # Reload fusion processing policies
        fusion_policy = await policy_manager.get_policy("fusion") 
        if fusion_policy:
            current_policies['fusion'] = fusion_policy
            logger.info("Fusion policies reloaded")
            
    except Exception as e:
        logger.error(f"Policy reload failed: {e}")

@app.get("/health")
async def health():
    """Enhanced health check with system stats"""
    try:
        stats = resilience_manager.get_system_stats()
        return {
            "status": "healthy",
            "service": "fusion",
            "version": "2.0.0",
            "resilience_stats": stats
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")

@app.get("/policies")
async def get_current_policies():
    """Get current active policies"""
    return {
        "policies": current_policies,
        "last_updated": policy_manager.cache._timestamps
    }

@app.post("/process_frame")
async def process_frame_resilient(request: dict):
    """Process frame with resilience and anonymization"""
    
    camera_id = request.get('camera_id', 'unknown')
    
    try:
        # Get current policies
        privacy_policy = current_policies.get('privacy')
        if not privacy_policy:
            privacy_policy = await policy_manager.get_policy("privacy", camera_id=camera_id)
        
        # Execute with circuit breaker protection
        result = await resilience_manager.execute_with_circuit_breaker(
            f"camera_{camera_id}",
            _process_frame_internal,
            request,
            privacy_policy
        )
        
        # Update camera health
        if resilience_manager.health_monitor:
            resilience_manager.health_monitor.update_camera_stats(camera_id, {
                'frames_processed': 1,
                'circuit_breaker_state': 'closed'
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Frame processing failed for camera {camera_id}: {e}")
        
        # Update circuit breaker state in health
        if resilience_manager.health_monitor:
            resilience_manager.health_monitor.update_camera_stats(camera_id, {
                'circuit_breaker_state': 'open',
                'last_error': str(e)
            })
        
        raise HTTPException(status_code=500, detail=str(e))

async def _process_frame_internal(request: dict, privacy_policy):
    """Internal frame processing with anonymization"""
    
    frame_b64 = request.get('frame_b64')
    if not frame_b64:
        raise ValueError("No frame data provided")
    
    # Apply anonymization if enabled
    if privacy_policy and (privacy_policy.face_blur_enabled or privacy_policy.license_plate_blur_enabled):
        blur_config = BlurConfig(
            face_blur_enabled=privacy_policy.face_blur_enabled,
            license_plate_blur_enabled=privacy_policy.license_plate_blur_enabled,
            blur_strength=privacy_policy.blur_strength
        )
        
        frame_b64 = await anonymization_middleware.process_image_b64(frame_b64, blur_config)
    
    # Continue with regular fusion processing
    # ... (rest of fusion logic here)
    
    return {
        "status": "processed",
        "anonymized": privacy_policy and (privacy_policy.face_blur_enabled or privacy_policy.license_plate_blur_enabled),
        "camera_id": request.get('camera_id'),
        "timestamp": request.get('timestamp')
    }

@app.get("/contracts/openapi")
async def get_openapi_contract():
    """Export OpenAPI contract"""
    try:
        contracts = export_service_contracts(app, "fusion", "2.0.0")
        return {
            "openapi_spec": contracts['schema'],
            "typescript_types": contracts['types']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract generation failed: {e}")

# Queue for background processing
background_queue = resilience_manager.get_queue("background_tasks")

@app.post("/queue_task")
async def queue_background_task(task: dict):
    """Queue task for background processing"""
    try:
        success = await background_queue.enqueue(task, priority=task.get('priority', 0))
        return {"queued": success}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/queue/stats")
async def get_queue_stats():
    """Get queue statistics"""
    return background_queue.get_stats()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.host, 
        port=settings.port,
        log_level=settings.log_level.lower()
    )