"""
EduBehavior service settings using Pydantic
"""

import sys
sys.path.append('/common_schemas')

from common_schemas import EduBehaviorSettings

# Load settings with validation
settings = EduBehaviorSettings()

# Export for compatibility
PORT = settings.port
ALLOWED_ORIGINS = settings.allowed_origins
SUPABASE_URL = settings.supabase_url
SUPABASE_SERVICE_ROLE_KEY = settings.supabase_service_role_key
EDU_NOTIFY_MIN_SEVERITY = settings.edu_notify_min_severity

# Model settings
EMOTION_CONFIDENCE_THRESHOLD = settings.emotion_confidence_threshold
ATTENTION_THRESHOLD = settings.attention_threshold