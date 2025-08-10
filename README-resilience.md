# Resilience System Implementation

This document outlines the comprehensive resilience system implemented across all analytics services.

## Overview

The resilience system provides:
- **Ingest resilience**: Local disk queues with backpressure and TTL
- **Circuit breakers**: Per-camera protection with exponential backoff
- **Health monitoring**: Real-time camera status published to Supabase
- **Policy management**: Hot-reload configuration without restarts
- **Universal anonymization**: Face/plate blur with org-level controls
- **Performance optimization**: GPU/CPU optimization and ONNX acceleration
- **API contracts**: Auto-generated OpenAPI specs and TypeScript types

## Components

### 1. Resilience Queue System

```python
from common_schemas import ResilienceQueue, QueueConfig

# Create queue with backpressure
queue = ResilienceQueue("events", QueueConfig(
    max_queue_size=1000,
    max_queue_seconds=300.0,  # 5 minute TTL
    batch_size=10
))

# Enqueue with priority
await queue.enqueue(event_data, priority=1)

# Process batches
batch = await queue.dequeue_batch()
```

**Features:**
- Memory + disk fallback queue
- Automatic TTL cleanup  
- Backpressure protection
- Background batch processing

### 2. Circuit Breaker Protection

```python
from common_schemas import CircuitBreaker, CircuitBreakerConfig

# Per-camera circuit breaker
circuit = CircuitBreaker("camera_1", CircuitBreakerConfig(
    failure_threshold=5,
    recovery_timeout=60.0,
    success_threshold=3
))

# Execute with protection
if circuit.can_execute():
    try:
        result = await process_camera_frame()
        circuit.record_success()
    except Exception as e:
        circuit.record_failure()
        raise
```

**Features:**
- Exponential backoff with jitter
- Half-open state for recovery testing
- Per-resource isolation
- Automatic failure detection

### 3. Camera Health Monitoring

```python
from common_schemas import CameraHealthMonitor

monitor = CameraHealthMonitor(supabase_client)

# Update camera stats
monitor.update_camera_stats("cam_1", {
    'frames_processed': 100,
    'avg_latency_ms': 45,
    'errors_count': 0
})

# Automatic Supabase updates every 30s
await monitor.start_monitoring()
```

**Features:**
- Real-time health publishing
- Automatic online/offline detection
- Error tracking and reporting
- Circuit breaker state monitoring

### 4. Policy Management

```python
from common_schemas import PolicyManager, AntitheftPolicy

policy_manager = PolicyManager("antitheft", supabase_client)

# Get hierarchical policy (org -> camera -> global)
policy = await policy_manager.get_policy(
    "antitheft", 
    org_id="org_123",
    camera_id="cam_1"
)

# Hot reload without restart
await policy_manager.start_hot_reload()
```

**Hierarchy (most specific wins):**
1. Camera-specific: `org_id + camera_id`
2. Organization-specific: `org_id` only  
3. Global default: no filters

**Features:**
- Hot reload via webhook
- Local caching with TTL
- Hierarchical fallback
- Type-safe policy objects

### 5. Universal Anonymization

```python
from common_schemas import AnonymizationMiddleware, BlurConfig

middleware = AnonymizationMiddleware()

config = BlurConfig(
    face_blur_enabled=True,
    license_plate_blur_enabled=True,
    blur_strength=0.8
)

# Process frame
anonymized_frame = await middleware.process_frame(frame, config)

# Process base64 image
anonymized_b64 = await middleware.process_image_b64(image_b64, config)
```

**Features:**
- Face detection + blur
- License plate detection + blur  
- Configurable blur strength
- Policy-driven enable/disable
- Frame and clip processing

### 6. Performance Optimization

```python
from common_schemas import apply_service_optimizations, get_optimizer

# Apply optimizations for service type
apply_service_optimizations("fusion")

# Get device configuration
optimizer = get_optimizer()
device_config = optimizer.get_device_config("yolo")

# ONNX optimization
from common_schemas import ONNXOptimizer
onnx_optimizer = ONNXOptimizer(gpu_available=True)
providers = onnx_optimizer.get_providers("reid")
```

**Optimizations:**
- CPU thread limits for lower latency
- GPU memory optimization
- TensorRT acceleration for ONNX
- Automatic batch size tuning
- Resource monitoring

### 7. API Contracts

```python
from common_schemas import export_service_contracts

# Generate complete contracts
contracts = export_service_contracts(app, "fusion", "2.0.0")

# Access generated files
openapi_spec = contracts['schema']        # OpenAPI JSON
typescript_types = contracts['types']     # TypeScript interfaces
```

**Generated Assets:**
- OpenAPI 3.0 specification
- TypeScript interfaces
- API client methods
- Request/response types

## Service Integration

### Updated Service Structure

```python
# service/main.py
import sys
sys.path.append('/common_schemas')

from common_schemas import (
    ResilienceManager,
    PolicyManager,
    apply_service_optimizations
)

# Apply optimizations
apply_service_optimizations("service_name")

# Initialize resilience
resilience = ResilienceManager("service_name", supabase_client)
policy_manager = PolicyManager("service_name", supabase_client)

@app.on_event("startup")
async def startup():
    await resilience.start_all()
    await policy_manager.start_hot_reload()

@app.on_event("shutdown") 
async def shutdown():
    await resilience.stop_all()
    await policy_manager.stop_hot_reload()
```

### Circuit Breaker Integration

```python
@app.post("/process")
async def process_with_resilience(request):
    camera_id = request.camera_id
    
    # Execute with circuit breaker
    try:
        result = await resilience.execute_with_circuit_breaker(
            f"camera_{camera_id}",
            process_camera_frame,
            request,
            camera_id=camera_id
        )
        return result
    except Exception as e:
        # Circuit breaker handles failure tracking
        raise HTTPException(status_code=503, detail="Camera unavailable")
```

## Database Schema

### Service Policies Table

```sql
CREATE TABLE public.service_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.orgs(id),
    camera_id TEXT,
    class_id UUID, 
    site_id TEXT,
    service_name TEXT NOT NULL,
    policy_type TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    UNIQUE(org_id, camera_id, class_id, site_id, policy_type)
);
```

### Camera Health Updates

The `cameras` table is automatically updated with health information:

```sql
-- Updated by CameraHealthMonitor
UPDATE cameras SET 
    online = true/false,
    last_seen = now(),
    metadata = {
        'frames_processed': 1000,
        'errors_count': 2,
        'avg_latency_ms': 45,
        'circuit_breaker_state': 'closed'
    }
WHERE id = 'camera_id';
```

## Deployment

### Docker Integration

All services now include security hardening and resilience:

```yaml
# docker-compose.yml
services:
  fusion:
    build: ./fusion
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=500m
    environment:
      - PYTHONPATH=/app:/common_schemas
```

### Performance Configuration

```bash
# GPU services
ORT_TENSORRT_FP16_ENABLE=1
ORT_TENSORRT_ENGINE_CACHE_ENABLE=1
CUDA_CACHE_MAXSIZE=2147483648

# CPU services  
OMP_NUM_THREADS=4
OPENBLAS_NUM_THREADS=4
```

## Monitoring

### Health Dashboard

The UI automatically displays camera health from the resilience system:

- Online/offline status
- Frame processing rate  
- Error counts
- Circuit breaker states
- Average latency

### Queue Monitoring

```bash
# Get queue stats
curl http://service:8080/queue/stats

{
  "memory_queue_size": 45,
  "disk_queue_size": 12,
  "total_queued": 57
}
```

### Policy Monitoring  

```bash
# Get active policies
curl http://service:8080/policies

{
  "policies": {
    "privacy": { "face_blur_enabled": true },
    "antitheft": { "shelf_out_delta": 2.0 }
  }
}
```

## Benefits

### Operational Excellence
- **Zero-downtime** policy updates
- **Automatic recovery** from camera failures
- **Predictable performance** under load
- **Observable system** health

### Security & Compliance
- **Universal anonymization** with policy control
- **Read-only containers** with minimal privileges
- **Encrypted** policy storage
- **Audit trail** for all changes

### Developer Experience
- **Type-safe** configurations
- **Auto-generated** API clients
- **Unified** event schemas
- **Performance** optimizations out-of-the-box