"""
Fusion service settings using Pydantic
"""

import sys
sys.path.append('/common_schemas')

from common_schemas import FusionSettings

# Load settings with validation
settings = FusionSettings()

# Export for compatibility
YOLO_URL = settings.yolo_url
FACE_URL = settings.face_url
REID_URL = settings.reid_url
SUPABASE_URL = settings.supabase_url
SUPABASE_SERVICE_ROLE_KEY = settings.supabase_service_role_key
INGEST_EVENT_URL = settings.ingest_event_url
VISION_WEBHOOK_SECRET = settings.vision_webhook_secret
NOTIFIER_URL = settings.notifier_url
ANTITHEFT_URL = settings.antitheft_url

# Processing thresholds
FACE_THRESHOLD = settings.face_threshold
REID_THRESHOLD = settings.reid_threshold
PERSON_CONFIDENCE_THRESHOLD = settings.person_confidence_threshold

# Performance settings
MAX_TRACKS_PER_CAMERA = settings.max_tracks_per_camera
TRACK_TTL_SECONDS = settings.track_ttl_seconds

REQUEST_TIMEOUT = settings.request_timeout