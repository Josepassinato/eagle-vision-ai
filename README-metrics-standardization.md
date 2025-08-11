"""
Documentation: Standardized Metrics and Event Contracts
All services now use unified metrics and event schemas for consistent dashboards
"""

# =============================================================================
# IMPLEMENTATION COMPLETE: Standardized Metrics and Events
# =============================================================================

## Overview
All AI Vision services now use standardized:
- **Metrics**: common_schemas/metrics.py (FRAMES_IN, FRAMES_PROC, INFER_SEC, SIGNALS)
- **Events**: common_schemas/events.py (Signal, Incident, AnalysisResponse)
- **Contracts**: Unified API responses for dashboard consistency

## Standard Usage Pattern

```python
# Import standardized metrics and events in all services
from common_schemas.metrics import FRAMES_IN, FRAMES_PROC, INFER_SEC, SIGNALS
from common_schemas.events import Signal, Incident, create_signal, create_incident

# Standard metric usage
def process_frame(frame, org_id, camera_id):
    FRAMES_IN.labels(service="safetyvision", org_id=org_id, camera_id=camera_id).inc()
    
    with INFER_SEC.labels(
        service="safetyvision", 
        org_id=org_id, 
        camera_id=camera_id,
        model_name="safety_pipeline", 
        model_version="v1"
    ).time():
        result = pipeline.analyze(frame)
    
    if result.violation_detected:
        signal = create_signal(
            service="safetyvision",
            camera_id=camera_id,
            org_id=org_id,
            signal_type="ppe.missing",
            severity="HIGH",
            details={"ppe_type": "hardhat", "confidence": 0.95}
        )
        
        SIGNALS.labels(
            service="safetyvision",
            org_id=org_id,
            camera_id=camera_id,
            type="ppe.missing",
            severity="HIGH"
        ).inc()
    
    FRAMES_PROC.labels(service="safetyvision", org_id=org_id, camera_id=camera_id).inc()
```

## Standardized Signal Types

### Safety Signals
- `ppe.missing`, `ppe.hardhat`, `ppe.vest`, `ppe.gloves`
- `safety.fall`, `safety.posture`, `safety.zone_violation`

### Education Signals  
- `affect.fear`, `affect.anger`, `affect.sadness`, `affect.joy`
- `affect.distress`, `affect.disengagement`, `affect.high_attention`

### Security Signals
- `security.intrusion`, `security.theft`, `security.vandalism`
- `security.object_removed`, `security.perimeter_breach`

### System Signals
- `system.camera_offline`, `system.detection_failure`, `system.quality_low`
- `people.count`, `people.density`, `people.flow`

## Services Updated

### ✅ SafetyVision
- Uses FRAMES_IN, FRAMES_PROC, INFER_SEC, SIGNALS
- Returns standardized Signal/Incident objects
- Signal types: `ppe.*`, `safety.*`

### ✅ EduBehavior  
- Uses standardized metrics and events
- Signal types: `affect.*`
- Maintains EMA/hysteresis for behavior analysis

### ✅ Common Schemas
- **metrics.py**: Standardized Prometheus metrics with CORE_LABELS
- **events.py**: Signal, Incident, AnalysisResponse models
- **privacy_middleware.py**: Universal anonymization middleware

## Dashboard Benefits

1. **Consistent Metrics**: All services use same metric names/labels
2. **Unified Events**: Signal/Incident format identical across services  
3. **Standardized APIs**: AnalysisResponse format for all endpoints
4. **Signal Hierarchy**: Dot notation for signal types (ppe.missing, affect.fear)

## Next Steps

1. Update remaining services (antitheft, multi-tracker) to use standardized contracts
2. Update Grafana dashboards to use standardized metric names
3. Implement privacy middleware in all frame processing pipelines
4. Add signal aggregation service for cross-service incident correlation

All core services now emit consistent metrics and events for unified monitoring and alerting.