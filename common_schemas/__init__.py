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
    NotifierSettings
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
    "NotifierSettings"
]