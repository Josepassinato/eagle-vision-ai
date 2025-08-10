#!/usr/bin/env python3
"""
Enhanced Decision Engine for Fusion Service
Centralizes decision making with explicit scoring and comprehensive logging
"""

import json
import time
import hashlib
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

import numpy as np
from pydantic import BaseModel
from prometheus_client import Histogram, Counter

# Decision metrics
decision_confidence_bucketed = Histogram(
    'fusion_decision_confidence_bucketed', 
    'Decision confidence distribution',
    ['decision_type'],
    buckets=[0.1, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0]
)
decision_explanations_total = Counter(
    'fusion_decision_explanations_total', 
    'Count of decision explanations', 
    ['explanation']
)

class DecisionSource(Enum):
    FACE = "face"
    REID = "reid"  
    MOTION = "motion"
    FUSION = "fusion"

class DecisionType(Enum):
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    PENDING = "pending"

@dataclass
class SourceScore:
    """Individual scoring source with confidence and weight"""
    source: DecisionSource
    similarity: float
    confidence: float
    weight: float
    metadata: Dict[str, Any]

@dataclass
class DecisionRecord:
    """Comprehensive decision record with explainability"""
    track_id: str
    person_id: Optional[str]
    camera_id: str
    timestamp: datetime
    
    # Input scores
    sources: List[SourceScore]
    frames_confirmed: int
    movement_px: float
    
    # Decision output
    decision_type: DecisionType
    final_confidence: float
    explanation: str
    
    # Metadata
    processing_time_ms: float
    model_versions: Dict[str, str]
    thresholds_used: Dict[str, float]
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging"""
        return {
            "track_id": self.track_id,
            "person_id": self.person_id,
            "camera_id": self.camera_id,
            "timestamp": self.timestamp.isoformat(),
            "sources": [asdict(s) for s in self.sources],
            "frames_confirmed": self.frames_confirmed,
            "movement_px": self.movement_px,
            "decision_type": self.decision_type.value,
            "final_confidence": self.final_confidence,
            "explanation": self.explanation,
            "processing_time_ms": self.processing_time_ms,
            "model_versions": self.model_versions,
            "thresholds_used": self.thresholds_used
        }
    
    def get_hash(self) -> str:
        """Generate hash for deduplication based on track_id + timestamp"""
        key = f"{self.track_id}:{self.timestamp.isoformat()}"
        return hashlib.md5(key.encode()).hexdigest()

class DecisionEngine:
    """Enhanced decision engine with weighted scoring and explainability"""
    
    def __init__(self, 
                 face_threshold: float = 0.60,
                 reid_threshold: float = 0.82,
                 movement_threshold: float = 3.0,
                 frames_threshold: int = 15,
                 face_weight: float = 0.5,
                 reid_weight: float = 0.3,
                 motion_weight: float = 0.2):
        
        self.thresholds = {
            "face": face_threshold,
            "reid": reid_threshold,
            "movement": movement_threshold,
            "frames": frames_threshold
        }
        
        self.weights = {
            "face": face_weight,
            "reid": reid_weight,
            "motion": motion_weight
        }
        
        # Normalize weights
        total_weight = sum(self.weights.values())
        self.weights = {k: v/total_weight for k, v in self.weights.items()}
        
        self.model_versions = {
            "decision_engine": "v2.0",
            "face_model": "unknown",
            "reid_model": "unknown"
        }
        
        # Decision history for sampling
        self.decision_history: List[DecisionRecord] = []
        self.sampling_rate = 0.1  # Log 10% of decisions for analysis
    
    def update_model_versions(self, versions: Dict[str, str]):
        """Update model version tracking"""
        self.model_versions.update(versions)
    
    def make_decision(self,
                     track_id: str,
                     camera_id: str,
                     face_similarity: Optional[float] = None,
                     reid_similarity: Optional[float] = None,
                     movement_px: float = 0.0,
                     frames_confirmed: int = 0,
                     person_id: Optional[str] = None,
                     face_metadata: Optional[Dict] = None,
                     reid_metadata: Optional[Dict] = None) -> DecisionRecord:
        """
        Make comprehensive decision with explainability
        """
        start_time = time.time()
        timestamp = datetime.now(timezone.utc)
        
        # Collect source scores
        sources = []
        
        # Face scoring
        if face_similarity is not None:
            face_confidence = self._calculate_face_confidence(face_similarity)
            sources.append(SourceScore(
                source=DecisionSource.FACE,
                similarity=face_similarity,
                confidence=face_confidence,
                weight=self.weights["face"],
                metadata=face_metadata or {}
            ))
        
        # ReID scoring  
        if reid_similarity is not None:
            reid_confidence = self._calculate_reid_confidence(reid_similarity, movement_px, frames_confirmed)
            sources.append(SourceScore(
                source=DecisionSource.REID,
                similarity=reid_similarity,
                confidence=reid_confidence,
                weight=self.weights["reid"],
                metadata=reid_metadata or {}
            ))
        
        # Motion scoring
        motion_confidence = self._calculate_motion_confidence(movement_px, frames_confirmed)
        sources.append(SourceScore(
            source=DecisionSource.MOTION,
            similarity=movement_px / 100.0,  # Normalize to 0-1
            confidence=motion_confidence,
            weight=self.weights["motion"],
            metadata={"movement_px": movement_px, "frames": frames_confirmed}
        ))
        
        # Calculate final decision
        decision_type, final_confidence, explanation = self._fuse_scores(sources, frames_confirmed)
        
        # Create decision record
        processing_time = (time.time() - start_time) * 1000
        
        decision = DecisionRecord(
            track_id=track_id,
            person_id=person_id,
            camera_id=camera_id,
            timestamp=timestamp,
            sources=sources,
            frames_confirmed=frames_confirmed,
            movement_px=movement_px,
            decision_type=decision_type,
            final_confidence=final_confidence,
            explanation=explanation,
            processing_time_ms=processing_time,
            model_versions=self.model_versions.copy(),
            thresholds_used=self.thresholds.copy()
        )
        
        # Update metrics
        decision_confidence_bucketed.labels(decision_type=decision_type.value).observe(final_confidence)
        decision_explanations_total.labels(explanation=explanation).inc()
        
        # Sample logging
        if np.random.random() < self.sampling_rate:
            self._log_decision(decision)
        
        return decision
    
    def _calculate_face_confidence(self, similarity: float) -> float:
        """Calculate face confidence based on similarity and quality factors"""
        if similarity >= self.thresholds["face"]:
            # High confidence for strong matches
            return min(0.9, 0.5 + (similarity - self.thresholds["face"]) * 2)
        else:
            # Lower confidence for weak matches
            return similarity * 0.7
    
    def _calculate_reid_confidence(self, similarity: float, movement: float, frames: int) -> float:
        """Calculate ReID confidence considering movement and temporal consistency"""
        base_conf = similarity if similarity >= self.thresholds["reid"] else similarity * 0.6
        
        # Boost confidence with good movement
        if movement >= self.thresholds["movement"]:
            base_conf = min(0.95, base_conf * 1.2)
        
        # Boost confidence with temporal consistency
        if frames >= self.thresholds["frames"]:
            base_conf = min(0.95, base_conf * 1.1)
        
        return base_conf
    
    def _calculate_motion_confidence(self, movement: float, frames: int) -> float:
        """Calculate motion confidence based on movement and temporal factors"""
        if frames < 5:
            return 0.1  # Very low confidence for short tracks
        
        if movement >= self.thresholds["movement"]:
            return min(0.8, 0.3 + (movement / 20.0))  # Cap at 0.8
        else:
            return 0.2  # Low confidence for static objects
    
    def _fuse_scores(self, sources: List[SourceScore], frames: int) -> Tuple[DecisionType, float, str]:
        """
        Fuse multiple source scores into final decision
        """
        if not sources:
            return DecisionType.REJECTED, 0.0, "no_sources"
        
        # Weighted average of confidences
        weighted_sum = sum(s.confidence * s.weight for s in sources)
        
        # Explanations for different decision paths
        if any(s.source == DecisionSource.FACE and s.similarity >= self.thresholds["face"] for s in sources):
            if weighted_sum >= 0.7:
                return DecisionType.CONFIRMED, weighted_sum, "face_high_confidence"
            else:
                return DecisionType.CONFIRMED, weighted_sum, "face_confirmed"
        
        reid_sources = [s for s in sources if s.source == DecisionSource.REID]
        if reid_sources and frames >= self.thresholds["frames"]:
            reid_score = reid_sources[0]
            if reid_score.similarity >= self.thresholds["reid"] and weighted_sum >= 0.6:
                return DecisionType.CONFIRMED, weighted_sum, "reid_temporal_confirmed"
        
        if weighted_sum >= 0.5:
            return DecisionType.PENDING, weighted_sum, "fusion_pending"
        else:
            return DecisionType.REJECTED, weighted_sum, "low_confidence"
    
    def _log_decision(self, decision: DecisionRecord):
        """Sample logging of decisions for analysis"""
        import logging
        logger = logging.getLogger(__name__)
        
        log_data = {
            "event": "decision_sample",
            **decision.to_dict()
        }
        
        logger.info(json.dumps(log_data, separators=(',', ':')))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get decision engine statistics"""
        return {
            "thresholds": self.thresholds,
            "weights": self.weights,
            "model_versions": self.model_versions,
            "sampling_rate": self.sampling_rate,
            "decisions_sampled": len(self.decision_history)
        }