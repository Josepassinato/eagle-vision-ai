"""
Unified metrics definitions for all AI Vision services
Canonical names and labels for consistent monitoring
"""

from prometheus_client import Counter, Histogram, Gauge
from typing import Dict, Any

# =============================================================================
# COUNTER METRICS
# =============================================================================

# Frame processing metrics
frames_in_total = Counter(
    'frames_in_total',
    'Total frames received for processing',
    ['service', 'camera_id', 'org_id']
)

frames_processed_total = Counter(
    'frames_processed_total', 
    'Total frames successfully processed',
    ['service', 'camera_id', 'org_id']
)

frames_dropped_total = Counter(
    'frames_dropped_total',
    'Total frames dropped due to errors or overload',
    ['service', 'camera_id', 'org_id', 'reason']
)

# Signal and event metrics
signals_emitted_total = Counter(
    'signals_emitted_total',
    'Total signals emitted by analytics services',
    ['service', 'signal_type', 'severity', 'camera_id', 'org_id']
)

incidents_created_total = Counter(
    'incidents_created_total',
    'Total incidents created',
    ['service', 'incident_type', 'severity', 'org_id']
)

# Model inference metrics
model_predictions_total = Counter(
    'model_predictions_total',
    'Total model predictions made',
    ['service', 'model_name', 'model_version']
)

model_errors_total = Counter(
    'model_errors_total',
    'Total model inference errors',
    ['service', 'model_name', 'error_type']
)

# Service-specific counters
# SafetyVision
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

posture_unsafe_total = Counter(
    'posture_unsafe_total',
    'Total unsafe posture incidents',
    ['posture_type', 'camera_id', 'org_id']
)

# EduBehavior
affect_events_total = Counter(
    'affect_events_total',
    'Total emotional/behavioral events',
    ['event_type', 'severity', 'class_id']
)

affect_quality_below_threshold_total = Counter(
    'affect_quality_below_threshold_total',
    'Faces below quality threshold',
    ['camera_id', 'class_id']
)

# Antitheft
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
# CONVENIENCE FUNCTIONS
# =============================================================================

def get_service_metrics(service_name: str) -> Dict[str, Any]:
    """Get all metrics instances for a specific service"""
    return {
        'counters': {
            'frames_in': frames_in_total.labels(service=service_name),
            'frames_processed': frames_processed_total.labels(service=service_name),
            'frames_dropped': frames_dropped_total.labels(service=service_name),
            'signals_emitted': signals_emitted_total.labels(service=service_name),
            'incidents_created': incidents_created_total.labels(service=service_name),
            'model_predictions': model_predictions_total.labels(service=service_name),
            'model_errors': model_errors_total.labels(service=service_name),
        },
        'histograms': {
            'inference_time': inference_seconds.labels(service=service_name),
            'decision_time': decision_seconds.labels(service=service_name),
            'frame_processing_time': frame_processing_seconds.labels(service=service_name),
            'cache_operation_time': cache_operation_seconds.labels(service=service_name),
        },
        'gauges': {
            'queue_depth': queue_depth.labels(service=service_name),
            'buffer_utilization': buffer_utilization.labels(service=service_name),
            'memory_usage': memory_usage_bytes.labels(service=service_name),
            'cpu_utilization': cpu_utilization.labels(service=service_name),
            'service_health': service_health_score.labels(service=service_name),
            'active_connections': active_connections.labels(service=service_name),
        }
    }

def init_service_metrics(service_name: str, camera_ids: list = None, org_id: str = None):
    """Initialize metrics for a service with default labels"""
    metrics = get_service_metrics(service_name)
    
    # Initialize with zero values to ensure metrics appear in Prometheus
    if camera_ids and org_id:
        for camera_id in camera_ids:
            frames_in_total.labels(
                service=service_name, 
                camera_id=camera_id, 
                org_id=org_id
            )._value._value = 0
            
            frames_processed_total.labels(
                service=service_name,
                camera_id=camera_id, 
                org_id=org_id
            )._value._value = 0
    
    return metrics