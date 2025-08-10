"""
Unified event schemas for all analytics services
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum


class SeverityLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM" 
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class IncidentStatus(str, Enum):
    OPEN = "open"
    PENDING_REVIEW = "pending_review"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class Signal(BaseModel):
    """Unified signal schema for all analytics"""
    type: str = Field(..., description="Signal type (e.g., 'concealment', 'missing_ppe', 'aggression')")
    severity: SeverityLevel = Field(..., description="Signal severity level")
    ts: datetime = Field(default_factory=datetime.utcnow, description="Signal timestamp")
    camera_id: str = Field(..., description="Camera identifier")
    track_id: Optional[int] = Field(None, description="Optional tracking ID")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional signal details")
    
    # Optional analytics-specific fields
    person_id: Optional[str] = Field(None, description="Person ID for face/reid analytics")
    student_id: Optional[str] = Field(None, description="Student ID for education analytics")
    zone_id: Optional[str] = Field(None, description="Zone ID for spatial analytics")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Detection confidence")


class Incident(BaseModel):
    """Unified incident schema for all analytics"""
    aggregation_key: str = Field(..., description="Unique key for incident aggregation")
    first_ts: datetime = Field(..., description="First signal timestamp")
    last_ts: datetime = Field(..., description="Last signal timestamp") 
    severity: SeverityLevel = Field(..., description="Incident severity level")
    status: IncidentStatus = Field(default=IncidentStatus.OPEN, description="Incident status")
    signals_count: int = Field(default=1, ge=1, description="Number of aggregated signals")
    
    # Optional fields
    clip_url: Optional[str] = Field(None, description="URL to incident clip")
    report_url: Optional[str] = Field(None, description="URL to incident report")
    notes: Optional[str] = Field(None, description="Additional notes")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class ZoneHit(BaseModel):
    """Spatial zone detection event"""
    zone_id: str = Field(..., description="Zone identifier")
    zone_type: str = Field(..., description="Zone type (e.g., 'shelf', 'exit', 'restricted')")
    track_id: int = Field(..., description="Tracking ID")
    camera_id: str = Field(..., description="Camera identifier")
    ts: datetime = Field(default_factory=datetime.utcnow, description="Hit timestamp")
    entry_time: Optional[datetime] = Field(None, description="Zone entry time")
    exit_time: Optional[datetime] = Field(None, description="Zone exit time")
    dwell_seconds: Optional[float] = Field(None, ge=0, description="Time spent in zone")
    bbox: List[float] = Field(..., description="Bounding box [x1,y1,x2,y2]")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Detection confidence")


class AffectTelemetry(BaseModel):
    """Emotional/behavioral telemetry for education analytics"""
    student_id: Optional[str] = Field(None, description="Student identifier")
    camera_id: str = Field(..., description="Camera identifier")
    class_id: Optional[str] = Field(None, description="Class identifier")
    ts: datetime = Field(default_factory=datetime.utcnow, description="Telemetry timestamp")
    
    # Emotion probabilities
    affect_probs: Dict[str, float] = Field(
        default_factory=dict,
        description="Emotion probabilities (happy, sad, angry, fearful, etc.)"
    )
    affect_state: Optional[str] = Field(None, description="Dominant emotion state")
    
    # Behavioral metrics
    attention_score: Optional[float] = Field(None, ge=0, le=1, description="Attention level")
    engagement_score: Optional[float] = Field(None, ge=0, le=1, description="Engagement level")
    track_id: Optional[int] = Field(None, description="Tracking ID")
    bbox: Optional[List[float]] = Field(None, description="Face bounding box")


class TrackUpdate(BaseModel):
    """Tracking update event"""
    track_id: int = Field(..., description="Tracking ID")
    camera_id: str = Field(..., description="Camera identifier")
    ts: datetime = Field(default_factory=datetime.utcnow, description="Update timestamp")
    bbox: List[float] = Field(..., description="Bounding box [x1,y1,x2,y2]")
    confidence: float = Field(..., ge=0, le=1, description="Detection confidence")
    class_name: str = Field(..., description="Object class (person, vehicle, etc.)")
    
    # Optional tracking features
    velocity: Optional[List[float]] = Field(None, description="Velocity vector [vx, vy]")
    person_id: Optional[str] = Field(None, description="Person ID from face/reid")
    reid_features: Optional[List[float]] = Field(None, description="Re-ID feature vector")
    face_embedding: Optional[List[float]] = Field(None, description="Face embedding vector")
    
    # Spatial context
    zones: List[str] = Field(default_factory=list, description="Current zones")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class AnalyticsEvent(BaseModel):
    """Generic analytics event wrapper"""
    event_type: str = Field(..., description="Event type identifier")
    source_service: str = Field(..., description="Source analytics service")
    org_id: Optional[str] = Field(None, description="Organization ID")
    camera_id: str = Field(..., description="Camera identifier") 
    ts: datetime = Field(default_factory=datetime.utcnow, description="Event timestamp")
    payload: Dict[str, Any] = Field(..., description="Event payload")
    
    # Processing metadata
    processed_at: Optional[datetime] = Field(None, description="Processing timestamp")
    processing_time_ms: Optional[float] = Field(None, ge=0, description="Processing duration")
    version: str = Field(default="1.0", description="Schema version")