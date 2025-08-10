"""
Common Schemas Package
Unified Pydantic models for events across all analytics services
"""

from .events import (
    Signal,
    Incident, 
    ZoneHit,
    AffectTelemetry,
    TrackUpdate,
    AnalyticsEvent
)

from .settings import (
    BaseServiceSettings,
    SupabaseSettings,
    NotifierSettings,
    AntitheftSettings,
    FusionSettings,
    EduBehaviorSettings,
    FramePullerSettings
)

from .resilience import (
    CircuitBreaker,
    CircuitBreakerConfig,
    ResilienceQueue,
    QueueConfig,
    CameraHealthMonitor,
    ResilienceManager
)

from .policies import (
    PolicyConfig,
    AntitheftPolicy,
    EduBehaviorPolicy,
    SafetyVisionPolicy,
    PrivacyPolicy,
    PolicyManager,
    PolicyCache
)

from .anonymization import (
    BlurConfig,
    AnonymizationMiddleware,
    ClipAnonymizer
)

from .performance import (
    PerformanceOptimizer,
    ONNXOptimizer,
    ResourceMonitor,
    get_optimizer,
    apply_service_optimizations
)

from .contracts import (
    generate_openapi_spec,
    extract_typescript_types,
    export_service_contracts
)

__all__ = [
    "Signal",
    "Incident", 
    "ZoneHit",
    "AffectTelemetry",
    "TrackUpdate",
    "AnalyticsEvent",
    "BaseServiceSettings",
    "SupabaseSettings", 
    "NotifierSettings",
    "AntitheftSettings",
    "FusionSettings",
    "EduBehaviorSettings",
    "FramePullerSettings",
    "CircuitBreaker",
    "CircuitBreakerConfig",
    "ResilienceQueue",
    "QueueConfig",
    "CameraHealthMonitor",
    "ResilienceManager",
    "PolicyConfig",
    "AntitheftPolicy",
    "EduBehaviorPolicy",
    "SafetyVisionPolicy",
    "PrivacyPolicy",
    "PolicyManager",
    "PolicyCache",
    "BlurConfig",
    "AnonymizationMiddleware", 
    "ClipAnonymizer",
    "PerformanceOptimizer",
    "ONNXOptimizer",
    "ResourceMonitor",
    "get_optimizer",
    "apply_service_optimizations",
    "generate_openapi_spec",
    "extract_typescript_types",
    "export_service_contracts"
]