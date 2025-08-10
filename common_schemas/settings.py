"""
Unified settings schemas using Pydantic Settings
"""

from typing import Optional, List
from pydantic import BaseSettings, Field, validator
from pydantic_settings import BaseSettings as PydanticBaseSettings


class BaseServiceSettings(PydanticBaseSettings):
    """Base settings for all services"""
    
    # Service config
    port: int = Field(default=8080, description="Service port")
    host: str = Field(default="0.0.0.0", description="Service host")
    log_level: str = Field(default="INFO", description="Logging level")
    request_timeout: float = Field(default=30.0, ge=0, description="Request timeout in seconds")
    
    # CORS
    allowed_origins: List[str] = Field(default=["*"], description="Allowed CORS origins")
    
    @validator('allowed_origins', pre=True)
    def parse_origins(cls, v):
        if isinstance(v, str):
            return v.split(",")
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False


class SupabaseSettings(PydanticBaseSettings):
    """Supabase connection settings"""
    
    supabase_url: str = Field(..., description="Supabase URL")
    supabase_service_role_key: str = Field(..., description="Supabase service role key")
    
    @validator('supabase_url')
    def validate_url(cls, v):
        if not v.startswith(('http://', 'https://')):
            raise ValueError('Supabase URL must start with http:// or https://')
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = False


class NotifierSettings(PydanticBaseSettings):
    """Notifier service settings"""
    
    notifier_url: str = Field(default="http://notifier:8085", description="Notifier service URL")
    enable_notifier: bool = Field(default=True, description="Enable notifications")
    notification_timeout: float = Field(default=5.0, ge=0, description="Notification timeout")
    
    class Config:
        env_file = ".env"
        case_sensitive = False


class AntitheftSettings(BaseServiceSettings, SupabaseSettings, NotifierSettings):
    """Antitheft service specific settings"""
    
    # HLS/Recording settings
    hls_url: str = Field(default="http://mediamtx:8888/simulador/index.m3u8", description="HLS stream URL")
    bucket_name: str = Field(default="antitheft_clips", description="Storage bucket name")
    export_duration: int = Field(default=10, ge=1, description="Clip export duration in seconds")
    
    # Antitheft rules
    shelf_out_delta: float = Field(default=2.0, ge=0, description="Shelf out detection threshold")
    concealment_dwell_s: float = Field(default=2.0, ge=0, description="Concealment dwell time")
    exit_grace_min: float = Field(default=10.0, ge=0, description="Exit grace period in minutes")
    cart_pushout_diff: float = Field(default=3.0, ge=0, description="Cart pushout difference threshold")
    high_value_dwell_s: float = Field(default=20.0, ge=0, description="High value item dwell time")


class FusionSettings(BaseServiceSettings, SupabaseSettings, NotifierSettings):
    """Fusion service specific settings"""
    
    # External service URLs
    yolo_url: str = Field(default="http://yolo:18060", description="YOLO detection service URL")
    face_url: str = Field(default="http://face:18081", description="Face recognition service URL") 
    reid_url: str = Field(default="http://reid:18090", description="Re-ID service URL")
    antitheft_url: str = Field(default="http://antitheft:8088", description="Antitheft service URL")
    
    # Ingest settings
    ingest_event_url: Optional[str] = Field(None, description="Event ingest endpoint URL")
    vision_webhook_secret: Optional[str] = Field(None, description="Vision webhook secret")
    
    # Processing settings
    face_threshold: float = Field(default=0.7, ge=0, le=1, description="Face recognition threshold")
    reid_threshold: float = Field(default=0.6, ge=0, le=1, description="Re-ID threshold")
    person_confidence_threshold: float = Field(default=0.5, ge=0, le=1, description="Person detection threshold")
    
    # Performance settings
    max_tracks_per_camera: int = Field(default=50, ge=1, description="Max tracks per camera")
    track_ttl_seconds: int = Field(default=30, ge=1, description="Track TTL in seconds")


class EduBehaviorSettings(BaseServiceSettings, SupabaseSettings):
    """Education behavior service specific settings"""
    
    # Notification settings
    edu_notify_min_severity: str = Field(default="HIGH", description="Minimum severity for notifications")
    
    # Model settings
    emotion_confidence_threshold: float = Field(default=0.6, ge=0, le=1, description="Emotion confidence threshold")
    attention_threshold: float = Field(default=0.5, ge=0, le=1, description="Attention detection threshold")
    
    @validator('edu_notify_min_severity')
    def validate_severity(cls, v):
        allowed = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        if v not in allowed:
            raise ValueError(f'Severity must be one of {allowed}')
        return v


class FramePullerSettings(BaseServiceSettings):
    """Frame puller service specific settings"""
    
    # Stream settings
    stream_url: str = Field(..., description="RTSP stream URL")
    fusion_url: str = Field(default="http://fusion:8080", description="Fusion service URL")
    camera_id: str = Field(..., description="Camera identifier")
    
    # Performance settings
    puller_fps: int = Field(default=8, ge=1, le=30, description="Frame pulling FPS")
    max_image_mb: float = Field(default=0.5, ge=0.1, le=5.0, description="Max image size in MB")
    min_fps: int = Field(default=3, ge=1, description="Minimum FPS")
    max_fps: int = Field(default=10, ge=1, description="Maximum FPS")
    latency_threshold: float = Field(default=0.5, ge=0, description="Latency threshold")
    reconnect_delay: int = Field(default=5, ge=1, description="Reconnect delay in seconds")