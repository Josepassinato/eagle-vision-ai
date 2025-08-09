"""
Vision Tracking Module - Visão de Águia
Tracking de objetos e medição de movimento para pipeline de visão
"""

from .tracker import VisionTracker
from .motion import MotionAnalyzer

__version__ = "1.0.0"
__all__ = ["VisionTracker", "MotionAnalyzer"]