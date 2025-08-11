"""
EduBehavior service settings
"""

import os
from typing import List

# Core settings
PORT = int(os.getenv("PORT", "8080"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
EDU_NOTIFY_MIN_SEVERITY = os.getenv("EDU_NOTIFY_MIN_SEVERITY", "HIGH")

# Model settings
EMOTION_CONFIDENCE_THRESHOLD = float(os.getenv("EMOTION_CONFIDENCE_THRESHOLD", "0.65"))
ATTENTION_THRESHOLD = float(os.getenv("ATTENTION_THRESHOLD", "0.55"))

# EMA and pipeline settings
EDU_AFFECT_EMA_ALPHA = float(os.getenv("EDU_AFFECT_EMA_ALPHA", "0.3"))
EDU_AFFECT_MIN_QUALITY = float(os.getenv("EDU_AFFECT_MIN_QUALITY", "0.5"))

# Model path
EMOTION_MODEL_PATH = os.getenv("EMOTION_MODEL_PATH", "/models/emotion_model.onnx")