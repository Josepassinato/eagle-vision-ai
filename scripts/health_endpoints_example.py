# Health endpoint implementation for Docker services

# This file shows how to implement /health endpoints in each service
# Add this to your existing Python services

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
import psutil
import time
import asyncio
from datetime import datetime
from typing import Dict, Any

app = FastAPI()

# Service-specific health metrics
class HealthChecker:
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.start_time = time.time()
        
    async def get_system_metrics(self) -> Dict[str, Any]:
        """Get system-level health metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                "cpu_usage_percent": cpu_percent,
                "memory_usage_percent": memory.percent,
                "memory_available_mb": memory.available // 1024 // 1024,
                "disk_usage_percent": disk.percent,
                "disk_free_gb": disk.free // 1024 // 1024 // 1024,
                "uptime_seconds": time.time() - self.start_time
            }
        except Exception as e:
            return {"error": str(e)}
    
    async def get_service_metrics(self) -> Dict[str, Any]:
        """Get service-specific metrics - override in each service"""
        return {
            "service_name": self.service_name,
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }

# Initialize health checker
health_checker = HealthChecker("example-service")

@app.get("/health")
async def health_check():
    """Standard health endpoint that returns 200 if service is healthy"""
    try:
        system_metrics = await health_checker.get_system_metrics()
        service_metrics = await health_checker.get_service_metrics()
        
        # Determine overall health based on metrics
        is_healthy = (
            system_metrics.get("cpu_usage_percent", 0) < 90 and
            system_metrics.get("memory_usage_percent", 0) < 90 and
            system_metrics.get("disk_usage_percent", 0) < 95
        )
        
        status_code = 200 if is_healthy else 503
        
        return JSONResponse(
            status_code=status_code,
            content={
                "status": "healthy" if is_healthy else "unhealthy",
                "service": service_metrics,
                "system": system_metrics,
                "checks": {
                    "cpu_ok": system_metrics.get("cpu_usage_percent", 0) < 90,
                    "memory_ok": system_metrics.get("memory_usage_percent", 0) < 90,
                    "disk_ok": system_metrics.get("disk_usage_percent", 0) < 95
                }
            }
        )
        
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )

# Service-specific implementations:

# YOLO Detection Service
class YOLOHealthChecker(HealthChecker):
    async def get_service_metrics(self):
        # Add model loading status, inference queue size, etc.
        return {
            "service_name": "yolo-detection",
            "model_loaded": True,  # Check if YOLO model is loaded
            "inference_queue_size": 0,  # Current queue size
            "total_inferences": 1234,  # Counter since startup
            "avg_inference_time_ms": 45.2,
            "error_rate_percent": 0.1
        }

# MediaMTX Service
class MediaMTXHealthChecker(HealthChecker):
    async def get_service_metrics(self):
        return {
            "service_name": "mediamtx",
            "active_streams": 5,
            "total_connections": 12,
            "stream_stall_rate_percent": 1.2,
            "reconnections_per_minute": 0.5,
            "bandwidth_mbps": 25.4
        }

# Fusion Service  
class FusionHealthChecker(HealthChecker):
    async def get_service_metrics(self):
        return {
            "service_name": "fusion",
            "events_processed_per_hour": 156,
            "decision_latency_p95_ms": 850,
            "queue_depth": 3,
            "queue_saturation_duration_seconds": 0,
            "active_cameras": 4
        }

# Add these requirements to your requirements.txt:
# psutil==5.9.5
# fastapi==0.104.1

# Docker healthcheck example for docker-compose.yml:
"""
services:
  yolo-detection:
    build: ./yolo-detection
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
      
  mediamtx:
    image: bluenviron/mediamtx:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9997/v3/config/global/get"]
      interval: 30s
      timeout: 10s
      retries: 3
"""