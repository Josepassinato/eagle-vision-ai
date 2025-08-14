# Version Convergence and Resilience Implementation

## Overview
This document outlines the standardized versions and resilience infrastructure implemented across all AI Vision services for Day 1-2 objectives.

## Version Standardization

### Core Requirements (All Services)
- **Python**: 3.11.9
- **FastAPI**: 0.115.0
- **Uvicorn**: 0.30.6
- **Pydantic**: 2.8.0
- **NumPy**: 1.26.4
- **OpenCV**: 4.10.0.84
- **Pillow**: 10.4.0
- **Prometheus Client**: 0.21.0
- **HTTPX**: 0.27.2 (replacing requests)

### GPU Services (CUDA 12.1)
- **ONNX Runtime**: 1.18.1
- **Ultralytics**: 8.2.103
- **PyTorch**: Installed via CUDA wheels in Dockerfile

### Service-Specific Additions
- **Supabase**: 2.9.1 (for services requiring database access)
- **EasyOCR**: 1.7.1 (LPR service)
- **PSUtil**: 6.1.0 (monitoring services)

## Resilience Infrastructure

### HTTP Client Resilience
All services now use `common_schemas.http_resilient.ResilientHTTPClient` with:

- **Timeout**: 0.5-1.0s default
- **Retry**: 3 attempts with exponential backoff + jitter
- **Circuit Breaker**: Per-host state management (CLOSED/OPEN/HALF_OPEN)
- **Connection Pooling**: Max 100 connections, 20 keepalive

#### Circuit Breaker Configuration
```python
CircuitBreakerConfig(
    failure_threshold=3,        # Open after 3 failures
    recovery_timeout=30.0,      # Wait 30s before retry
    success_threshold=2,        # Close after 2 successes
    timeout=1.0                # Request timeout
)
```

#### Retry Configuration
```python
RetryConfig(
    max_retries=3,              # Maximum retry attempts
    base_delay=0.5,             # Base delay (exponential backoff)
    max_delay=5.0,              # Maximum delay cap
    jitter=True,                # Add randomization
    retry_status_codes=[429, 502, 503, 504]
)
```

### Correlation ID Tracking
Mandatory correlation tracking in all inter-service requests:

- **X-Correlation-ID**: Request correlation UUID
- **X-Request-ID**: Unique request identifier
- **X-Service-Name**: Originating service name
- **X-Org-ID**: Organization context (if available)
- **X-Camera-ID**: Camera context (if available)

#### JSON Logging Format
```json
{
    "timestamp": "2025-01-14T18:00:00.000Z",
    "level": "INFO",
    "message": "Frame processing completed",
    "service": "fusion",
    "correlation_id": "uuid-here",
    "request_id": "req_timestamp_hash",
    "camera_id": "cam001",
    "org_id": "org123",
    "duration_ms": 245.67,
    "detections_count": 5
}
```

## Implementation Examples

### 1. Resilient HTTP Client Usage
```python
from common_schemas.http_resilient import get_http_client

# Get resilient client for service
client = get_http_client(
    service_name="fusion_yolo",
    base_timeout=1.0
)

# Make request with automatic correlation headers
response = await client.post(
    "http://yolo-detection:8000/detect",
    json={"image_data": "...", "camera_id": "cam001"}
)
```

### 2. Correlation Context Management
```python
from common_schemas.correlation_logger import (
    set_correlation_context,
    with_correlation,
    get_correlation_logger
)

logger = get_correlation_logger("service_name")

@with_correlation
async def process_frame(camera_id: str, image_data: str):
    # Set context for this request
    set_correlation_context(camera=camera_id)
    
    # Logs will automatically include correlation info
    logger.info("Processing frame", frame_size=len(image_data))
    
    return result
```

### 3. Circuit Breaker Integration
```python
from common_schemas.resilience import ResilienceManager

resilience = ResilienceManager("service_name")

# Execute with circuit breaker protection
result = await resilience.execute_with_circuit_breaker(
    circuit_name="external_service",
    operation=call_external_service,
    data=payload
)
```

## Service Updates

### Fusion Service (`fusion/resilient_http_service.py`)
- Complete implementation example
- Parallel service calls with circuit breaker protection
- Correlation tracking throughout pipeline
- Enhanced health checks with resilience stats

### All Service Requirements
Updated `requirements.txt` files with standardized versions:
- `/common_schemas/requirements.txt` - Base requirements
- Service-specific files inherit from common base
- CUDA services include GPU-specific packages

## Monitoring and Observability

### Health Endpoints
All services expose enhanced health checks:
```http
GET /health
{
    "status": "healthy",
    "service": "fusion",
    "resilience_stats": {
        "circuit_breakers": {...},
        "queues": {...}
    }
}
```

### Circuit Breaker Stats
```http
GET /circuit_breakers
{
    "yolo_service": {
        "state": "closed",
        "failure_count": 0,
        "success_count": 15
    }
}
```

### Performance Metrics
Structured logging includes:
- Request duration (ms)
- Circuit breaker states
- Retry attempts
- Service response times
- Error rates per service

## Docker Configuration

### Base Dockerfile (`common_schemas/Dockerfile.base`)
- Python 3.11.9 slim base
- CUDA 12.1 support for GPU services
- Common dependencies pre-installed
- Non-root user for security
- Health check configuration

### Service-Specific Dockerfiles
```dockerfile
FROM common_schemas/Dockerfile.base

# Copy service-specific requirements
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy service code
COPY . .

# Set service-specific environment
ENV SERVICE_NAME=fusion
ENV PORT=8000

# Run with correlation logging
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Migration Checklist

- [x] Standardize all `requirements.txt` files
- [x] Implement `ResilientHTTPClient` with circuit breakers
- [x] Add correlation ID tracking to all services
- [x] Replace `requests` with `httpx.AsyncClient`
- [x] Configure retry logic with jitter
- [x] Implement structured JSON logging
- [x] Create base Docker image with common dependencies
- [x] Update health checks with resilience metrics
- [ ] Deploy services with new resilience infrastructure
- [ ] Monitor circuit breaker states in production
- [ ] Validate correlation ID propagation across services

## Performance Impact

### Expected Improvements
- **Circuit Breakers**: Prevent cascade failures
- **Retry with Jitter**: Reduce thundering herd
- **Connection Pooling**: Better resource utilization
- **Correlation Tracking**: Faster issue resolution

### Monitoring Points
- Circuit breaker state changes
- Request retry rates
- Service response times
- Error correlation across services
- Resource utilization improvements

This implementation provides a robust foundation for the AI Vision platform with proper resilience patterns and observability.