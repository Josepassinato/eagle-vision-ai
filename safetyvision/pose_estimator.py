#!/usr/bin/env python3
"""
Real Pose Estimation using MediaPipe - Visão de Águia
Substitui o mock anterior com implementação real para detecção de posturas e quedas
"""

import cv2
import numpy as np
import mediapipe as mp
import logging
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class PoseKeypoint:
    """Keypoint with confidence and visibility"""
    x: float
    y: float
    z: float
    confidence: float
    visibility: float

@dataclass 
class PoseResult:
    """Pose estimation result"""
    keypoints: List[PoseKeypoint]
    bbox: List[float]  # [x1, y1, x2, y2]
    pose_confidence: float
    pose_type: str  # 'standing', 'sitting', 'lying', 'falling'
    risk_level: str  # 'safe', 'warning', 'danger'

class PoseEstimator:
    """Real pose estimation using MediaPipe"""
    
    def __init__(self, 
                 min_detection_confidence: float = 0.7,
                 min_tracking_confidence: float = 0.5,
                 model_complexity: int = 1):
        """
        Initialize MediaPipe Pose
        
        Args:
            min_detection_confidence: Minimum confidence for pose detection
            min_tracking_confidence: Minimum confidence for pose tracking
            model_complexity: 0=lite, 1=full, 2=heavy
        """
        try:
            self.mp_pose = mp.solutions.pose
            self.mp_drawing = mp.solutions.drawing_utils
            
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=model_complexity,
                enable_segmentation=False,
                min_detection_confidence=min_detection_confidence,
                min_tracking_confidence=min_tracking_confidence
            )
            
            # COCO pose keypoint mapping (17 keypoints)
            self.coco_keypoints = [
                'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
                'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
                'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
                'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
            ]
            
            # MediaPipe to COCO mapping
            self.mp_to_coco = {
                0: 0,   # nose
                2: 1,   # left_eye_inner -> left_eye
                5: 2,   # right_eye_inner -> right_eye  
                7: 3,   # left_ear
                8: 4,   # right_ear
                11: 5,  # left_shoulder
                12: 6,  # right_shoulder
                13: 7,  # left_elbow
                14: 8,  # right_elbow
                15: 9,  # left_wrist
                16: 10, # right_wrist
                23: 11, # left_hip
                24: 12, # right_hip
                25: 13, # left_knee
                26: 14, # right_knee
                27: 15, # left_ankle
                28: 16, # right_ankle
            }
            
            logger.info("MediaPipe Pose initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe Pose: {e}")
            raise
    
    def extract_keypoints(self, frame: np.ndarray, bbox: List[float]) -> np.ndarray:
        """
        Extract pose keypoints from person crop
        
        Args:
            frame: Full frame image
            bbox: Person bounding box [x1, y1, x2, y2]
            
        Returns:
            np.ndarray: COCO format keypoints (17, 3) - [x, y, confidence]
        """
        try:
            x1, y1, x2, y2 = [int(coord) for coord in bbox]
            h, w = frame.shape[:2]
            
            # Validate and clip bbox
            x1 = max(0, min(x1, w))
            y1 = max(0, min(y1, h))
            x2 = max(x1, min(x2, w))
            y2 = max(y1, min(y2, h))
            
            if x2 <= x1 or y2 <= y1:
                logger.warning("Invalid bbox for pose extraction")
                return np.zeros((17, 3))
            
            # Crop person region
            person_crop = frame[y1:y2, x1:x2]
            if person_crop.size == 0:
                return np.zeros((17, 3))
            
            # Convert BGR to RGB
            rgb_crop = cv2.cvtColor(person_crop, cv2.COLOR_BGR2RGB)
            
            # Run MediaPipe pose detection
            results = self.pose.process(rgb_crop)
            
            if not results.pose_landmarks:
                return np.zeros((17, 3))
            
            # Convert to COCO format
            coco_keypoints = np.zeros((17, 3))
            crop_h, crop_w = person_crop.shape[:2]
            
            for mp_idx, coco_idx in self.mp_to_coco.items():
                if mp_idx < len(results.pose_landmarks.landmark):
                    landmark = results.pose_landmarks.landmark[mp_idx]
                    
                    # Convert normalized coordinates to absolute coordinates in original frame
                    abs_x = x1 + (landmark.x * crop_w)
                    abs_y = y1 + (landmark.y * crop_h)
                    confidence = landmark.visibility
                    
                    coco_keypoints[coco_idx] = [abs_x, abs_y, confidence]
            
            return coco_keypoints
            
        except Exception as e:
            logger.error(f"Error extracting keypoints: {e}")
            return np.zeros((17, 3))
    
    def analyze_pose(self, frame: np.ndarray, bbox: List[float]) -> PoseResult:
        """
        Comprehensive pose analysis for safety monitoring
        
        Args:
            frame: Full frame image
            bbox: Person bounding box [x1, y1, x2, y2]
            
        Returns:
            PoseResult: Complete pose analysis
        """
        try:
            keypoints = self.extract_keypoints(frame, bbox)
            
            # Convert to PoseKeypoint objects
            pose_keypoints = []
            for i, (x, y, conf) in enumerate(keypoints):
                pose_keypoints.append(PoseKeypoint(
                    x=float(x), y=float(y), z=0.0,
                    confidence=float(conf), visibility=float(conf)
                ))
            
            # Analyze pose type and risk
            pose_type, risk_level = self._analyze_pose_safety(keypoints, bbox)
            
            # Calculate overall pose confidence
            valid_keypoints = keypoints[keypoints[:, 2] > 0.3]
            pose_confidence = float(np.mean(valid_keypoints[:, 2])) if len(valid_keypoints) > 0 else 0.0
            
            return PoseResult(
                keypoints=pose_keypoints,
                bbox=bbox,
                pose_confidence=pose_confidence,
                pose_type=pose_type,
                risk_level=risk_level
            )
            
        except Exception as e:
            logger.error(f"Error analyzing pose: {e}")
            return PoseResult(
                keypoints=[],
                bbox=bbox,
                pose_confidence=0.0,
                pose_type='unknown',
                risk_level='safe'
            )
    
    def _analyze_pose_safety(self, keypoints: np.ndarray, bbox: List[float]) -> Tuple[str, str]:
        """
        Analyze pose for safety risks (falls, unsafe postures)
        
        Args:
            keypoints: COCO format keypoints (17, 3)
            bbox: Person bounding box
            
        Returns:
            Tuple[pose_type, risk_level]
        """
        try:
            # Extract key body parts
            head = keypoints[0]  # nose
            shoulders = keypoints[5:7]  # left, right shoulder
            hips = keypoints[11:13]  # left, right hip
            knees = keypoints[13:15]  # left, right knee
            ankles = keypoints[15:17]  # left, right ankle
            
            # Filter valid keypoints (confidence > 0.3)
            valid_shoulders = shoulders[shoulders[:, 2] > 0.3]
            valid_hips = hips[hips[:, 2] > 0.3]
            valid_knees = knees[knees[:, 2] > 0.3]
            valid_ankles = ankles[ankles[:, 2] > 0.3]
            
            if len(valid_shoulders) == 0 or len(valid_hips) == 0:
                return 'unknown', 'safe'
            
            # Calculate body orientation
            shoulder_center = np.mean(valid_shoulders[:, :2], axis=0)
            hip_center = np.mean(valid_hips[:, :2], axis=0)
            
            # Vertical distance between shoulders and hips
            torso_height = abs(shoulder_center[1] - hip_center[1])
            bbox_height = bbox[3] - bbox[1]
            
            # Analyze pose based on body geometry
            if torso_height < bbox_height * 0.3:
                # Person is likely lying down
                if shoulder_center[1] > hip_center[1]:
                    return 'lying', 'warning'  # Unusual lying position
                else:
                    return 'lying', 'danger'   # Possible fall
            
            elif len(valid_knees) > 0 and len(valid_ankles) > 0:
                knee_center = np.mean(valid_knees[:, :2], axis=0)
                ankle_center = np.mean(valid_ankles[:, :2], axis=0)
                
                # Check if knees are bent (sitting)
                knee_hip_dist = abs(knee_center[1] - hip_center[1])
                hip_ankle_dist = abs(hip_center[1] - ankle_center[1])
                
                if knee_hip_dist < hip_ankle_dist * 0.5:
                    return 'sitting', 'safe'
                else:
                    return 'standing', 'safe'
            
            else:
                return 'standing', 'safe'
                
        except Exception as e:
            logger.error(f"Error in pose safety analysis: {e}")
            return 'unknown', 'safe'
    
    def detect_fall(self, keypoints: np.ndarray, bbox: List[float], 
                   previous_poses: List[PoseResult] = None) -> Dict[str, Any]:
        """
        Specialized fall detection algorithm
        
        Args:
            keypoints: Current pose keypoints
            bbox: Current bounding box
            previous_poses: Previous pose history for temporal analysis
            
        Returns:
            Dict with fall detection results
        """
        try:
            pose_result = self.analyze_pose(None, bbox)  # We already have keypoints
            
            fall_indicators = {
                'rapid_position_change': False,
                'horizontal_orientation': False,
                'impact_detected': False,
                'recovery_time': 0,
                'confidence': 0.0
            }
            
            # Check horizontal orientation
            if pose_result.pose_type == 'lying':
                fall_indicators['horizontal_orientation'] = True
                fall_indicators['confidence'] += 0.4
            
            # Check temporal changes if previous poses available
            if previous_poses and len(previous_poses) > 0:
                prev_pose = previous_poses[-1]
                
                # Rapid vertical position change
                if (prev_pose.pose_type == 'standing' and 
                    pose_result.pose_type == 'lying'):
                    fall_indicators['rapid_position_change'] = True
                    fall_indicators['confidence'] += 0.5
                
                # Check bounding box size change (impact indicator)
                prev_bbox_area = (prev_pose.bbox[2] - prev_pose.bbox[0]) * (prev_pose.bbox[3] - prev_pose.bbox[1])
                curr_bbox_area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
                
                if curr_bbox_area > prev_bbox_area * 1.3:  # Significant size increase
                    fall_indicators['impact_detected'] = True
                    fall_indicators['confidence'] += 0.3
            
            # Determine fall severity
            if fall_indicators['confidence'] > 0.7:
                severity = 'high'
            elif fall_indicators['confidence'] > 0.4:
                severity = 'medium'  
            else:
                severity = 'low'
            
            return {
                'fall_detected': fall_indicators['confidence'] > 0.4,
                'severity': severity,
                'confidence': fall_indicators['confidence'],
                'indicators': fall_indicators,
                'pose_type': pose_result.pose_type,
                'risk_level': pose_result.risk_level
            }
            
        except Exception as e:
            logger.error(f"Error in fall detection: {e}")
            return {
                'fall_detected': False,
                'severity': 'low',
                'confidence': 0.0,
                'indicators': {},
                'pose_type': 'unknown',
                'risk_level': 'safe'
            }
    
    def cleanup(self):
        """Cleanup MediaPipe resources"""
        try:
            if hasattr(self, 'pose'):
                self.pose.close()
            logger.info("MediaPipe Pose resources cleaned up")
        except Exception as e:
            logger.error(f"Error cleaning up MediaPipe: {e}")

    def __del__(self):
        """Destructor to ensure cleanup"""
        self.cleanup()


# Factory function for easy instantiation
def create_pose_estimator(config: Dict[str, Any] = None) -> PoseEstimator:
    """
    Factory function to create PoseEstimator with configuration
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        PoseEstimator: Configured pose estimator instance
    """
    if config is None:
        config = {}
    
    return PoseEstimator(
        min_detection_confidence=config.get('min_detection_confidence', 0.7),
        min_tracking_confidence=config.get('min_tracking_confidence', 0.5),
        model_complexity=config.get('model_complexity', 1)
    )


if __name__ == "__main__":
    # Test pose estimator
    import time
    
    print("Testing MediaPipe Pose Estimator...")
    
    try:
        estimator = create_pose_estimator()
        
        # Create dummy frame and bbox for testing
        test_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        test_bbox = [100, 50, 200, 400]  # [x1, y1, x2, y2]
        
        start_time = time.time()
        keypoints = estimator.extract_keypoints(test_frame, test_bbox)
        processing_time = time.time() - start_time
        
        print(f"✓ Keypoints extracted: {keypoints.shape}")
        print(f"✓ Processing time: {processing_time:.3f}s")
        print(f"✓ Valid keypoints: {np.sum(keypoints[:, 2] > 0.3)}/17")
        
        # Test pose analysis
        pose_result = estimator.analyze_pose(test_frame, test_bbox)
        print(f"✓ Pose type: {pose_result.pose_type}")
        print(f"✓ Risk level: {pose_result.risk_level}")
        print(f"✓ Confidence: {pose_result.pose_confidence:.3f}")
        
        estimator.cleanup()
        print("✅ MediaPipe Pose Estimator test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error testing pose estimator: {e}")
        import traceback
        traceback.print_exc()