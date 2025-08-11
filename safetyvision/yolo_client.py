"""
YOLO Detection Service Client
HTTP client for calling yolo-detection microservice with caching
"""

import httpx
import asyncio
import hashlib
import base64
import time
import cv2
import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from collections import OrderedDict
import logging

logger = logging.getLogger(__name__)

@dataclass
class Detection:
    """YOLO detection result"""
    class_name: str
    confidence: float
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    class_id: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'class_name': self.class_name,
            'confidence': self.confidence,
            'bbox': list(self.bbox),
            'class_id': self.class_id
        }

class LRUCache:
    """Simple LRU cache for detection results"""
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache: OrderedDict = OrderedDict()
        
    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            # Move to end (most recently used)
            value = self.cache.pop(key)
            self.cache[key] = value
            return value
        return None
    
    def put(self, key: str, value: Any):
        if key in self.cache:
            # Update existing
            self.cache.pop(key)
        elif len(self.cache) >= self.max_size:
            # Remove oldest
            self.cache.popitem(last=False)
        
        self.cache[key] = value
    
    def clear(self):
        self.cache.clear()
    
    def size(self) -> int:
        return len(self.cache)

class YOLOClient:
    """HTTP client for YOLO detection service"""
    
    def __init__(self, 
                 yolo_service_url: str = "http://yolo-detection:8080",
                 timeout: float = 5.0,
                 cache_size: int = 1000,
                 cache_ttl_seconds: int = 60):
        
        self.yolo_service_url = yolo_service_url.rstrip('/')
        self.timeout = timeout
        self.cache = LRUCache(cache_size)
        self.cache_ttl = cache_ttl_seconds
        
        # HTTP client with connection pooling
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )
        
        # PPE classes mapping (adjust based on your YOLO model)
        self.ppe_classes = {
            'hardhat': ['helmet', 'hardhat', 'hard_hat'],
            'vest': ['safety_vest', 'vest', 'hi_vis'],
            'gloves': ['gloves', 'safety_gloves'],
            'boots': ['safety_boots', 'boots'],
            'glasses': ['safety_glasses', 'goggles'],
            'mask': ['face_mask', 'respirator']
        }
        
        # Person/worker classes
        self.person_classes = ['person', 'worker', 'employee']
        
    def _generate_cache_key(self, frame_data: bytes, track_id: str = None) -> str:
        """Generate cache key for frame/track combination"""
        # Use frame hash + track_id for cache key
        frame_hash = hashlib.md5(frame_data).hexdigest()[:16]
        if track_id:
            return f"{frame_hash}_{track_id}"
        return frame_hash
    
    def _is_cache_valid(self, cached_item: Dict) -> bool:
        """Check if cached item is still valid"""
        return time.time() - cached_item['timestamp'] < self.cache_ttl
    
    async def detect_objects(self, 
                           frame: np.ndarray,
                           track_id: str = None,
                           confidence_threshold: float = 0.5,
                           use_cache: bool = True) -> List[Detection]:
        """
        Detect objects in frame using YOLO service
        
        Args:
            frame: Input frame as numpy array
            track_id: Optional track ID for cache key
            confidence_threshold: Minimum confidence for detections
            use_cache: Whether to use result caching
            
        Returns:
            List of Detection objects
        """
        
        # Encode frame for transmission
        try:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_data = buffer.tobytes()
            frame_b64 = base64.b64encode(frame_data).decode('utf-8')
        except Exception as e:
            logger.error(f"Failed to encode frame: {e}")
            return []
        
        # Check cache first
        cache_key = None
        if use_cache:
            cache_key = self._generate_cache_key(frame_data, track_id)
            cached_result = self.cache.get(cache_key)
            
            if cached_result and self._is_cache_valid(cached_result):
                logger.debug(f"Cache hit for key: {cache_key}")
                return [Detection(**det) for det in cached_result['detections']]
        
        # Call YOLO service
        try:
            payload = {
                "image": frame_b64,
                "confidence_threshold": confidence_threshold,
                "model": "yolov8n",  # or your preferred model
                "track_id": track_id
            }
            
            response = await self.client.post(
                f"{self.yolo_service_url}/detect",
                json=payload
            )
            
            if response.status_code != 200:
                logger.error(f"YOLO service error: {response.status_code} - {response.text}")
                return []
            
            result = response.json()
            detections = []
            
            # Parse detections
            for det in result.get('detections', []):
                detection = Detection(
                    class_name=det['class'],
                    confidence=det['confidence'],
                    bbox=tuple(det['bbox']),  # [x1, y1, x2, y2]
                    class_id=det.get('class_id', 0)
                )
                detections.append(detection)
            
            # Cache result
            if use_cache and cache_key:
                cache_item = {
                    'timestamp': time.time(),
                    'detections': [det.to_dict() for det in detections]
                }
                self.cache.put(cache_key, cache_item)
                logger.debug(f"Cached {len(detections)} detections for key: {cache_key}")
            
            return detections
            
        except httpx.TimeoutException:
            logger.error("YOLO service timeout")
            return []
        except httpx.RequestError as e:
            logger.error(f"YOLO service request error: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error calling YOLO service: {e}")
            return []
    
    def find_ppe_items(self, detections: List[Detection]) -> Dict[str, List[Detection]]:
        """Find PPE items in detections"""
        ppe_items = {ppe_type: [] for ppe_type in self.ppe_classes.keys()}
        
        for detection in detections:
            for ppe_type, class_names in self.ppe_classes.items():
                if any(cls.lower() in detection.class_name.lower() for cls in class_names):
                    ppe_items[ppe_type].append(detection)
        
        return ppe_items
    
    def find_persons(self, detections: List[Detection]) -> List[Detection]:
        """Find person detections"""
        persons = []
        for detection in detections:
            if any(cls.lower() in detection.class_name.lower() for cls in self.person_classes):
                persons.append(detection)
        return persons
    
    async def analyze_ppe_compliance(self, 
                                   frame: np.ndarray,
                                   person_bbox: Tuple[int, int, int, int],
                                   required_ppe: List[str],
                                   track_id: str = None) -> Dict[str, Any]:
        """
        Analyze PPE compliance for a specific person region
        
        Args:
            frame: Full frame
            person_bbox: Person bounding box (x1, y1, x2, y2)
            required_ppe: List of required PPE types
            track_id: Track ID for caching
            
        Returns:
            Dict with compliance analysis
        """
        
        # Crop person region with padding
        x1, y1, x2, y2 = person_bbox
        padding = 20
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(frame.shape[1], x2 + padding)
        y2 = min(frame.shape[0], y2 + padding)
        
        person_crop = frame[y1:y2, x1:x2]
        
        if person_crop.size == 0:
            return {
                'compliant': False,
                'missing_ppe': required_ppe,
                'detected_ppe': {},
                'confidence': 0.0
            }
        
        # Detect objects in person region
        detections = await self.detect_objects(
            person_crop, 
            track_id=f"{track_id}_ppe" if track_id else None,
            confidence_threshold=0.3  # Lower threshold for PPE detection
        )
        
        # Find PPE items
        ppe_items = self.find_ppe_items(detections)
        
        # Check compliance
        detected_ppe = {}
        missing_ppe = []
        
        for ppe_type in required_ppe:
            items = ppe_items.get(ppe_type, [])
            if items:
                # Take highest confidence item
                best_item = max(items, key=lambda x: x.confidence)
                detected_ppe[ppe_type] = {
                    'detected': True,
                    'confidence': best_item.confidence,
                    'bbox': best_item.bbox
                }
            else:
                detected_ppe[ppe_type] = {
                    'detected': False,
                    'confidence': 0.0
                }
                missing_ppe.append(ppe_type)
        
        # Calculate overall compliance
        compliant = len(missing_ppe) == 0
        avg_confidence = np.mean([
            item['confidence'] for item in detected_ppe.values() 
            if item['detected']
        ]) if any(item['detected'] for item in detected_ppe.values()) else 0.0
        
        return {
            'compliant': compliant,
            'missing_ppe': missing_ppe,
            'detected_ppe': detected_ppe,
            'confidence': float(avg_confidence),
            'total_detections': len(detections)
        }
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            'size': self.cache.size(),
            'max_size': self.cache.max_size,
            'hit_ratio': getattr(self, '_cache_hits', 0) / max(getattr(self, '_cache_requests', 1), 1)
        }

# Singleton instance
_yolo_client: Optional[YOLOClient] = None

def get_yolo_client(yolo_service_url: str = "http://yolo-detection:8080") -> YOLOClient:
    """Get singleton YOLO client instance"""
    global _yolo_client
    if _yolo_client is None:
        _yolo_client = YOLOClient(yolo_service_url)
    return _yolo_client

async def cleanup_yolo_client():
    """Cleanup singleton client"""
    global _yolo_client
    if _yolo_client:
        await _yolo_client.close()
        _yolo_client = None