"""
Resilient HTTP service implementation for Fusion service
Demonstrates HTTP client with circuit breaker, retry, and correlation tracking
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel

from common_schemas.http_resilient import (
    get_http_client, 
    resilient_post_json,
    resilient_get_json,
    RetryConfig,
    close_all_clients
)
from common_schemas.correlation_logger import (
    set_correlation_context,
    with_correlation,
    get_correlation_logger,
    generate_correlation_id
)
from common_schemas.resilience import (
    ResilienceManager,
    CircuitBreakerConfig,
    QueueConfig
)

logger = get_correlation_logger('fusion_service')


class DetectionRequest(BaseModel):
    """Request model for detection services"""
    image_data: str
    camera_id: str
    timestamp: float
    correlation_id: Optional[str] = None
    org_id: Optional[str] = None


class AnalysisResult(BaseModel):
    """Result from AI analysis"""
    service: str
    detections: List[Dict[str, Any]]
    processing_time_ms: float
    correlation_id: str


class FusionService:
    """Resilient fusion service with correlation tracking"""
    
    def __init__(self):
        self.service_name = "fusion"
        self.resilience_manager = ResilienceManager(self.service_name)
        
        # Configure circuit breakers for each service
        self.circuit_config = CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=30.0,
            success_threshold=2,
            timeout=1.0
        )
        
        # Configure retry policy
        self.retry_config = RetryConfig(
            max_retries=3,
            base_delay=0.5,
            max_delay=2.0,
            jitter=True
        )
        
        # Service endpoints
        self.service_endpoints = {
            'yolo': 'http://yolo-detection:8000/detect',
            'safetyvision': 'http://safetyvision:8001/analyze',
            'edubehavior': 'http://edubehavior:8002/analyze'
        }
        
        # HTTP clients per service
        self.http_clients = {}
        for service in self.service_endpoints:
            self.http_clients[service] = get_http_client(
                service_name=f"{self.service_name}_{service}",
                base_timeout=1.0,
                circuit_config=self.circuit_config,
                retry_config=self.retry_config
            )
    
    @with_correlation
    async def process_frame(
        self, 
        request: DetectionRequest,
        enabled_services: List[str] = None
    ) -> Dict[str, Any]:
        """Process frame through multiple AI services with resilience"""
        
        # Set correlation context
        correlation_id = request.correlation_id or generate_correlation_id()
        set_correlation_context(
            corr_id=correlation_id,
            org=request.org_id,
            camera=request.camera_id
        )
        
        logger.info(
            "Starting frame processing",
            camera_id=request.camera_id,
            enabled_services=enabled_services or list(self.service_endpoints.keys())
        )
        
        start_time = time.time()
        services_to_call = enabled_services or list(self.service_endpoints.keys())
        
        # Process services in parallel with circuit breaker protection
        tasks = []
        for service in services_to_call:
            if service in self.service_endpoints:
                task = asyncio.create_task(
                    self._call_service_with_circuit_breaker(
                        service, request, correlation_id
                    )
                )
                tasks.append((service, task))
        
        # Collect results
        results = {}
        errors = {}
        
        for service, task in tasks:
            try:
                result = await task
                results[service] = result
                
                logger.info(
                    f"Service {service} completed successfully",
                    service=service,
                    processing_time_ms=result.get('processing_time_ms', 0),
                    detections_count=len(result.get('detections', []))
                )
                
            except Exception as e:
                errors[service] = str(e)
                logger.error(
                    f"Service {service} failed",
                    service=service,
                    error=str(e),
                    error_type=type(e).__name__
                )
        
        total_time_ms = (time.time() - start_time) * 1000
        
        # Create fusion result
        fusion_result = {
            'correlation_id': correlation_id,
            'camera_id': request.camera_id,
            'timestamp': request.timestamp,
            'processing_time_ms': total_time_ms,
            'services_called': services_to_call,
            'successful_services': list(results.keys()),
            'failed_services': list(errors.keys()),
            'results': results,
            'errors': errors,
            'circuit_breaker_stats': self._get_circuit_stats()
        }
        
        logger.performance_log(
            operation="frame_fusion",
            duration_ms=total_time_ms,
            successful_services=len(results),
            failed_services=len(errors),
            total_detections=sum(len(r.get('detections', [])) for r in results.values())
        )
        
        return fusion_result
    
    async def _call_service_with_circuit_breaker(
        self, 
        service: str, 
        request: DetectionRequest,
        correlation_id: str
    ) -> Dict[str, Any]:
        """Call AI service with circuit breaker protection"""
        
        async def service_call():
            endpoint = self.service_endpoints[service]
            client = self.http_clients[service]
            
            # Prepare request data
            request_data = {
                'image_data': request.image_data,
                'camera_id': request.camera_id,
                'timestamp': request.timestamp,
                'correlation_id': correlation_id
            }
            
            # Add org context if available
            if request.org_id:
                request_data['org_id'] = request.org_id
            
            start_time = time.time()
            
            try:
                response = await client.post(
                    endpoint,
                    json=request_data,
                    timeout=1.0
                )
                response.raise_for_status()
                
                result = response.json()
                processing_time_ms = (time.time() - start_time) * 1000
                
                # Add processing metadata
                result['processing_time_ms'] = processing_time_ms
                result['service'] = service
                result['correlation_id'] = correlation_id
                
                return result
                
            except httpx.HTTPStatusError as e:
                logger.error(
                    f"HTTP error calling {service}",
                    service=service,
                    status_code=e.response.status_code,
                    response_body=e.response.text[:500]
                )
                raise
                
            except httpx.TimeoutException as e:
                logger.error(
                    f"Timeout calling {service}",
                    service=service,
                    timeout=1.0
                )
                raise
                
            except Exception as e:
                logger.error(
                    f"Unexpected error calling {service}",
                    service=service,
                    error=str(e),
                    error_type=type(e).__name__
                )
                raise
        
        # Execute with circuit breaker protection
        return await self.resilience_manager.execute_with_circuit_breaker(
            circuit_name=service,
            operation=service_call
        )
    
    def _get_circuit_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get circuit breaker statistics for all services"""
        stats = {}
        for service, client in self.http_clients.items():
            stats[service] = client.get_circuit_stats()
        return stats
    
    async def health_check(self) -> Dict[str, Any]:
        """Enhanced health check with circuit breaker status"""
        stats = self.resilience_manager.get_system_stats()
        
        # Add HTTP client stats
        stats['http_clients'] = {}
        for service, client in self.http_clients.items():
            stats['http_clients'][service] = client.get_circuit_stats()
        
        return {
            'status': 'healthy',
            'service': self.service_name,
            'timestamp': time.time(),
            'resilience_stats': stats
        }
    
    async def close(self):
        """Clean shutdown"""
        await self.resilience_manager.stop_all()
        await close_all_clients()


# Global service instance
fusion_service = FusionService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan management"""
    # Startup
    await fusion_service.resilience_manager.start_all()
    logger.info("Fusion service started with resilience infrastructure")
    
    yield
    
    # Shutdown
    await fusion_service.close()
    logger.info("Fusion service shutdown complete")


# FastAPI app with lifespan management
app = FastAPI(
    title="Resilient Fusion Service",
    description="AI Vision Fusion with Circuit Breaker and Correlation Tracking",
    version="1.0.0",
    lifespan=lifespan
)


@app.post("/process_frame")
async def process_frame_endpoint(
    request: DetectionRequest,
    background_tasks: BackgroundTasks
) -> Dict[str, Any]:
    """Process frame through AI services with resilience"""
    try:
        result = await fusion_service.process_frame(request)
        return result
        
    except Exception as e:
        logger.error(
            "Frame processing failed",
            error=str(e),
            error_type=type(e).__name__,
            camera_id=request.camera_id
        )
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {str(e)}"
        )


@app.get("/health")
async def health_endpoint():
    """Enhanced health check with resilience stats"""
    return await fusion_service.health_check()


@app.get("/circuit_breakers")
async def circuit_breakers_endpoint():
    """Get circuit breaker statistics"""
    return fusion_service._get_circuit_stats()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "resilient_http_service:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )