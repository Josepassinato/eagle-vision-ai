"""
Universal Privacy Middleware for AI Vision Platform
Provides configurable anonymization for faces, license plates, and custom regions
Supports multiple blur strategies and org-specific privacy settings
"""

import cv2
import numpy as np
import base64
from typing import List, Dict, Any, Optional, Union
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

class BlurType(Enum):
    GAUSSIAN = "gaussian"
    PIXELATION = "pixelation"
    BLACK_BOX = "black_box"
    CUSTOM = "custom"

class RegionType(Enum):
    FACE = "face"
    LICENSE_PLATE = "license_plate"
    CUSTOM = "custom"
    PERSON = "person"

@dataclass
class PrivacyRegion:
    """Defines a region to be anonymized"""
    bbox: List[float]  # [x1, y1, x2, y2]
    region_type: RegionType
    blur_type: BlurType = BlurType.GAUSSIAN
    intensity: float = 1.0  # 0.0 to 1.0
    confidence: float = 1.0

class BlurStrategy(ABC):
    """Abstract base class for blur implementations"""
    
    @abstractmethod
    def apply(self, image: np.ndarray, bbox: List[float], intensity: float = 1.0) -> np.ndarray:
        pass

class GaussianBlurStrategy(BlurStrategy):
    """Gaussian blur implementation"""
    
    def apply(self, image: np.ndarray, bbox: List[float], intensity: float = 1.0) -> np.ndarray:
        x1, y1, x2, y2 = map(int, bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)
        
        if x2 <= x1 or y2 <= y1:
            return image
        
        # Calculate kernel size based on intensity and region size
        region_size = min(x2 - x1, y2 - y1)
        kernel_size = max(3, int(region_size * 0.1 * intensity))
        if kernel_size % 2 == 0:
            kernel_size += 1
        
        # Apply Gaussian blur to the region
        roi = image[y1:y2, x1:x2]
        blurred_roi = cv2.GaussianBlur(roi, (kernel_size, kernel_size), 0)
        image[y1:y2, x1:x2] = blurred_roi
        
        return image

class PixelationStrategy(BlurStrategy):
    """Pixelation blur implementation"""
    
    def apply(self, image: np.ndarray, bbox: List[float], intensity: float = 1.0) -> np.ndarray:
        x1, y1, x2, y2 = map(int, bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)
        
        if x2 <= x1 or y2 <= y1:
            return image
        
        # Calculate pixel size based on intensity
        region_width = x2 - x1
        region_height = y2 - y1
        pixel_size = max(2, int(min(region_width, region_height) * 0.05 * intensity))
        
        # Apply pixelation
        roi = image[y1:y2, x1:x2]
        h, w = roi.shape[:2]
        
        # Downscale
        small_h, small_w = max(1, h // pixel_size), max(1, w // pixel_size)
        small_roi = cv2.resize(roi, (small_w, small_h), interpolation=cv2.INTER_LINEAR)
        
        # Upscale back
        pixelated_roi = cv2.resize(small_roi, (w, h), interpolation=cv2.INTER_NEAREST)
        image[y1:y2, x1:x2] = pixelated_roi
        
        return image

class BlackBoxStrategy(BlurStrategy):
    """Black box anonymization implementation"""
    
    def apply(self, image: np.ndarray, bbox: List[float], intensity: float = 1.0) -> np.ndarray:
        x1, y1, x2, y2 = map(int, bbox)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(image.shape[1], x2), min(image.shape[0], y2)
        
        if x2 <= x1 or y2 <= y1:
            return image
        
        # Apply black box with optional transparency
        alpha = min(1.0, intensity)
        overlay = image.copy()
        cv2.rectangle(overlay, (x1, y1), (x2, y2), (0, 0, 0), -1)
        
        # Blend with original based on intensity
        image = cv2.addWeighted(image, 1 - alpha, overlay, alpha, 0)
        
        return image

class PrivacyMiddleware:
    """Main privacy middleware for anonymizing video frames"""
    
    def __init__(self):
        self.strategies = {
            BlurType.GAUSSIAN: GaussianBlurStrategy(),
            BlurType.PIXELATION: PixelationStrategy(),
            BlurType.BLACK_BOX: BlackBoxStrategy()
        }
        
        # Default privacy settings
        self.default_settings = {
            RegionType.FACE: {
                "enabled": True,
                "blur_type": BlurType.GAUSSIAN,
                "intensity": 0.8,
                "min_confidence": 0.5
            },
            RegionType.LICENSE_PLATE: {
                "enabled": True,
                "blur_type": BlurType.BLACK_BOX,
                "intensity": 1.0,
                "min_confidence": 0.5
            },
            RegionType.PERSON: {
                "enabled": False,
                "blur_type": BlurType.PIXELATION,
                "intensity": 0.6,
                "min_confidence": 0.7
            }
        }
    
    def add_custom_strategy(self, blur_type: BlurType, strategy: BlurStrategy):
        """Add a custom blur strategy"""
        self.strategies[blur_type] = strategy
    
    def apply_anonymization(
        self, 
        image: np.ndarray, 
        regions: List[PrivacyRegion], 
        org_settings: Optional[Dict[str, Any]] = None
    ) -> np.ndarray:
        """
        Apply anonymization to an image based on privacy regions and org settings
        
        Args:
            image: Input image as numpy array
            regions: List of PrivacyRegion objects to anonymize
            org_settings: Organization-specific privacy settings
            
        Returns:
            Anonymized image
        """
        if not regions:
            return image
        
        # Merge org settings with defaults
        settings = self.default_settings.copy()
        if org_settings:
            for region_type, region_settings in org_settings.items():
                if region_type in settings:
                    settings[region_type].update(region_settings)
        
        # Apply anonymization to each region
        result_image = image.copy()
        for region in regions:
            region_config = settings.get(region.region_type)
            if not region_config or not region_config.get("enabled", False):
                continue
            
            # Check confidence threshold
            if region.confidence < region_config.get("min_confidence", 0.5):
                continue
            
            # Get blur strategy
            blur_type = region.blur_type if region.blur_type != BlurType.CUSTOM else region_config.get("blur_type", BlurType.GAUSSIAN)
            strategy = self.strategies.get(blur_type)
            if not strategy:
                continue
            
            # Apply anonymization
            intensity = region.intensity * region_config.get("intensity", 1.0)
            result_image = strategy.apply(result_image, region.bbox, intensity)
        
        return result_image
    
    def process_frame_b64(
        self, 
        frame_b64: str, 
        regions: List[Dict[str, Any]], 
        org_settings: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Process base64 encoded frame with privacy anonymization
        
        Args:
            frame_b64: Base64 encoded image
            regions: List of region dictionaries
            org_settings: Organization privacy settings
            
        Returns:
            Base64 encoded anonymized image
        """
        try:
            # Decode image
            raw = base64.b64decode(frame_b64)
            nparr = np.frombuffer(raw, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return frame_b64
            
            # Convert regions to PrivacyRegion objects
            privacy_regions = []
            for region_dict in regions:
                try:
                    region = PrivacyRegion(
                        bbox=region_dict["bbox"],
                        region_type=RegionType(region_dict.get("type", "custom")),
                        blur_type=BlurType(region_dict.get("blur_type", "gaussian")),
                        intensity=region_dict.get("intensity", 1.0),
                        confidence=region_dict.get("confidence", 1.0)
                    )
                    privacy_regions.append(region)
                except (KeyError, ValueError) as e:
                    continue  # Skip invalid regions
            
            # Apply anonymization
            anonymized_image = self.apply_anonymization(image, privacy_regions, org_settings)
            
            # Encode back to base64
            _, buffer = cv2.imencode('.jpg', anonymized_image)
            return base64.b64encode(buffer).decode('utf-8')
            
        except Exception as e:
            # Return original on error
            return frame_b64

# Global middleware instance
_privacy_middleware = None

def get_privacy_middleware() -> PrivacyMiddleware:
    """Get singleton privacy middleware instance"""
    global _privacy_middleware
    if _privacy_middleware is None:
        _privacy_middleware = PrivacyMiddleware()
    return _privacy_middleware

def anonymize_frame(
    frame: np.ndarray, 
    detections: List[Dict[str, Any]], 
    org_settings: Optional[Dict[str, Any]] = None
) -> np.ndarray:
    """
    Convenience function to anonymize a frame with detected objects
    
    Args:
        frame: Input frame as numpy array
        detections: List of detection dictionaries with bbox, type, confidence
        org_settings: Organization privacy settings
        
    Returns:
        Anonymized frame
    """
    middleware = get_privacy_middleware()
    
    # Convert detections to privacy regions
    regions = []
    for detection in detections:
        try:
            # Map detection types to region types
            detection_type = detection.get("type", "custom").lower()
            region_type = RegionType.CUSTOM
            
            if "face" in detection_type:
                region_type = RegionType.FACE
            elif "license" in detection_type or "plate" in detection_type:
                region_type = RegionType.LICENSE_PLATE
            elif "person" in detection_type:
                region_type = RegionType.PERSON
            
            region = PrivacyRegion(
                bbox=detection["bbox"],
                region_type=region_type,
                confidence=detection.get("confidence", 1.0)
            )
            regions.append(region)
        except KeyError:
            continue
    
    return middleware.apply_anonymization(frame, regions, org_settings)