"""
Multi-Camera Fusion System for cross-camera tracking and 3D pose estimation
"""

import asyncio
import numpy as np
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json
import cv2
from scipy.optimize import linear_sum_assignment
from scipy.spatial.distance import cdist
import logging
from .correlation_logger import get_correlation_logger

logger = get_correlation_logger('multi_camera_fusion')

class TrackingState(Enum):
    ACTIVE = "active"
    LOST = "lost"
    MERGED = "merged"
    TERMINATED = "terminated"

@dataclass
class CameraCalibration:
    camera_id: str
    intrinsic_matrix: np.ndarray
    distortion_coeffs: np.ndarray
    rotation_matrix: np.ndarray
    translation_vector: np.ndarray
    position_3d: np.ndarray  # Camera position in world coordinates
    field_of_view: float

@dataclass
class Detection2D:
    detection_id: str
    camera_id: str
    bbox: Tuple[float, float, float, float]  # x, y, width, height
    confidence: float
    class_id: int
    class_name: str
    keypoints: Optional[List[Tuple[float, float, float]]] = None  # x, y, confidence
    feature_vector: Optional[np.ndarray] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)

@dataclass
class Track3D:
    track_id: str
    org_id: str
    position_3d: np.ndarray  # World coordinates
    velocity_3d: np.ndarray
    pose_3d: Optional[Dict[str, np.ndarray]] = None  # 3D keypoints
    associated_detections: Dict[str, Detection2D] = field(default_factory=dict)  # camera_id -> detection
    confidence: float = 0.0
    state: TrackingState = TrackingState.ACTIVE
    first_seen: datetime = field(default_factory=datetime.utcnow)
    last_seen: datetime = field(default_factory=datetime.utcnow)
    prediction_buffer: List[np.ndarray] = field(default_factory=list)

@dataclass
class SceneContext:
    scene_id: str
    camera_calibrations: Dict[str, CameraCalibration]
    ground_plane: Optional[np.ndarray] = None  # Ground plane equation
    roi_polygons: Dict[str, List[Tuple[float, float]]] = field(default_factory=dict)  # Per camera ROIs
    occlusion_zones: List[np.ndarray] = field(default_factory=list)
    scene_layout: Optional[Dict[str, Any]] = None

class MultiCameraFusion:
    """Advanced multi-camera fusion system"""
    
    def __init__(self, scene_context: SceneContext):
        self.scene_context = scene_context
        self.active_tracks: Dict[str, Track3D] = {}
        self.track_counter = 0
        self.association_threshold = 100.0  # pixels
        self.max_track_age = 30  # frames
        self.kalman_filters: Dict[str, Any] = {}
        
    async def process_frame_batch(
        self,
        frame_data: Dict[str, Dict[str, Any]]  # camera_id -> {detections, timestamp}
    ) -> Dict[str, Any]:
        """Process synchronized frame batch from multiple cameras"""
        
        start_time = datetime.utcnow()
        
        # Extract detections per camera
        camera_detections = {}
        for camera_id, data in frame_data.items():
            if camera_id in self.scene_context.camera_calibrations:
                detections = self._parse_detections(data.get('detections', []), camera_id)
                camera_detections[camera_id] = detections
        
        # Triangulate 3D positions
        triangulated_positions = await self._triangulate_positions(camera_detections)
        
        # Update tracks
        updated_tracks = await self._update_tracks(triangulated_positions, camera_detections)
        
        # Estimate 3D poses
        pose_estimates = await self._estimate_3d_poses(updated_tracks)
        
        # Scene understanding
        scene_analysis = await self._analyze_scene(updated_tracks)
        
        processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        logger.performance_log(
            operation="multi_camera_fusion",
            duration_ms=processing_time,
            camera_count=len(camera_detections),
            track_count=len(self.active_tracks),
            triangulated_count=len(triangulated_positions)
        )
        
        return {
            'tracks_3d': [self._track_to_dict(track) for track in updated_tracks],
            'pose_estimates': pose_estimates,
            'scene_analysis': scene_analysis,
            'processing_stats': {
                'processing_time_ms': processing_time,
                'camera_count': len(camera_detections),
                'active_tracks': len(self.active_tracks)
            }
        }
    
    async def _triangulate_positions(
        self,
        camera_detections: Dict[str, List[Detection2D]]
    ) -> List[Tuple[np.ndarray, Dict[str, Detection2D]]]:
        """Triangulate 3D positions from 2D detections"""
        
        triangulated = []
        
        # Get all camera pairs
        camera_ids = list(camera_detections.keys())
        
        for i, cam1_id in enumerate(camera_ids):
            for j, cam2_id in enumerate(camera_ids[i+1:], i+1):
                det1_list = camera_detections[cam1_id]
                det2_list = camera_detections[cam2_id]
                
                # Associate detections between cameras
                associations = self._associate_detections(det1_list, det2_list, cam1_id, cam2_id)
                
                for det1, det2 in associations:
                    # Triangulate 3D position
                    pos_3d = self._triangulate_point(det1, det2, cam1_id, cam2_id)
                    
                    if pos_3d is not None:
                        associated_dets = {cam1_id: det1, cam2_id: det2}
                        triangulated.append((pos_3d, associated_dets))
        
        return triangulated
    
    def _associate_detections(
        self,
        det1_list: List[Detection2D],
        det2_list: List[Detection2D],
        cam1_id: str,
        cam2_id: str
    ) -> List[Tuple[Detection2D, Detection2D]]:
        """Associate detections between two cameras using epipolar geometry"""
        
        if not det1_list or not det2_list:
            return []
        
        # Calculate epipolar distances
        distances = np.zeros((len(det1_list), len(det2_list)))
        
        for i, det1 in enumerate(det1_list):
            for j, det2 in enumerate(det2_list):
                # Use bbox center for association
                pt1 = np.array([det1.bbox[0] + det1.bbox[2]/2, det1.bbox[1] + det1.bbox[3]/2])
                pt2 = np.array([det2.bbox[0] + det2.bbox[2]/2, det2.bbox[1] + det2.bbox[3]/2])
                
                # Calculate epipolar distance
                epi_dist = self._calculate_epipolar_distance(pt1, pt2, cam1_id, cam2_id)
                
                # Include appearance similarity if feature vectors available
                appearance_dist = 0.0
                if det1.feature_vector is not None and det2.feature_vector is not None:
                    appearance_dist = np.linalg.norm(det1.feature_vector - det2.feature_vector)
                
                # Combined distance
                distances[i, j] = epi_dist + 0.3 * appearance_dist
        
        # Hungarian algorithm for optimal assignment
        row_indices, col_indices = linear_sum_assignment(distances)
        
        associations = []
        for i, j in zip(row_indices, col_indices):
            if distances[i, j] < self.association_threshold:
                associations.append((det1_list[i], det2_list[j]))
        
        return associations
    
    def _triangulate_point(
        self,
        det1: Detection2D,
        det2: Detection2D,
        cam1_id: str,
        cam2_id: str
    ) -> Optional[np.ndarray]:
        """Triangulate 3D point from two 2D detections"""
        
        cal1 = self.scene_context.camera_calibrations[cam1_id]
        cal2 = self.scene_context.camera_calibrations[cam2_id]
        
        # Get bbox centers
        pt1 = np.array([det1.bbox[0] + det1.bbox[2]/2, det1.bbox[1] + det1.bbox[3]/2])
        pt2 = np.array([det2.bbox[0] + det2.bbox[2]/2, det2.bbox[1] + det2.bbox[3]/2])
        
        # Normalize points
        pt1_norm = cv2.undistortPoints(pt1.reshape(1, 1, 2), cal1.intrinsic_matrix, cal1.distortion_coeffs)[0, 0]
        pt2_norm = cv2.undistortPoints(pt2.reshape(1, 1, 2), cal2.intrinsic_matrix, cal2.distortion_coeffs)[0, 0]
        
        # Projection matrices
        P1 = cal1.intrinsic_matrix @ np.hstack([cal1.rotation_matrix, cal1.translation_vector.reshape(-1, 1)])
        P2 = cal2.intrinsic_matrix @ np.hstack([cal2.rotation_matrix, cal2.translation_vector.reshape(-1, 1)])
        
        # Triangulate using DLT
        A = np.array([
            pt1_norm[0] * P1[2] - P1[0],
            pt1_norm[1] * P1[2] - P1[1],
            pt2_norm[0] * P2[2] - P2[0],
            pt2_norm[1] * P2[2] - P2[1]
        ])
        
        _, _, V = np.linalg.svd(A)
        X = V[-1]
        
        if X[3] != 0:
            X = X / X[3]
            return X[:3]
        
        return None
    
    def _calculate_epipolar_distance(
        self,
        pt1: np.ndarray,
        pt2: np.ndarray,
        cam1_id: str,
        cam2_id: str
    ) -> float:
        """Calculate epipolar distance between corresponding points"""
        
        cal1 = self.scene_context.camera_calibrations[cam1_id]
        cal2 = self.scene_context.camera_calibrations[cam2_id]
        
        # Calculate fundamental matrix
        R_rel = cal2.rotation_matrix @ cal1.rotation_matrix.T
        t_rel = cal2.translation_vector - R_rel @ cal1.translation_vector
        
        # Skew symmetric matrix
        t_skew = np.array([
            [0, -t_rel[2], t_rel[1]],
            [t_rel[2], 0, -t_rel[0]],
            [-t_rel[1], t_rel[0], 0]
        ])
        
        E = t_skew @ R_rel  # Essential matrix
        F = np.linalg.inv(cal2.intrinsic_matrix).T @ E @ np.linalg.inv(cal1.intrinsic_matrix)  # Fundamental matrix
        
        # Calculate epipolar line
        pt1_homo = np.array([pt1[0], pt1[1], 1])
        pt2_homo = np.array([pt2[0], pt2[1], 1])
        
        line2 = F @ pt1_homo
        distance = abs(np.dot(line2, pt2_homo)) / np.sqrt(line2[0]**2 + line2[1]**2)
        
        return distance
    
    async def _update_tracks(
        self,
        triangulated_positions: List[Tuple[np.ndarray, Dict[str, Detection2D]]],
        camera_detections: Dict[str, List[Detection2D]]
    ) -> List[Track3D]:
        """Update 3D tracks with new observations"""
        
        updated_tracks = []
        
        # Associate triangulated positions with existing tracks
        position_track_distances = np.zeros((len(triangulated_positions), len(self.active_tracks)))
        track_ids = list(self.active_tracks.keys())
        
        for i, (pos_3d, _) in enumerate(triangulated_positions):
            for j, track_id in enumerate(track_ids):
                track = self.active_tracks[track_id]
                distance = np.linalg.norm(pos_3d - track.position_3d)
                position_track_distances[i, j] = distance
        
        # Hungarian assignment
        if len(triangulated_positions) > 0 and len(track_ids) > 0:
            row_indices, col_indices = linear_sum_assignment(position_track_distances)
            
            matched_positions = set()
            matched_tracks = set()
            
            for i, j in zip(row_indices, col_indices):
                if position_track_distances[i, j] < 2.0:  # 2 meter threshold
                    pos_3d, detections = triangulated_positions[i]
                    track_id = track_ids[j]
                    track = self.active_tracks[track_id]
                    
                    # Update track
                    self._update_track_with_observation(track, pos_3d, detections)
                    updated_tracks.append(track)
                    
                    matched_positions.add(i)
                    matched_tracks.add(track_id)
            
            # Create new tracks for unmatched positions
            for i, (pos_3d, detections) in enumerate(triangulated_positions):
                if i not in matched_positions:
                    new_track = self._create_new_track(pos_3d, detections)
                    self.active_tracks[new_track.track_id] = new_track
                    updated_tracks.append(new_track)
            
            # Update unmatched tracks (predict)
            for track_id in track_ids:
                if track_id not in matched_tracks:
                    track = self.active_tracks[track_id]
                    self._predict_track(track)
                    
                    # Check if track should be terminated
                    if (datetime.utcnow() - track.last_seen).total_seconds() > self.max_track_age:
                        track.state = TrackingState.LOST
                    else:
                        updated_tracks.append(track)
        
        return updated_tracks
    
    def _create_new_track(
        self,
        position_3d: np.ndarray,
        detections: Dict[str, Detection2D]
    ) -> Track3D:
        """Create new 3D track"""
        
        self.track_counter += 1
        track_id = f"track_3d_{self.track_counter:06d}"
        
        track = Track3D(
            track_id=track_id,
            org_id=list(detections.values())[0].camera_id.split('_')[0] if detections else "unknown",
            position_3d=position_3d.copy(),
            velocity_3d=np.zeros(3),
            associated_detections=detections.copy(),
            confidence=np.mean([det.confidence for det in detections.values()]) if detections else 0.0
        )
        
        # Initialize Kalman filter
        self._init_kalman_filter(track_id)
        
        logger.debug(f"Created new 3D track: {track_id} at position {position_3d}")
        
        return track
    
    def _update_track_with_observation(
        self,
        track: Track3D,
        position_3d: np.ndarray,
        detections: Dict[str, Detection2D]
    ):
        """Update track with new observation"""
        
        # Update position using Kalman filter
        if track.track_id in self.kalman_filters:
            kf = self.kalman_filters[track.track_id]
            # Predict and update (simplified)
            predicted_pos = kf.get('predicted_position', track.position_3d)
            
            # Simple alpha-beta filter for now
            alpha = 0.7
            track.position_3d = alpha * position_3d + (1 - alpha) * predicted_pos
            
            # Update velocity
            dt = (datetime.utcnow() - track.last_seen).total_seconds()
            if dt > 0:
                track.velocity_3d = (track.position_3d - predicted_pos) / dt
        else:
            track.position_3d = position_3d.copy()
        
        # Update associated detections
        track.associated_detections = detections.copy()
        track.confidence = np.mean([det.confidence for det in detections.values()])
        track.last_seen = datetime.utcnow()
        track.state = TrackingState.ACTIVE
    
    def _predict_track(self, track: Track3D):
        """Predict track position for next frame"""
        
        dt = (datetime.utcnow() - track.last_seen).total_seconds()
        track.position_3d += track.velocity_3d * dt
        
        # Store prediction in buffer
        track.prediction_buffer.append(track.position_3d.copy())
        if len(track.prediction_buffer) > 10:
            track.prediction_buffer.pop(0)
    
    def _init_kalman_filter(self, track_id: str):
        """Initialize Kalman filter for track"""
        
        # Simplified Kalman filter state
        self.kalman_filters[track_id] = {
            'predicted_position': np.zeros(3),
            'covariance': np.eye(3),
            'process_noise': np.eye(3) * 0.1,
            'measurement_noise': np.eye(3) * 0.5
        }
    
    async def _estimate_3d_poses(
        self,
        tracks: List[Track3D]
    ) -> Dict[str, Dict[str, Any]]:
        """Estimate 3D poses for tracks with sufficient keypoint data"""
        
        pose_estimates = {}
        
        for track in tracks:
            # Check if we have keypoint detections from multiple cameras
            keypoint_cameras = []
            for camera_id, detection in track.associated_detections.items():
                if detection.keypoints and len(detection.keypoints) > 10:  # Minimum keypoints
                    keypoint_cameras.append((camera_id, detection))
            
            if len(keypoint_cameras) >= 2:
                # Triangulate 3D keypoints
                pose_3d = self._triangulate_pose(keypoint_cameras)
                if pose_3d:
                    pose_estimates[track.track_id] = {
                        'keypoints_3d': pose_3d,
                        'confidence': track.confidence,
                        'timestamp': track.last_seen.isoformat()
                    }
        
        return pose_estimates
    
    def _triangulate_pose(
        self,
        keypoint_cameras: List[Tuple[str, Detection2D]]
    ) -> Optional[Dict[str, np.ndarray]]:
        """Triangulate 3D pose from multiple camera keypoints"""
        
        # Simplified pose triangulation
        # In production, this would use more sophisticated pose estimation
        pose_3d = {}
        
        # Standard pose keypoint names
        keypoint_names = [
            'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
            'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
            'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
            'left_knee', 'right_knee', 'left_ankle', 'right_ankle'
        ]
        
        if len(keypoint_cameras) >= 2:
            cam1_id, det1 = keypoint_cameras[0]
            cam2_id, det2 = keypoint_cameras[1]
            
            if det1.keypoints and det2.keypoints:
                min_keypoints = min(len(det1.keypoints), len(det2.keypoints), len(keypoint_names))
                
                for i in range(min_keypoints):
                    kp1 = det1.keypoints[i]
                    kp2 = det2.keypoints[i]
                    
                    if kp1[2] > 0.5 and kp2[2] > 0.5:  # Confidence threshold
                        # Create pseudo detections for triangulation
                        kp_det1 = Detection2D(
                            detection_id=f"kp_{i}",
                            camera_id=cam1_id,
                            bbox=(kp1[0], kp1[1], 1, 1),
                            confidence=kp1[2],
                            class_id=0,
                            class_name="keypoint"
                        )
                        kp_det2 = Detection2D(
                            detection_id=f"kp_{i}",
                            camera_id=cam2_id,
                            bbox=(kp2[0], kp2[1], 1, 1),
                            confidence=kp2[2],
                            class_id=0,
                            class_name="keypoint"
                        )
                        
                        pos_3d = self._triangulate_point(kp_det1, kp_det2, cam1_id, cam2_id)
                        if pos_3d is not None and i < len(keypoint_names):
                            pose_3d[keypoint_names[i]] = pos_3d
        
        return pose_3d if pose_3d else None
    
    async def _analyze_scene(
        self,
        tracks: List[Track3D]
    ) -> Dict[str, Any]:
        """Analyze scene context and relationships"""
        
        scene_analysis = {
            'total_people': len([t for t in tracks if t.state == TrackingState.ACTIVE]),
            'density_zones': {},
            'interaction_events': [],
            'movement_patterns': {},
            'anomalies': []
        }
        
        if not tracks:
            return scene_analysis
        
        # Calculate density zones
        positions = np.array([track.position_3d[:2] for track in tracks if track.state == TrackingState.ACTIVE])
        if len(positions) > 0:
            # Simple density calculation using spatial clustering
            from sklearn.cluster import DBSCAN
            
            if len(positions) > 1:
                clustering = DBSCAN(eps=2.0, min_samples=2).fit(positions)
                unique_labels = set(clustering.labels_)
                
                for label in unique_labels:
                    if label != -1:  # -1 is noise
                        cluster_points = positions[clustering.labels_ == label]
                        center = np.mean(cluster_points, axis=0)
                        density = len(cluster_points)
                        
                        scene_analysis['density_zones'][f'zone_{label}'] = {
                            'center': center.tolist(),
                            'count': density,
                            'area': float(np.pi * 2.0**2)  # Approximation
                        }
        
        # Detect interactions (people close to each other)
        active_tracks = [t for t in tracks if t.state == TrackingState.ACTIVE]
        for i, track1 in enumerate(active_tracks):
            for track2 in active_tracks[i+1:]:
                distance = np.linalg.norm(track1.position_3d - track2.position_3d)
                if distance < 2.0:  # Within 2 meters
                    scene_analysis['interaction_events'].append({
                        'track1_id': track1.track_id,
                        'track2_id': track2.track_id,
                        'distance': float(distance),
                        'timestamp': datetime.utcnow().isoformat()
                    })
        
        # Movement pattern analysis
        for track in active_tracks:
            if len(track.prediction_buffer) > 3:
                # Calculate movement statistics
                positions = np.array(track.prediction_buffer)
                movement_distance = np.sum(np.linalg.norm(np.diff(positions, axis=0), axis=1))
                
                scene_analysis['movement_patterns'][track.track_id] = {
                    'total_distance': float(movement_distance),
                    'avg_speed': float(np.linalg.norm(track.velocity_3d)),
                    'direction': track.velocity_3d.tolist() if np.linalg.norm(track.velocity_3d) > 0.1 else None
                }
        
        return scene_analysis
    
    def _parse_detections(
        self,
        detection_data: List[Dict[str, Any]],
        camera_id: str
    ) -> List[Detection2D]:
        """Parse detection data into Detection2D objects"""
        
        detections = []
        
        for i, det_dict in enumerate(detection_data):
            detection = Detection2D(
                detection_id=f"{camera_id}_{i}_{int(datetime.utcnow().timestamp())}",
                camera_id=camera_id,
                bbox=(
                    det_dict.get('bbox', {}).get('x', 0),
                    det_dict.get('bbox', {}).get('y', 0),
                    det_dict.get('bbox', {}).get('width', 0),
                    det_dict.get('bbox', {}).get('height', 0)
                ),
                confidence=det_dict.get('confidence', 0.0),
                class_id=det_dict.get('class_id', 0),
                class_name=det_dict.get('class_name', 'unknown'),
                keypoints=det_dict.get('keypoints'),
                feature_vector=np.array(det_dict.get('features', [])) if det_dict.get('features') else None
            )
            detections.append(detection)
        
        return detections
    
    def _track_to_dict(self, track: Track3D) -> Dict[str, Any]:
        """Convert Track3D to dictionary for API response"""
        
        return {
            'track_id': track.track_id,
            'position_3d': track.position_3d.tolist(),
            'velocity_3d': track.velocity_3d.tolist(),
            'confidence': track.confidence,
            'state': track.state.value,
            'first_seen': track.first_seen.isoformat(),
            'last_seen': track.last_seen.isoformat(),
            'associated_cameras': list(track.associated_detections.keys()),
            'pose_3d': {k: v.tolist() for k, v in track.pose_3d.items()} if track.pose_3d else None
        }

# Factory function
def create_multi_camera_fusion(scene_context: SceneContext) -> MultiCameraFusion:
    """Create multi-camera fusion system"""
    return MultiCameraFusion(scene_context)