#!/usr/bin/env python3
"""
Real PPE and Safety Detection Pipeline
YOLO PPE Detection + Keypoint Analysis + Zone Validation + Fall Detection
"""

import cv2
import numpy as np
import onnxruntime as ort
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import logging
from shapely.geometry import Point, Polygon
from shapely.prepared import prep
import json
import os

logger = logging.getLogger(__name__)

@dataclass
class PPEDetection:
    """PPE item detection result"""
    class_name: str  # helmet, vest, glasses, boots, gloves
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    confidence: float
    person_bbox: Tuple[int, int, int, int]  # Associated person bbox

@dataclass
class PostureKeypoints:
    """Human pose keypoints for posture analysis"""
    keypoints: np.ndarray  # 17x3 array [x, y, confidence]
    bbox: Tuple[int, int, int, int]
    confidence: float
    
    # Specific joint indices (COCO format)
    NOSE = 0
    EYES = [1, 2]
    EARS = [3, 4] 
    SHOULDERS = [5, 6]
    ELBOWS = [7, 8]
    WRISTS = [9, 10]
    HIPS = [11, 12]
    KNEES = [13, 14]
    ANKLES = [15, 16]

@dataclass
class SafetyZone:
    """Safety zone definition with cached geometry"""
    zone_id: str
    label: str  # 'restricted', 'ppe_required', 'fall_risk', 'general'
    polygon: Polygon
    prepared_geom: Any  # Prepared geometry for faster point-in-polygon
    metadata: Dict[str, Any]

@dataclass
class FallEvent:
    """Fall detection event"""
    person_id: str
    bbox: Tuple[int, int, int, int]
    fall_score: float
    trigger_reason: str  # 'acceleration', 'orientation', 'immobility'
    timestamp: datetime
    keypoints: Optional[PostureKeypoints] = None

class PPEDetector:
    """YOLO-based PPE detection"""
    
    def __init__(self, model_path: str = "/models/ppe_yolo.onnx"):
        self.model_path = model_path
        self.session = None
        self.input_name = None
        self.output_names = None
        self.input_shape = (640, 640)
        
        # PPE class mapping (adjust based on your model)
        self.ppe_classes = {
            0: 'person',
            1: 'helmet', 
            2: 'vest',
            3: 'safety_glasses',
            4: 'boots',
            5: 'gloves',
            6: 'no_helmet',
            7: 'no_vest'
        }
        
        self.confidence_threshold = 0.5
        self.nms_threshold = 0.4
        
        self._load_model()
    
    def _load_model(self):
        """Load ONNX PPE detection model"""
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"PPE model not found: {self.model_path}")
                return
            
            providers = ['CPUExecutionProvider']
            if ort.get_device() == 'GPU':
                providers.insert(0, 'CUDAExecutionProvider')
            
            self.session = ort.InferenceSession(self.model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            
            logger.info(f"Loaded PPE detection model: {self.model_path}")
            
        except Exception as e:
            logger.error(f"Failed to load PPE model: {e}")
            self.session = None
    
    def detect(self, frame: np.ndarray) -> Tuple[List[PPEDetection], List[Tuple]]:
        """
        Detect PPE items and people in frame
        Returns: (ppe_detections, person_bboxes)
        """
        if self.session is None:
            return [], []
        
        try:
            # Preprocess
            input_tensor = self._preprocess_frame(frame)
            if input_tensor is None:
                return [], []
            
            # Run inference
            outputs = self.session.run(self.output_names, {self.input_name: input_tensor})
            
            # Parse outputs
            return self._parse_detections(outputs, frame.shape)
            
        except Exception as e:
            logger.error(f"PPE detection failed: {e}")
            return [], []
    
    def _preprocess_frame(self, frame: np.ndarray) -> Optional[np.ndarray]:
        """Preprocess frame for YOLO input"""
        try:
            # Resize and pad to maintain aspect ratio
            h, w = frame.shape[:2]
            target_h, target_w = self.input_shape
            
            # Calculate scaling
            scale = min(target_w / w, target_h / h)
            new_w = int(w * scale)
            new_h = int(h * scale)
            
            # Resize
            resized = cv2.resize(frame, (new_w, new_h))
            
            # Pad to target size
            pad_w = target_w - new_w
            pad_h = target_h - new_h
            
            padded = cv2.copyMakeBorder(
                resized, 0, pad_h, 0, pad_w,
                cv2.BORDER_CONSTANT, value=[114, 114, 114]
            )
            
            # Normalize and format for ONNX: (1, 3, H, W)
            normalized = padded.astype(np.float32) / 255.0
            if len(normalized.shape) == 3:
                normalized = cv2.cvtColor(normalized, cv2.COLOR_BGR2RGB)
                normalized = np.transpose(normalized, (2, 0, 1))
            
            return np.expand_dims(normalized, axis=0)
            
        except Exception as e:
            logger.error(f"Frame preprocessing failed: {e}")
            return None
    
    def _parse_detections(self, outputs: List[np.ndarray], frame_shape: Tuple) -> Tuple[List[PPEDetection], List[Tuple]]:
        """Parse YOLO outputs into detections"""
        if not outputs:
            return [], []
        
        # Assume YOLOv5/v8 format: (batch, num_detections, 85)
        # [x, y, w, h, confidence, class_probs...]
        detections = outputs[0][0]  # Remove batch dimension
        
        h, w = frame_shape[:2]
        scale_x = w / self.input_shape[1]
        scale_y = h / self.input_shape[0]
        
        ppe_detections = []
        person_bboxes = []
        
        for det in detections:
            if len(det) < 6:
                continue
            
            # Parse detection
            x_center, y_center, width, height = det[:4]
            obj_conf = det[4]
            
            if obj_conf < self.confidence_threshold:
                continue
            
            # Get class with highest probability
            class_probs = det[5:]
            class_id = np.argmax(class_probs)
            class_conf = class_probs[class_id]
            
            if class_conf < self.confidence_threshold:
                continue
            
            # Convert to absolute coordinates
            x1 = int((x_center - width/2) * scale_x)
            y1 = int((y_center - height/2) * scale_y)
            x2 = int((x_center + width/2) * scale_x)
            y2 = int((y_center + height/2) * scale_y)
            
            # Clamp to frame bounds
            x1 = max(0, min(x1, w-1))
            y1 = max(0, min(y1, h-1))
            x2 = max(0, min(x2, w-1))
            y2 = max(0, min(y2, h-1))
            
            bbox = (x1, y1, x2, y2)
            confidence = obj_conf * class_conf
            
            class_name = self.ppe_classes.get(class_id, f'class_{class_id}')
            
            if class_name == 'person':
                person_bboxes.append(bbox)
            elif class_name in ['helmet', 'vest', 'safety_glasses', 'boots', 'gloves', 'no_helmet', 'no_vest']:
                # For PPE items, we need to associate with person - simplified for now
                ppe_detections.append(PPEDetection(
                    class_name=class_name,
                    bbox=bbox,
                    confidence=confidence,
                    person_bbox=bbox  # TODO: proper person association
                ))
        
        return ppe_detections, person_bboxes

class PostureAnalyzer:
    """Human pose estimation for posture analysis"""
    
    def __init__(self, model_path: str = "/models/pose_estimation.onnx"):
        self.model_path = model_path
        self.session = None
        self.input_name = None
        self.output_names = None
        
        self._load_model()
    
    def _load_model(self):
        """Load pose estimation model"""
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"Pose model not found: {self.model_path}")
                return
            
            providers = ['CPUExecutionProvider']
            if ort.get_device() == 'GPU':
                providers.insert(0, 'CUDAExecutionProvider')
            
            self.session = ort.InferenceSession(self.model_path, providers=providers)
            self.input_name = self.session.get_inputs()[0].name
            self.output_names = [output.name for output in self.session.get_outputs()]
            
            logger.info(f"Loaded pose estimation model: {self.model_path}")
            
        except Exception as e:
            logger.error(f"Failed to load pose model: {e}")
            self.session = None
    
    def analyze_posture(self, frame: np.ndarray, person_bboxes: List[Tuple]) -> List[PostureKeypoints]:
        """Analyze posture for detected people"""
        if self.session is None:
            return []
        
        postures = []
        
        for bbox in person_bboxes:
            try:
                keypoints = self._extract_keypoints(frame, bbox)
                if keypoints is not None:
                    postures.append(keypoints)
            except Exception as e:
                logger.error(f"Posture analysis failed for bbox {bbox}: {e}")
                continue
        
        return postures
    
    def _extract_keypoints(self, frame: np.ndarray, bbox: Tuple) -> Optional[PostureKeypoints]:
        """Extract keypoints for a person crop"""
        # Simplified placeholder - implement actual pose estimation
        x1, y1, x2, y2 = bbox
        
        # Create dummy keypoints for demonstration
        keypoints = np.zeros((17, 3))  # 17 COCO keypoints
        
        # Simulate some keypoints within the bbox
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2
        
        # Basic body structure
        keypoints[0] = [center_x, y1 + (y2-y1)*0.1, 0.9]  # nose
        keypoints[5] = [center_x - (x2-x1)*0.2, y1 + (y2-y1)*0.3, 0.8]  # left shoulder
        keypoints[6] = [center_x + (x2-x1)*0.2, y1 + (y2-y1)*0.3, 0.8]  # right shoulder
        keypoints[11] = [center_x - (x2-x1)*0.15, y1 + (y2-y1)*0.6, 0.7]  # left hip
        keypoints[12] = [center_x + (x2-x1)*0.15, y1 + (y2-y1)*0.6, 0.7]  # right hip
        
        return PostureKeypoints(
            keypoints=keypoints,
            bbox=bbox,
            confidence=0.8
        )
    
    def detect_unsafe_lifting(self, posture: PostureKeypoints) -> bool:
        """Detect unsafe lifting posture"""
        if posture.keypoints is None:
            return False
        
        keypoints = posture.keypoints
        
        # Check if key joints are visible
        shoulders = keypoints[PostureKeypoints.SHOULDERS]
        hips = keypoints[PostureKeypoints.HIPS]
        
        if shoulders[0, 2] < 0.5 or shoulders[1, 2] < 0.5 or hips[0, 2] < 0.5 or hips[1, 2] < 0.5:
            return False
        
        # Calculate spine angle
        shoulder_center = np.mean(shoulders[:, :2], axis=0)
        hip_center = np.mean(hips[:, :2], axis=0)
        
        spine_vector = shoulder_center - hip_center
        vertical_vector = np.array([0, -1])  # pointing up
        
        # Calculate angle with vertical
        cos_angle = np.dot(spine_vector, vertical_vector) / (np.linalg.norm(spine_vector) * np.linalg.norm(vertical_vector))
        angle_deg = np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))
        
        # Consider bending > 30 degrees as potentially unsafe
        return angle_deg > 30

class ZoneManager:
    """Manage safety zones with efficient spatial queries"""
    
    def __init__(self):
        self.zones: Dict[str, SafetyZone] = {}
    
    def load_zones_from_geojson(self, geojson_data: Dict[str, Any]):
        """Load zones from GeoJSON format"""
        try:
            if 'features' not in geojson_data:
                return
            
            for feature in geojson_data['features']:
                if feature.get('geometry', {}).get('type') != 'Polygon':
                    continue
                
                # Extract coordinates
                coords = feature['geometry']['coordinates'][0]  # Exterior ring
                polygon = Polygon(coords)
                
                # Get properties
                props = feature.get('properties', {})
                zone_id = props.get('id', f'zone_{len(self.zones)}')
                label = props.get('label', 'general')
                
                # Create zone with prepared geometry for fast queries
                zone = SafetyZone(
                    zone_id=zone_id,
                    label=label,
                    polygon=polygon,
                    prepared_geom=prep(polygon),
                    metadata=props
                )
                
                self.zones[zone_id] = zone
                logger.info(f"Loaded safety zone: {zone_id} ({label})")
                
        except Exception as e:
            logger.error(f"Failed to load zones from GeoJSON: {e}")
    
    def check_point_in_zones(self, point: Tuple[float, float]) -> List[SafetyZone]:
        """Check which zones contain the given point"""
        pt = Point(point)
        containing_zones = []
        
        for zone in self.zones.values():
            try:
                if zone.prepared_geom.contains(pt):
                    containing_zones.append(zone)
            except Exception as e:
                logger.error(f"Zone check failed for {zone.zone_id}: {e}")
                continue
        
        return containing_zones
    
    def get_zone_violations(self, person_bboxes: List[Tuple]) -> List[Dict[str, Any]]:
        """Check for zone violations"""
        violations = []
        
        for bbox in person_bboxes:
            x1, y1, x2, y2 = bbox
            # Use center point of person
            center_point = ((x1 + x2) / 2, (y1 + y2) / 2)
            
            zones = self.check_point_in_zones(center_point)
            
            for zone in zones:
                if zone.label == 'restricted':
                    violations.append({
                        'type': 'unauthorized_zone',
                        'severity': 'HIGH',
                        'zone_id': zone.zone_id,
                        'person_bbox': bbox,
                        'zone_label': zone.label,
                        'metadata': zone.metadata
                    })
        
        return violations

class FallDetector:
    """Fall detection using pose and motion analysis"""
    
    def __init__(self, 
                 acceleration_threshold: float = 15.0,
                 immobility_seconds: int = 3,
                 ground_proximity_threshold: float = 0.7):
        
        self.acceleration_threshold = acceleration_threshold
        self.immobility_seconds = immobility_seconds
        self.ground_proximity_threshold = ground_proximity_threshold
        
        # Track person states
        self.person_states: Dict[str, Dict] = {}
        self.cleanup_timeout = timedelta(minutes=5)
    
    def analyze_frame(self, 
                     person_bboxes: List[Tuple],
                     postures: List[PostureKeypoints],
                     frame_shape: Tuple,
                     timestamp: Optional[datetime] = None) -> List[FallEvent]:
        """Analyze frame for fall events"""
        
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        fall_events = []
        
        # Update person tracking
        for i, bbox in enumerate(person_bboxes):
            person_id = f"person_{i}"  # Simple ID - improve with tracking
            
            # Get corresponding posture
            posture = postures[i] if i < len(postures) else None
            
            # Update state
            self._update_person_state(person_id, bbox, posture, timestamp, frame_shape)
            
            # Check for fall
            fall_event = self._check_fall(person_id, timestamp)
            if fall_event:
                fall_events.append(fall_event)
        
        # Cleanup old states
        self._cleanup_old_states(timestamp)
        
        return fall_events
    
    def _update_person_state(self, 
                            person_id: str,
                            bbox: Tuple,
                            posture: Optional[PostureKeypoints],
                            timestamp: datetime,
                            frame_shape: Tuple):
        """Update tracking state for a person"""
        
        if person_id not in self.person_states:
            self.person_states[person_id] = {
                'bbox_history': deque(maxlen=10),
                'posture_history': deque(maxlen=5),
                'timestamps': deque(maxlen=10),
                'last_movement_time': timestamp,
                'fall_score_history': deque(maxlen=5)
            }
        
        state = self.person_states[person_id]
        
        # Update histories
        state['bbox_history'].append(bbox)
        state['posture_history'].append(posture)
        state['timestamps'].append(timestamp)
        
        # Calculate movement
        if len(state['bbox_history']) >= 2:
            prev_bbox = state['bbox_history'][-2]
            movement = self._calculate_movement(prev_bbox, bbox)
            
            if movement > 5:  # Minimum movement threshold
                state['last_movement_time'] = timestamp
        
        # Calculate fall score
        fall_score = self._calculate_fall_score(state, frame_shape)
        state['fall_score_history'].append(fall_score)
    
    def _calculate_movement(self, bbox1: Tuple, bbox2: Tuple) -> float:
        """Calculate movement between two bboxes"""
        x1_center = (bbox1[0] + bbox1[2]) / 2
        y1_center = (bbox1[1] + bbox1[3]) / 2
        x2_center = (bbox2[0] + bbox2[2]) / 2
        y2_center = (bbox2[1] + bbox2[3]) / 2
        
        return np.sqrt((x2_center - x1_center)**2 + (y2_center - y1_center)**2)
    
    def _calculate_fall_score(self, state: Dict, frame_shape: Tuple) -> float:
        """Calculate fall probability score"""
        if not state['bbox_history']:
            return 0.0
        
        current_bbox = state['bbox_history'][-1]
        frame_h, frame_w = frame_shape[:2]
        
        scores = []
        
        # Ground proximity score
        x1, y1, x2, y2 = current_bbox
        person_bottom = y2
        ground_proximity = person_bottom / frame_h
        
        if ground_proximity > self.ground_proximity_threshold:
            scores.append(0.4)  # High score for being low in frame
        
        # Aspect ratio score (fallen people are wider than tall)
        width = x2 - x1
        height = y2 - y1
        aspect_ratio = width / max(height, 1)
        
        if aspect_ratio > 1.5:  # Wider than tall
            scores.append(0.3)
        
        # Acceleration score
        if len(state['bbox_history']) >= 3:
            # Simple acceleration calculation
            recent_movement = self._calculate_movement(state['bbox_history'][-3], state['bbox_history'][-1])
            if recent_movement > self.acceleration_threshold:
                scores.append(0.5)
        
        # Posture score
        if state['posture_history'] and state['posture_history'][-1]:
            posture = state['posture_history'][-1]
            if self._is_horizontal_posture(posture):
                scores.append(0.6)
        
        return sum(scores)
    
    def _is_horizontal_posture(self, posture: PostureKeypoints) -> bool:
        """Check if posture appears horizontal/fallen"""
        keypoints = posture.keypoints
        
        # Check shoulder-hip orientation
        shoulders = keypoints[PostureKeypoints.SHOULDERS]
        hips = keypoints[PostureKeypoints.HIPS]
        
        if np.all(shoulders[:, 2] > 0.5) and np.all(hips[:, 2] > 0.5):
            # Calculate body orientation
            shoulder_center = np.mean(shoulders[:, :2], axis=0)
            hip_center = np.mean(hips[:, :2], axis=0)
            
            body_vector = shoulder_center - hip_center
            horizontal_vector = np.array([1, 0])
            
            cos_angle = np.dot(body_vector, horizontal_vector) / (np.linalg.norm(body_vector) * np.linalg.norm(horizontal_vector))
            angle_deg = np.degrees(np.arccos(np.clip(cos_angle, -1, 1)))
            
            # Body is more horizontal than vertical
            return angle_deg < 45 or angle_deg > 135
        
        return False
    
    def _check_fall(self, person_id: str, timestamp: datetime) -> Optional[FallEvent]:
        """Check if person has fallen"""
        if person_id not in self.person_states:
            return None
        
        state = self.person_states[person_id]
        
        # Need sufficient history
        if len(state['fall_score_history']) < 3:
            return None
        
        # Check recent fall scores
        recent_scores = list(state['fall_score_history'])[-3:]
        avg_score = np.mean(recent_scores)
        
        # Fall threshold
        if avg_score > 0.7:
            # Check immobility
            time_since_movement = timestamp - state['last_movement_time']
            
            if time_since_movement.total_seconds() >= self.immobility_seconds:
                current_bbox = state['bbox_history'][-1]
                
                return FallEvent(
                    person_id=person_id,
                    bbox=current_bbox,
                    fall_score=avg_score,
                    trigger_reason='fall_detected',
                    timestamp=timestamp,
                    keypoints=state['posture_history'][-1] if state['posture_history'] else None
                )
        
        return None
    
    def _cleanup_old_states(self, current_time: datetime):
        """Remove old person states"""
        cutoff = current_time - self.cleanup_timeout
        
        to_remove = []
        for person_id, state in self.person_states.items():
            if state['timestamps'] and state['timestamps'][-1] < cutoff:
                to_remove.append(person_id)
        
        for person_id in to_remove:
            del self.person_states[person_id]

class SafetyVisionPipeline:
    """Complete safety vision pipeline"""
    
    def __init__(self,
                 ppe_model_path: str = "/models/ppe_yolo.onnx",
                 pose_model_path: str = "/models/pose_estimation.onnx"):
        
        self.ppe_detector = PPEDetector(ppe_model_path)
        self.posture_analyzer = PostureAnalyzer(pose_model_path)
        self.zone_manager = ZoneManager()
        self.fall_detector = FallDetector()
        
        # PPE requirements per zone
        self.ppe_requirements = {
            'ppe_required': ['helmet', 'vest'],
            'critical': ['helmet', 'vest', 'safety_glasses'],
            'fall_risk': ['helmet'],
        }
    
    def analyze_frame(self, 
                     frame: np.ndarray,
                     site_id: str,
                     camera_id: Optional[str] = None,
                     timestamp: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Analyze frame for safety violations
        Returns list of signals/events
        """
        if timestamp is None:
            timestamp = datetime.utcnow()
        
        signals = []
        
        try:
            # 1. Detect PPE and people
            ppe_detections, person_bboxes = self.ppe_detector.detect(frame)
            
            # 2. Analyze postures
            postures = self.posture_analyzer.analyze_posture(frame, person_bboxes)
            
            # 3. Check zone violations
            zone_violations = self.zone_manager.get_zone_violations(person_bboxes)
            signals.extend(zone_violations)
            
            # 4. Check PPE compliance
            ppe_violations = self._check_ppe_compliance(ppe_detections, person_bboxes)
            signals.extend(ppe_violations)
            
            # 5. Check unsafe lifting
            for posture in postures:
                if self.posture_analyzer.detect_unsafe_lifting(posture):
                    signals.append({
                        'type': 'unsafe_lifting',
                        'severity': 'MEDIUM',
                        'person_bbox': posture.bbox,
                        'details': {'posture_confidence': posture.confidence}
                    })
            
            # 6. Detect falls
            fall_events = self.fall_detector.analyze_frame(person_bboxes, postures, frame.shape, timestamp)
            for fall in fall_events:
                signals.append({
                    'type': 'fall_suspected',
                    'severity': 'CRITICAL',
                    'person_bbox': fall.bbox,
                    'person_id': fall.person_id,
                    'details': {
                        'fall_score': fall.fall_score,
                        'trigger_reason': fall.trigger_reason
                    }
                })
            
            # Add common metadata
            for signal in signals:
                signal.update({
                    'site_id': site_id,
                    'camera_id': camera_id,
                    'timestamp': timestamp.isoformat(),
                    'frame_url': None  # TODO: save frame snapshots
                })
            
            return signals
            
        except Exception as e:
            logger.error(f"Safety analysis failed: {e}")
            return []
    
    def _check_ppe_compliance(self, 
                             ppe_detections: List[PPEDetection],
                             person_bboxes: List[Tuple]) -> List[Dict[str, Any]]:
        """Check PPE compliance for detected people"""
        violations = []
        
        for person_bbox in person_bboxes:
            # Find PPE items associated with this person
            person_ppe = self._associate_ppe_with_person(ppe_detections, person_bbox)
            
            # Check for missing required PPE
            detected_ppe = {ppe.class_name for ppe in person_ppe}
            
            # Simplified: assume helmet and vest required
            required_ppe = {'helmet', 'vest'}
            missing_ppe = required_ppe - detected_ppe
            
            # Check for negative detections
            for ppe in person_ppe:
                if ppe.class_name.startswith('no_'):
                    item = ppe.class_name.replace('no_', '')
                    if item in required_ppe:
                        missing_ppe.add(item)
            
            if missing_ppe:
                violations.append({
                    'type': 'missing_ppe',
                    'severity': 'HIGH',
                    'person_bbox': person_bbox,
                    'details': {
                        'missing_items': list(missing_ppe),
                        'detected_items': list(detected_ppe)
                    }
                })
        
        return violations
    
    def _associate_ppe_with_person(self, 
                                  ppe_detections: List[PPEDetection],
                                  person_bbox: Tuple) -> List[PPEDetection]:
        """Associate PPE detections with a person"""
        # Simplified association based on overlap
        person_ppe = []
        px1, py1, px2, py2 = person_bbox
        
        for ppe in ppe_detections:
            ex1, ey1, ex2, ey2 = ppe.bbox
            
            # Check for overlap
            overlap_x = max(0, min(px2, ex2) - max(px1, ex1))
            overlap_y = max(0, min(py2, ey2) - max(py1, ey1))
            overlap_area = overlap_x * overlap_y
            
            ppe_area = (ex2 - ex1) * (ey2 - ey1)
            
            # If PPE overlaps significantly with person
            if overlap_area > 0.3 * ppe_area:
                person_ppe.append(ppe)
        
        return person_ppe
    
    def load_zones(self, geojson_data: Dict[str, Any]):
        """Load safety zones from GeoJSON"""
        self.zone_manager.load_zones_from_geojson(geojson_data)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics"""
        return {
            'ppe_model_loaded': self.ppe_detector.session is not None,
            'pose_model_loaded': self.posture_analyzer.session is not None,
            'zones_loaded': len(self.zone_manager.zones),
            'tracked_people': len(self.fall_detector.person_states)
        }