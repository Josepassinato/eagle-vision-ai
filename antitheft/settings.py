"""
Antitheft service settings using Pydantic
"""

import sys
sys.path.append('/common_schemas')

from common_schemas import AntitheftSettings

# Load settings with validation
settings = AntitheftSettings()

# Export for compatibility
SUPABASE_URL = settings.supabase_url
SUPABASE_SERVICE_ROLE_KEY = settings.supabase_service_role_key
NOTIFIER_URL = settings.notifier_url
HLS_URL = settings.hls_url
BUCKET_NAME = settings.bucket_name
EXPORT_DURATION = settings.export_duration

# Antitheft rules
SHELF_OUT_DELTA = settings.shelf_out_delta
CONCEALMENT_DWELL_S = settings.concealment_dwell_s
EXIT_GRACE_MIN = settings.exit_grace_min
CART_PUSHOUT_DIFF = settings.cart_pushout_diff
HIGH_VALUE_DWELL_S = settings.high_value_dwell_s

REQUEST_TIMEOUT = settings.request_timeout