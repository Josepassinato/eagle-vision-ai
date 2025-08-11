"""
Unified event contracts for AI Vision Platform
Standardized Signal and Incident models for all services
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional, Dict, Any
from datetime import datetime

# Standard severity levels across all services
Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

# Standard signal types hierarchy
SignalType = Literal[
    # Safety signals
    "ppe.missing", "ppe.hardhat", "ppe.vest", "ppe.gloves",
    "safety.fall", "safety.posture", "safety.zone_violation",
    
    # Educational behavior signals  
    "affect.fear", "affect.anger", "affect.sadness", "affect.joy",
    "affect.distress", "affect.disengagement", "affect.high_attention",
    
    # Security/Antitheft signals
    "security.intrusion", "security.theft", "security.vandalism",
    "security.object_removed", "security.perimeter_breach",
    
    # System/Technical signals
    "system.camera_offline", "system.detection_failure", "system.quality_low",
    "people.count", "people.density", "people.flow"
]

class Signal(BaseModel):
    """
    Standardized signal format for all AI services
    
    This is the atomic unit of detection/analysis output.
    All services must emit signals in this format for dashboard consistency.
    """
    ts: float = Field(..., description="Unix timestamp when signal was generated")
    service: str = Field(..., description="Service that generated the signal")
    camera_id: str = Field(..., description="Camera identifier")
    org_id: str = Field(..., description="Organization identifier") 
    type: str = Field(..., description="Signal type (e.g., 'ppe.missing', 'affect.fear')")
    severity: Severity = Field(..., description="Signal severity level")
    details: Dict[str, Any] = Field(default_factory=dict, description="Signal-specific payload")
    track_id: Optional[str] = Field(None, description="Associated tracking ID if available")
    confidence: Optional[float] = Field(None, description="Confidence score 0.0-1.0")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.timestamp()
        }

class Incident(BaseModel):
    """
    Standardized incident format for aggregated signals
    
    Incidents are created by aggregating related signals over time.
    Used for notification and review workflows.
    """
    first_ts: float = Field(..., description="Timestamp of first signal in incident")
    last_ts: float = Field(..., description="Timestamp of last signal in incident") 
    service: str = Field(..., description="Primary service that created incident")
    camera_id: str = Field(..., description="Camera identifier")
    org_id: str = Field(..., description="Organization identifier")
    severity: Severity = Field(..., description="Highest severity in incident")
    status: Literal["open", "ack", "closed"] = Field("open", description="Incident lifecycle status")
    aggregation_key: str = Field(..., description="Unique key for grouping signals (e.g., 'ppe:missing:cam123')")
    signals_count: int = Field(1, description="Number of signals aggregated into this incident")
    incident_type: str = Field(..., description="Type derived from aggregated signals")
    
    # Optional enrichment fields
    review_notes: Optional[str] = Field(None, description="Human review notes")
    reviewer_id: Optional[str] = Field(None, description="ID of reviewing user")
    notification_sent: bool = Field(False, description="Whether notification was sent")

# Standard response models for API consistency
class AnalysisResponse(BaseModel):
    """Standardized response format for frame analysis endpoints"""
    signals: list[Dict[str, Any]] = Field(default_factory=list)  # Signal.dict() format
    incidents: list[Dict[str, Any]] = Field(default_factory=list) # Incident.dict() format
    telemetry: Dict[str, Any] = Field(default_factory=dict)
    processing_time_ms: Optional[float] = None

# Helper functions for signal creation
def create_signal(
    service: str,
    camera_id: str, 
    org_id: str,
    signal_type: str,
    severity: Severity,
    details: Dict[str, Any] = None,
    track_id: str = None,
    confidence: float = None,
    timestamp: float = None
) -> Signal:
    """Helper to create standardized signals"""
    return Signal(
        ts=timestamp or datetime.now().timestamp(),
        service=service,
        camera_id=camera_id,
        org_id=org_id,
        type=signal_type,
        severity=severity,
        details=details or {},
        track_id=track_id,
        confidence=confidence
    )

def create_incident(
    service: str,
    camera_id: str,
    org_id: str, 
    incident_type: str,
    severity: Severity,
    aggregation_key: str,
    signals_count: int = 1,
    first_ts: float = None,
    last_ts: float = None
) -> Incident:
    """Helper to create standardized incidents"""
    now = datetime.now().timestamp()
    return Incident(
        first_ts=first_ts or now,
        last_ts=last_ts or now,
        service=service,
        camera_id=camera_id,
        org_id=org_id,
        severity=severity,
        aggregation_key=aggregation_key,
        signals_count=signals_count,
        incident_type=incident_type
    )