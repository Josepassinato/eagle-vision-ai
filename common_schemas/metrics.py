"""
Unified metrics definitions for all AI Vision services
Canonical names and labels for consistent monitoring and dashboards
"""

from prometheus_client import Counter, Histogram, Gauge
from typing import Dict, Any, List

# =============================================================================
# STANDARD LABELS - Used across all services for consistency
# =============================================================================

# Core labels that every metric should include
CORE_LABELS = ["service", "org_id", "camera_id"]

# Extended labels for specific metric types
SIGNAL_LABELS = CORE_LABELS + ["type", "severity"] 
MODEL_LABELS = CORE_LABELS + ["model_name", "model_version"]
QUEUE_LABELS = CORE_LABELS + ["queue_type"]

# =============================================================================
# STANDARDIZED METRICS - Import these in all services
# =============================================================================

# Frame processing metrics (core pipeline)
FRAMES_IN = Counter(
    'frames_in_total',
    'Total frames received for processing',
    CORE_LABELS
)

FRAMES_PROC = Counter(
    'frames_processed_total', 
    'Total frames successfully processed',
    CORE_LABELS
)

FRAMES_DROP = Counter(
    'frames_dropped_total',
    'Total frames dropped due to errors or overload',
    CORE_LABELS + ["reason"]
)

# Inference performance metrics
INFER_SEC = Histogram(
    'inference_seconds',
    'Time spent on model inference (seconds)',
    MODEL_LABELS,
    buckets=[0.01, 0.02, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.0, 2.0, 5.0]
)

DECISION_SEC = Histogram(
    'decision_seconds', 
    'Time spent on decision logic (seconds)',
    CORE_LABELS + ["decision_type"],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Signal generation metrics
SIGNALS = Counter(
    'signals_emitted_total',
    'Total signals emitted by services',
    SIGNAL_LABELS
)

INCIDENTS = Counter(
    'incidents_created_total',
    'Total incidents created',
    CORE_LABELS + ["incident_type", "severity"]
)

# Queue and system metrics
QUEUE_DEPTH = Gauge(
    'queue_depth',
    'Current depth of processing queues',
    QUEUE_LABELS
)

MEMORY_USAGE = Gauge(
    'memory_usage_bytes',
    'Current memory usage in bytes',
    CORE_LABELS + ["memory_type"]
)

CPU_UTIL = Gauge(
    'cpu_utilization',
    'Current CPU utilization (0-1)',
    CORE_LABELS
)

GPU_UTIL = Gauge(
    'gpu_utilization', 
    'Current GPU utilization (0-1)',
    CORE_LABELS + ["gpu_id"]
)

# Service health and quality metrics
SERVICE_HEALTH = Gauge(
    'service_health_score',
    'Overall service health score (0-1)',
    ["service"]
)

MODEL_ACCURACY = Gauge(
    'model_accuracy',
    'Current model accuracy score',
    MODEL_LABELS + ["metric_type"]
)

CACHE_HIT_RATIO = Gauge(
    'cache_hit_ratio',
    'Cache hit ratio (0-1)',
    CORE_LABELS + ["cache_type"]
)

# =============================================================================
# LEGACY METRICS - Deprecated, use standardized versions above
# =============================================================================

# Keep for backward compatibility, but prefer FRAMES_* versions
frames_in_total = FRAMES_IN
frames_processed_total = FRAMES_PROC
frames_dropped_total = FRAMES_DROP
signals_emitted_total = SIGNALS
incidents_created_total = INCIDENTS

# Specific service metrics (legacy - will be refactored)
ppe_violations_total = Counter(
    'ppe_violations_total',
    'Total PPE violations detected',
    ['ppe_type', 'camera_id', 'org_id', 'severity']
)

fall_alerts_total = Counter(
    'fall_alerts_total',
    'Total fall incidents detected',
    ['camera_id', 'org_id', 'confidence_level']
)

affect_events_total = Counter(
    'affect_events_total',
    'Total emotional/behavioral events',
    ['event_type', 'severity', 'class_id']
)

# Histogram metrics (legacy names)
inference_seconds = INFER_SEC
decision_seconds = DECISION_SEC
frame_processing_seconds = Histogram(
    'frame_processing_seconds',
    'Total time to process a frame',
    CORE_LABELS,
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

affect_infer_seconds = Histogram(
    'affect_infer_seconds',
    'Time spent on emotion inference',
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Gauge metrics (legacy names)
queue_depth = QUEUE_DEPTH
memory_usage_bytes = MEMORY_USAGE
cpu_utilization = CPU_UTIL
gpu_utilization = GPU_UTIL
service_health_score = SERVICE_HEALTH
model_accuracy = MODEL_ACCURACY
cache_hit_ratio = CACHE_HIT_RATIO

# Additional legacy gauges
buffer_utilization = Gauge(
    'buffer_utilization',
    'Current buffer utilization (0-1)',
    ['service', 'buffer_type']
)

model_confidence_avg = Gauge(
    'model_confidence_avg',
    'Average model confidence over time window',
    ['service', 'model_name']
)

active_connections = Gauge(
    'active_connections',
    'Number of active connections',
    ['service', 'connection_type']
)

cache_size = Gauge(
    'cache_size',
    'Current cache size (items)',
    ['service', 'cache_type']
)

affect_quality_below_threshold_total = Counter(
    'affect_quality_below_threshold_total',
    'Faces below quality threshold',
    ['camera_id', 'class_id']
)

cache_operation_seconds = Histogram(
    'cache_operation_seconds',
    'Time spent on cache operations',
    ['service', 'operation', 'cache_type'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
)

posture_unsafe_total = Counter(
    'posture_unsafe_total',
    'Total unsafe posture incidents',
    ['posture_type', 'camera_id', 'org_id']
)

theft_signals_total = Counter(
    'theft_signals_total',
    'Total theft-related signals',
    ['signal_type', 'camera_id', 'org_id']
)

# =============================================================================
# HISTOGRAM METRICS
# =============================================================================

# Processing time metrics
inference_seconds = Histogram(
    'inference_seconds',
    'Time spent on model inference',
    ['service', 'model_name'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

decision_seconds = Histogram(
    'decision_seconds', 
    'Time spent on decision logic',
    ['service', 'decision_type'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

frame_processing_seconds = Histogram(
    'frame_processing_seconds',
    'Total time to process a frame',
    ['service', 'camera_id'],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0]
)

# EduBehavior specific
affect_infer_seconds = Histogram(
    'affect_infer_seconds',
    'Time spent on emotion inference',
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0]
)

# Cache performance
cache_operation_seconds = Histogram(
    'cache_operation_seconds',
    'Time spent on cache operations',
    ['service', 'operation', 'cache_type'],
    buckets=[0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
)

# =============================================================================
# GAUGE METRICS
# =============================================================================

# Queue and buffer metrics
queue_depth = Gauge(
    'queue_depth',
    'Current depth of processing queues',
    ['service', 'queue_type', 'camera_id']
)

buffer_utilization = Gauge(
    'buffer_utilization',
    'Current buffer utilization (0-1)',
    ['service', 'buffer_type']
)

# Model metrics
model_accuracy = Gauge(
    'model_accuracy',
    'Current model accuracy score',
    ['service', 'model_name', 'metric_type']
)

model_confidence_avg = Gauge(
    'model_confidence_avg',
    'Average model confidence over time window',
    ['service', 'model_name']
)

# System resource metrics
memory_usage_bytes = Gauge(
    'memory_usage_bytes',
    'Current memory usage in bytes',
    ['service', 'memory_type']
)

cpu_utilization = Gauge(
    'cpu_utilization',
    'Current CPU utilization (0-1)',
    ['service']
)

gpu_utilization = Gauge(
    'gpu_utilization', 
    'Current GPU utilization (0-1)',
    ['service', 'gpu_id']
)

# Service health metrics
service_health_score = Gauge(
    'service_health_score',
    'Overall service health score (0-1)',
    ['service']
)

active_connections = Gauge(
    'active_connections',
    'Number of active connections',
    ['service', 'connection_type']
)

# Cache metrics
cache_size = Gauge(
    'cache_size',
    'Current cache size (items)',
    ['service', 'cache_type']
)

cache_hit_ratio = Gauge(
    'cache_hit_ratio',
    'Cache hit ratio (0-1)',
    ['service', 'cache_type']
)

# =============================================================================
# CONVENIENCE FUNCTIONS - Simplified metric access
# =============================================================================

def get_service_metrics(service_name: str) -> Dict[str, Any]:
    """Get all standard metrics instances for a specific service"""
    return {
        'counters': {
            'frames_in': FRAMES_IN.labels(service=service_name),
            'frames_processed': FRAMES_PROC.labels(service=service_name),
            'frames_dropped': FRAMES_DROP.labels(service=service_name),
            'signals_emitted': SIGNALS.labels(service=service_name),
            'incidents_created': INCIDENTS.labels(service=service_name),
        },
        'histograms': {
            'inference_time': INFER_SEC.labels(service=service_name),
            'decision_time': DECISION_SEC.labels(service=service_name),
            'frame_processing_time': frame_processing_seconds.labels(service=service_name),
        },
        'gauges': {
            'queue_depth': QUEUE_DEPTH.labels(service=service_name),
            'memory_usage': MEMORY_USAGE.labels(service=service_name),
            'cpu_utilization': CPU_UTIL.labels(service=service_name),
            'service_health': SERVICE_HEALTH.labels(service=service_name),
        }
    }

def init_service_metrics(service_name: str, camera_ids: List[str] = None, org_id: str = None):
    """Initialize metrics for a service with default labels"""
    metrics = get_service_metrics(service_name)
    
    # Initialize with zero values to ensure metrics appear in Prometheus
    if camera_ids and org_id:
        for camera_id in camera_ids:
            FRAMES_IN.labels(
                service=service_name, 
                camera_id=camera_id, 
                org_id=org_id
            )._value._value = 0
            
            FRAMES_PROC.labels(
                service=service_name,
                camera_id=camera_id, 
                org_id=org_id
            )._value._value = 0
    
    return metrics

# =============================================================================
# STANDARDIZED USAGE EXAMPLES
# =============================================================================

"""
# Standard usage in services:

from common_schemas.metrics import FRAMES_IN, FRAMES_PROC, INFER_SEC, SIGNALS
from common_schemas.events import Signal, Incident

# In your service:
def process_frame(frame, org_id, camera_id):
    FRAMES_IN.labels(service="edubehavior", org_id=org_id, camera_id=camera_id).inc()
    
    with INFER_SEC.labels(service="edubehavior", org_id=org_id, camera_id=camera_id, 
                         model_name="emotion", model_version="v1").time():
        result = model.predict(frame)
    
    if result.confidence > 0.8:
        SIGNALS.labels(service="edubehavior", org_id=org_id, camera_id=camera_id,
                      type="affect.fear", severity="HIGH").inc()
        
        signal = Signal(
            ts=time.time(),
            service="edubehavior", 
            camera_id=camera_id,
            org_id=org_id,
            type="affect.fear",
            severity="HIGH",
            details={"confidence": result.confidence}
        )
    
    FRAMES_PROC.labels(service="edubehavior", org_id=org_id, camera_id=camera_id).inc()
"""