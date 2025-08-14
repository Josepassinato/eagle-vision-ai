"""
Temporal Signal Fusion System with weighted decision making
"""

import time
import logging
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


@dataclass
class SignalEvent:
    """Individual signal event with timestamp and metadata"""
    timestamp: float
    signal_type: str  # 'face', 'reid', 'detector'
    score: float
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: str = ""
    track_id: Optional[int] = None


@dataclass
class TemporalWindow:
    """Temporal window for collecting signals"""
    window_seconds: float
    max_signals: int = 100
    signals: deque = field(default_factory=deque)
    
    def add_signal(self, signal: SignalEvent):
        """Add signal to window, removing old ones"""
        current_time = time.time()
        
        # Remove expired signals
        while self.signals and (current_time - self.signals[0].timestamp) > self.window_seconds:
            self.signals.popleft()
        
        # Add new signal
        self.signals.append(signal)
        
        # Limit window size
        if len(self.signals) > self.max_signals:
            self.signals.popleft()
    
    def get_recent_signals(self, signal_type: Optional[str] = None) -> List[SignalEvent]:
        """Get recent signals, optionally filtered by type"""
        current_time = time.time()
        
        # Clean expired signals
        while self.signals and (current_time - self.signals[0].timestamp) > self.window_seconds:
            self.signals.popleft()
        
        if signal_type:
            return [s for s in self.signals if s.signal_type == signal_type]
        return list(self.signals)


class TemporalFusionEngine:
    """Engine for temporal signal fusion with weighted decision making"""
    
    def __init__(
        self,
        face_window_seconds: float = 3.0,
        reid_window_seconds: float = 5.0,
        detector_window_seconds: float = 2.0,
        face_weight: float = 0.6,
        reid_weight: float = 0.3,
        detector_weight: float = 0.1
    ):
        # Temporal windows per track
        self.windows: Dict[str, Dict[int, TemporalWindow]] = defaultdict(
            lambda: defaultdict(lambda: TemporalWindow(face_window_seconds))
        )
        
        # Window configurations
        self.window_configs = {
            'face': face_window_seconds,
            'reid': reid_window_seconds,
            'detector': detector_window_seconds
        }
        
        # Signal weights
        self.weights = {
            'face': face_weight,
            'reid': reid_weight,
            'detector': detector_weight
        }
        
        logger.info(f"TemporalFusionEngine initialized with windows: {self.window_configs}, weights: {self.weights}")
    
    def add_signal(
        self,
        camera_id: str,
        track_id: int,
        signal_type: str,
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
        source: str = ""
    ):
        """Add signal to temporal window"""
        signal = SignalEvent(
            timestamp=time.time(),
            signal_type=signal_type,
            score=score,
            metadata=metadata or {},
            source=source,
            track_id=track_id
        )
        
        # Get or create window for this track
        if signal_type not in self.windows[camera_id][track_id]:
            window_seconds = self.window_configs.get(signal_type, 3.0)
            self.windows[camera_id][track_id][signal_type] = TemporalWindow(window_seconds)
        
        window = self.windows[camera_id][track_id][signal_type]
        window.add_signal(signal)
        
        logger.debug(f"Added {signal_type} signal for track {track_id}: score={score:.3f}, source={source}")
    
    def compute_weighted_fusion_score(
        self,
        camera_id: str,
        track_id: int,
        signal_types: List[str] = None
    ) -> Dict[str, Any]:
        """Compute weighted fusion score from temporal windows"""
        if signal_types is None:
            signal_types = ['face', 'reid', 'detector']
        
        start_time = time.time()
        
        fusion_data = {
            'weighted_score': 0.0,
            'total_weight': 0.0,
            'signal_contributions': {},
            'signal_counts': {},
            'best_signals': {},
            'temporal_consistency': 0.0
        }
        
        for signal_type in signal_types:
            if signal_type not in self.windows[camera_id][track_id]:
                continue
                
            window = self.windows[camera_id][track_id][signal_type]
            recent_signals = window.get_recent_signals(signal_type)
            
            if not recent_signals:
                continue
            
            # Get best signal in window
            best_signal = max(recent_signals, key=lambda s: s.score)
            weight = self.weights.get(signal_type, 0.1)
            
            # Temporal consistency: higher if multiple recent signals
            consistency = min(len(recent_signals) / 3.0, 1.0)  # Normalize to [0,1]
            
            # Weighted contribution
            contribution = best_signal.score * weight * (0.7 + 0.3 * consistency)
            
            fusion_data['weighted_score'] += contribution
            fusion_data['total_weight'] += weight
            fusion_data['signal_contributions'][signal_type] = {
                'score': best_signal.score,
                'weight': weight,
                'contribution': contribution,
                'source': best_signal.source,
                'timestamp': best_signal.timestamp,
                'consistency': consistency
            }
            fusion_data['signal_counts'][signal_type] = len(recent_signals)
            fusion_data['best_signals'][signal_type] = {
                'score': best_signal.score,
                'timestamp': best_signal.timestamp,
                'source': best_signal.source
            }
        
        # Normalize weighted score
        if fusion_data['total_weight'] > 0:
            fusion_data['weighted_score'] /= fusion_data['total_weight']
        
        # Overall temporal consistency
        if fusion_data['signal_contributions']:
            fusion_data['temporal_consistency'] = sum(
                contrib['consistency'] for contrib in fusion_data['signal_contributions'].values()
            ) / len(fusion_data['signal_contributions'])
        
        computation_time = (time.time() - start_time) * 1000  # ms
        fusion_data['computation_time_ms'] = computation_time
        
        logger.debug(f"Fusion score computed for track {track_id}: {fusion_data['weighted_score']:.3f} "
                    f"(consistency: {fusion_data['temporal_consistency']:.3f}, time: {computation_time:.1f}ms)")
        
        return fusion_data
    
    def cleanup_old_tracks(self, camera_id: str, active_track_ids: List[int]):
        """Remove temporal windows for inactive tracks"""
        if camera_id not in self.windows:
            return
        
        inactive_tracks = set(self.windows[camera_id].keys()) - set(active_track_ids)
        for track_id in inactive_tracks:
            del self.windows[camera_id][track_id]
            logger.debug(f"Cleaned up temporal windows for inactive track {track_id}")
    
    def get_track_signal_summary(self, camera_id: str, track_id: int) -> Dict[str, Any]:
        """Get summary of all signals for a track"""
        summary = {
            'track_id': track_id,
            'signal_types': {},
            'total_signals': 0,
            'oldest_signal_age': 0.0,
            'newest_signal_age': 0.0
        }
        
        if camera_id not in self.windows or track_id not in self.windows[camera_id]:
            return summary
        
        current_time = time.time()
        all_timestamps = []
        
        for signal_type, window in self.windows[camera_id][track_id].items():
            signals = window.get_recent_signals(signal_type)
            if signals:
                timestamps = [s.timestamp for s in signals]
                all_timestamps.extend(timestamps)
                
                summary['signal_types'][signal_type] = {
                    'count': len(signals),
                    'latest_score': max(signals, key=lambda s: s.timestamp).score,
                    'best_score': max(signals, key=lambda s: s.score).score,
                    'avg_score': sum(s.score for s in signals) / len(signals)
                }
        
        if all_timestamps:
            summary['total_signals'] = len(all_timestamps)
            summary['oldest_signal_age'] = current_time - min(all_timestamps)
            summary['newest_signal_age'] = current_time - max(all_timestamps)
        
        return summary


# Global temporal fusion engine
_fusion_engine = None

def get_fusion_engine() -> TemporalFusionEngine:
    """Get global temporal fusion engine instance"""
    global _fusion_engine
    if _fusion_engine is None:
        _fusion_engine = TemporalFusionEngine()
    return _fusion_engine