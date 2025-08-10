#!/usr/bin/env python3
"""
Real Educational Behavior Inference Pipeline
Face ROI → Quality Assessment → ONNX Inference → EMA/Hysteresis → Events
"""

import os
import cv2
import numpy as np
import onnxruntime as ort
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
from collections import deque, defaultdict
import base64

logger = logging.getLogger(__name__)

@dataclass
class FaceROI:
    """Face region of interest with quality metrics"""
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    landmarks: Optional[np.ndarray] = None
    quality_score: float = 0.0
    pose_angles: Optional[Tuple[float, float, float]] = None  # yaw, pitch, roll

@dataclass
class AffectPrediction:
    """Affect/emotion prediction with confidence"""
    emotion: str
    confidence: float
    valence: float  # -1 to 1 (negative to positive)
    arousal: float  # 0 to 1 (calm to excited)
    engagement: float  # 0 to 1 (disengaged to engaged)
    
@dataclass
class StudentState:
    """Temporal student state with EMA smoothing"""
    student_id: str
    track_id: str
    last_updated: datetime
    
    # Smoothed states (EMA)
    emotion_history: deque
    engagement_ema: float = 0.5
    valence_ema: float = 0.0
    arousal_ema: float = 0.5
    
    # Hysteresis tracking
    distress_frames: int = 0
    disengagement_frames: int = 0
    attention_frames: int = 0
    
    # Quality tracking
    quality_history: deque = None
    
    def __post_init__(self):
        if self.emotion_history is None:
            self.emotion_history = deque(maxlen=30)  # 30 frame history
        if self.quality_history is None:
            self.quality_history = deque(maxlen=10)

class FaceQualityAssessment:
    """Assess face quality for reliable emotion recognition"""
    
    def __init__(self):
        self.min_face_size = 64
        self.max_pose_angle = 45  # degrees
        self.min_confidence = 0.7
    
    def assess_quality(self, face_roi: FaceROI, frame_shape: Tuple[int, int]) -> float:
        """
        Assess face quality on scale 0-1
        Factors: size, pose, confidence, resolution
        """
        scores = []
        
        # Size score
        x1, y1, x2, y2 = face_roi.bbox
        face_width = x2 - x1
        face_height = y2 - y1
        face_area = face_width * face_height
        
        if face_width >= self.min_face_size and face_height >= self.min_face_size:
            size_score = min(1.0, (face_width * face_height) / (128 * 128))
        else:
            size_score = 0.2
        scores.append(size_score)
        
        # Confidence score
        conf_score = min(1.0, face_roi.confidence / self.min_confidence)
        scores.append(conf_score)
        
        # Pose score (if available)
        if face_roi.pose_angles:
            yaw, pitch, roll = face_roi.pose_angles
            max_angle = max(abs(yaw), abs(pitch), abs(roll))
            pose_score = max(0.1, 1.0 - (max_angle / self.max_pose_angle))
        else:
            pose_score = 0.8  # Assume reasonable pose if not available
        scores.append(pose_score)
        
        # Resolution score (relative to frame)
        frame_h, frame_w = frame_shape[:2]
        relative_size = face_area / (frame_w * frame_h)
        resolution_score = min(1.0, relative_size * 100)  # Boost small faces
        scores.append(resolution_score)
        
        # Combined quality score
        quality = np.mean(scores)
        face_roi.quality_score = quality
        
        return quality

class ONNXEmotionModel:
    """ONNX-based emotion recognition model"""
    
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.session = None
        self.input_name = None
        self.output_names = None
        self.input_shape = (224, 224)  # Standard input size
        
        # Emotion mapping (adjust based on your model)
        self.emotion_labels = [
            'neutral', 'happiness', 'sadness', 'anger', 
            'fear', 'disgust', 'surprise', 'contempt'
        ]
        
        self._load_model()
    
    def _load_model(self):
        """Load ONNX model"""
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"ONNX model not found: {self.model_path}")
                return
            
            # Configure ONNX runtime
            providers = ['CPUExecutionProvider']
            if ort.get_device() == 'GPU':
                providers.insert(0, 'CUDAExecutionProvider')
            
            self.session = ort.InferenceSession(self.model_path, providers=providers)
            
            # Get input/output info
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            
            # Get input shape
            input_shape = self.session.get_inputs()[0].shape
            if len(input_shape) >= 2:
                self.input_shape = (input_shape[-2], input_shape[-1])
            
            logger.info(f"Loaded ONNX emotion model: {self.model_path}")
            logger.info(f"Input shape: {self.input_shape}, Outputs: {self.output_names}")
            
        except Exception as e:
            logger.error(f"Failed to load ONNX model: {e}")
            self.session = None
    
    def predict(self, face_crop: np.ndarray) -> Optional[AffectPrediction]:
        """Predict emotion from face crop"""
        if self.session is None:
            return None
        
        try:
            # Preprocess face crop
            preprocessed = self._preprocess_face(face_crop)
            if preprocessed is None:
                return None
            
            # Run inference
            outputs = self.session.run(self.output_names, {self.input_name: preprocessed})
            
            # Parse outputs (adjust based on your model)
            return self._parse_outputs(outputs)
            
        except Exception as e:
            logger.error(f"ONNX inference failed: {e}")
            return None
    
    def _preprocess_face(self, face_crop: np.ndarray) -> Optional[np.ndarray]:
        """Preprocess face crop for model input"""
        try:
            # Resize to model input size
            resized = cv2.resize(face_crop, self.input_shape)
            
            # Convert to RGB if needed
            if len(resized.shape) == 3 and resized.shape[2] == 3:
                resized = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            
            # Normalize to [0, 1]
            normalized = resized.astype(np.float32) / 255.0
            
            # Add batch dimension: (1, H, W, C) or (1, C, H, W)
            if len(normalized.shape) == 3:
                # Assume (H, W, C) -> (1, C, H, W) for most models
                normalized = np.transpose(normalized, (2, 0, 1))
                normalized = np.expand_dims(normalized, axis=0)
            
            return normalized
            
        except Exception as e:
            logger.error(f"Face preprocessing failed: {e}")
            return None
    
    def _parse_outputs(self, outputs: List[np.ndarray]) -> AffectPrediction:
        """Parse model outputs into affect prediction"""
        # This is model-specific - adjust based on your model's outputs
        
        # Assume first output is emotion probabilities
        emotion_probs = outputs[0][0]  # Remove batch dimension
        
        # Get dominant emotion
        emotion_idx = np.argmax(emotion_probs)
        emotion = self.emotion_labels[emotion_idx] if emotion_idx < len(self.emotion_labels) else 'unknown'
        confidence = float(emotion_probs[emotion_idx])
        
        # Map emotion to valence/arousal (Russell's circumplex model)
        valence, arousal = self._emotion_to_valence_arousal(emotion, emotion_probs)
        
        # Calculate engagement (inverse of negative emotions + attention indicators)
        negative_emotions = ['sadness', 'anger', 'fear', 'disgust', 'contempt']
        negative_score = sum(emotion_probs[i] for i, label in enumerate(self.emotion_labels) 
                           if i < len(emotion_probs) and label in negative_emotions)
        engagement = max(0.1, 1.0 - negative_score)
        
        return AffectPrediction(
            emotion=emotion,
            confidence=confidence,
            valence=valence,
            arousal=arousal,
            engagement=engagement
        )
    
    def _emotion_to_valence_arousal(self, emotion: str, probs: np.ndarray) -> Tuple[float, float]:
        """Map emotion to valence/arousal coordinates"""
        # Russell's circumplex model mapping
        emotion_mapping = {
            'happiness': (0.8, 0.7),
            'surprise': (0.4, 0.8),
            'anger': (-0.7, 0.8),
            'fear': (-0.6, 0.7),
            'sadness': (-0.7, 0.3),
            'disgust': (-0.8, 0.4),
            'contempt': (-0.5, 0.2),
            'neutral': (0.0, 0.4)
        }
        
        # Weighted average based on probabilities
        valence = 0.0
        arousal = 0.4  # Default arousal
        
        for i, label in enumerate(self.emotion_labels):
            if i < len(probs) and label in emotion_mapping:
                weight = probs[i]
                v, a = emotion_mapping[label]
                valence += weight * v
                arousal += weight * a
        
        return np.clip(valence, -1.0, 1.0), np.clip(arousal, 0.0, 1.0)

class EmotionPipeline:
    """Complete emotion analysis pipeline with temporal modeling"""
    
    def __init__(self, 
                 model_path: str = "/models/emotion_model.onnx",
                 ema_alpha: float = 0.3,
                 hysteresis_threshold: int = 5):
        
        self.quality_assessor = FaceQualityAssessment()
        self.emotion_model = ONNXEmotionModel(model_path)
        self.ema_alpha = ema_alpha  # EMA smoothing factor
        self.hysteresis_threshold = hysteresis_threshold  # Frames needed to trigger
        
        # Student state tracking
        self.student_states: Dict[str, StudentState] = {}
        self.cleanup_timeout = timedelta(minutes=10)
    
    def process_frame(self, 
                     frame: np.ndarray,
                     faces: List[Dict],
                     class_id: str,
                     timestamp: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Process frame with detected faces
        Returns list of signals/events
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        signals = []
        
        for face_data in faces:
            try:
                # Extract face ROI
                face_roi = self._extract_face_roi(face_data)
                if not face_roi:
                    continue
                
                # Assess quality
                quality = self.quality_assessor.assess_quality(face_roi, frame.shape)
                if quality < 0.5:  # Skip low quality faces
                    continue
                
                # Extract face crop
                face_crop = self._crop_face(frame, face_roi)
                if face_crop is None:
                    continue
                
                # Run emotion inference
                prediction = self.emotion_model.predict(face_crop)
                if not prediction:
                    continue
                
                # Update student state
                student_id = face_data.get('student_id') or face_data.get('track_id', 'unknown')
                track_id = face_data.get('track_id', student_id)
                
                student_signals = self._update_student_state(
                    student_id, track_id, prediction, quality, timestamp, class_id
                )
                
                signals.extend(student_signals)
                
            except Exception as e:
                logger.error(f"Error processing face: {e}")
                continue
        
        # Cleanup old states
        self._cleanup_old_states(timestamp)
        
        return signals
    
    def _extract_face_roi(self, face_data: Dict) -> Optional[FaceROI]:
        """Extract face ROI from detection data"""
        bbox = face_data.get('bbox')
        if not bbox or len(bbox) != 4:
            return None
        
        confidence = face_data.get('confidence', 0.8)
        landmarks = face_data.get('landmarks')
        
        return FaceROI(
            bbox=tuple(map(int, bbox)),
            confidence=confidence,
            landmarks=landmarks
        )
    
    def _crop_face(self, frame: np.ndarray, face_roi: FaceROI) -> Optional[np.ndarray]:
        """Crop face from frame"""
        try:
            x1, y1, x2, y2 = face_roi.bbox
            
            # Add padding
            padding = 0.2
            width = x2 - x1
            height = y2 - y1
            pad_x = int(width * padding)
            pad_y = int(height * padding)
            
            x1 = max(0, x1 - pad_x)
            y1 = max(0, y1 - pad_y)
            x2 = min(frame.shape[1], x2 + pad_x)
            y2 = min(frame.shape[0], y2 + pad_y)
            
            face_crop = frame[y1:y2, x1:x2]
            
            if face_crop.size == 0:
                return None
            
            return face_crop
            
        except Exception as e:
            logger.error(f"Face cropping failed: {e}")
            return None
    
    def _update_student_state(self, 
                             student_id: str,
                             track_id: str,
                             prediction: AffectPrediction,
                             quality: float,
                             timestamp: datetime,
                             class_id: str) -> List[Dict[str, Any]]:
        """Update student state and return any triggered signals"""
        
        # Get or create student state
        if student_id not in self.student_states:
            self.student_states[student_id] = StudentState(
                student_id=student_id,
                track_id=track_id,
                last_updated=timestamp,
                emotion_history=deque(maxlen=30),
                quality_history=deque(maxlen=10)
            )
        
        state = self.student_states[student_id]
        state.last_updated = timestamp
        state.track_id = track_id
        
        # Update EMA values
        alpha = self.ema_alpha
        state.engagement_ema = alpha * prediction.engagement + (1 - alpha) * state.engagement_ema
        state.valence_ema = alpha * prediction.valence + (1 - alpha) * state.valence_ema
        state.arousal_ema = alpha * prediction.arousal + (1 - alpha) * state.arousal_ema
        
        # Update histories
        state.emotion_history.append({
            'emotion': prediction.emotion,
            'confidence': prediction.confidence,
            'timestamp': timestamp,
            'valence': prediction.valence,
            'arousal': prediction.arousal,
            'engagement': prediction.engagement
        })
        
        state.quality_history.append(quality)
        
        # Check for signals with hysteresis
        signals = []
        
        # Distress detection
        if prediction.valence < -0.5 and prediction.arousal > 0.6:
            state.distress_frames += 1
            if state.distress_frames >= self.hysteresis_threshold:
                signals.append(self._create_signal(
                    student_id, class_id, 'distress', 'MEDIUM',
                    prediction, state, timestamp
                ))
                state.distress_frames = 0  # Reset after triggering
        else:
            state.distress_frames = max(0, state.distress_frames - 1)
        
        # Disengagement detection
        if state.engagement_ema < 0.3:
            state.disengagement_frames += 1
            if state.disengagement_frames >= self.hysteresis_threshold:
                signals.append(self._create_signal(
                    student_id, class_id, 'disengagement', 'HIGH',
                    prediction, state, timestamp
                ))
                state.disengagement_frames = 0
        else:
            state.disengagement_frames = max(0, state.disengagement_frames - 1)
        
        # Attention detection (positive signal)
        if state.engagement_ema > 0.7 and abs(state.valence_ema) < 0.3:
            state.attention_frames += 1
            if state.attention_frames >= self.hysteresis_threshold:
                signals.append(self._create_signal(
                    student_id, class_id, 'high_attention', 'LOW',
                    prediction, state, timestamp
                ))
                state.attention_frames = 0
        else:
            state.attention_frames = max(0, state.attention_frames - 1)
        
        return signals
    
    def _create_signal(self, 
                      student_id: str,
                      class_id: str,
                      signal_type: str,
                      severity: str,
                      prediction: AffectPrediction,
                      state: StudentState,
                      timestamp: datetime) -> Dict[str, Any]:
        """Create signal dictionary"""
        
        return {
            'type': signal_type,
            'severity': severity,
            'student_id': student_id,
            'class_id': class_id,
            'timestamp': timestamp.isoformat(),
            'affect_state': prediction.emotion,
            'affect_probs': {
                'engagement': prediction.engagement,
                'valence': prediction.valence,
                'arousal': prediction.arousal,
                'confidence': prediction.confidence
            },
            'details': {
                'emotion': prediction.emotion,
                'engagement_ema': state.engagement_ema,
                'valence_ema': state.valence_ema,
                'arousal_ema': state.arousal_ema,
                'quality_avg': np.mean(list(state.quality_history)) if state.quality_history else 0.0,
                'frames_processed': len(state.emotion_history)
            }
        }
    
    def _cleanup_old_states(self, current_time: datetime):
        """Remove old student states"""
        cutoff = current_time - self.cleanup_timeout
        
        to_remove = [
            student_id for student_id, state in self.student_states.items()
            if state.last_updated < cutoff
        ]
        
        for student_id in to_remove:
            del self.student_states[student_id]
            logger.debug(f"Cleaned up state for student {student_id}")
    
    def get_student_summary(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get current state summary for a student"""
        if student_id not in self.student_states:
            return None
        
        state = self.student_states[student_id]
        
        return {
            'student_id': student_id,
            'track_id': state.track_id,
            'last_updated': state.last_updated.isoformat(),
            'engagement_ema': state.engagement_ema,
            'valence_ema': state.valence_ema,
            'arousal_ema': state.arousal_ema,
            'recent_emotions': list(state.emotion_history)[-5:],  # Last 5 emotions
            'quality_avg': np.mean(list(state.quality_history)) if state.quality_history else 0.0,
            'total_frames': len(state.emotion_history)
        }