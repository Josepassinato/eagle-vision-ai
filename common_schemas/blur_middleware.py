"""
Universal Blur/Anonymization Middleware
Feature-flag based anonymization for faces and license plates
"""

import cv2
import numpy as np
import base64
from typing import List, Tuple, Optional, Dict, Any
from dataclasses import dataclass
import logging
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

@dataclass
class BlurRegion:
    """Region to be blurred"""
    bbox: Tuple[int, int, int, int]  # x1, y1, x2, y2
    blur_type: str  # 'face', 'license_plate', 'custom'
    intensity: float = 0.8  # 0.0 = no blur, 1.0 = maximum blur

class BlurStrategy(ABC):
    """Abstract blur strategy"""
    
    @abstractmethod
    def apply_blur(self, image: np.ndarray, region: BlurRegion) -> np.ndarray:
        pass

class GaussianBlurStrategy(BlurStrategy):
    """Gaussian blur implementation"""
    
    def apply_blur(self, image: np.ndarray, region: BlurRegion) -> np.ndarray:
        x1, y1, x2, y2 = region.bbox
        
        # Extract region
        roi = image[y1:y2, x1:x2].copy()
        
        if roi.size == 0:
            return image
        
        # Calculate blur kernel size based on intensity
        kernel_size = max(3, int(region.intensity * 51))  # 3 to 51
        if kernel_size % 2 == 0:
            kernel_size += 1  # Ensure odd kernel size
        
        # Apply Gaussian blur
        blurred_roi = cv2.GaussianBlur(roi, (kernel_size, kernel_size), 0)
        
        # Replace region in original image
        result = image.copy()
        result[y1:y2, x1:x2] = blurred_roi
        
        return result

class PixelationStrategy(BlurStrategy):
    """Pixelation blur implementation"""
    
    def apply_blur(self, image: np.ndarray, region: BlurRegion) -> np.ndarray:
        x1, y1, x2, y2 = region.bbox
        
        # Extract region
        roi = image[y1:y2, x1:x2].copy()
        
        if roi.size == 0:
            return image
        
        # Calculate pixelation factor
        pixel_size = max(2, int(region.intensity * 20))  # 2 to 20 pixels
        
        # Downscale and upscale for pixelation effect
        height, width = roi.shape[:2]
        small_height = max(1, height // pixel_size)
        small_width = max(1, width // pixel_size)
        
        # Resize down and back up
        small = cv2.resize(roi, (small_width, small_height), interpolation=cv2.INTER_LINEAR)
        pixelated_roi = cv2.resize(small, (width, height), interpolation=cv2.INTER_NEAREST)
        
        # Replace region in original image
        result = image.copy()
        result[y1:y2, x1:x2] = pixelated_roi
        
        return result

class BlackBoxStrategy(BlurStrategy):
    """Black box anonymization"""
    
    def apply_blur(self, image: np.ndarray, region: BlurRegion) -> np.ndarray:
        x1, y1, x2, y2 = region.bbox
        
        result = image.copy()
        
        # Apply black box with optional transparency
        alpha = 1.0 - region.intensity  # Higher intensity = more opaque
        if alpha > 0:
            overlay = result[y1:y2, x1:x2].copy()
            overlay.fill(0)  # Black
            result[y1:y2, x1:x2] = cv2.addWeighted(
                result[y1:y2, x1:x2], alpha, overlay, 1 - alpha, 0
            )
        else:
            result[y1:y2, x1:x2] = 0  # Full black
        
        return result

class BlurMiddleware:
    """Universal anonymization middleware"""
    
    def __init__(self):
        self.strategies = {
            'gaussian': GaussianBlurStrategy(),
            'pixelation': PixelationStrategy(),
            'blackbox': BlackBoxStrategy()
        }
        
        # Default blur settings per type
        self.default_settings = {
            'face': {
                'strategy': 'gaussian',
                'intensity': 0.8,
                'enabled': True
            },
            'license_plate': {
                'strategy': 'pixelation', 
                'intensity': 0.9,
                'enabled': True
            },
            'custom': {
                'strategy': 'gaussian',
                'intensity': 0.7,
                'enabled': True
            }
        }
    
    def should_blur(self, org_settings: Dict[str, Any], blur_type: str) -> bool:
        """Check if blurring is required for organization and type"""
        
        # Check global blur requirement
        if org_settings.get('blur_required', False):
            return True
        
        # Check type-specific settings
        type_key = f"{blur_type}_blur_enabled"
        return org_settings.get(type_key, False)
    
    def get_blur_settings(self, org_settings: Dict[str, Any], blur_type: str) -> Dict[str, Any]:
        """Get blur settings for organization and type"""
        
        # Start with defaults
        settings = self.default_settings.get(blur_type, self.default_settings['custom']).copy()
        
        # Override with org-specific settings
        org_key = f"{blur_type}_blur_settings"
        if org_key in org_settings:
            settings.update(org_settings[org_key])
        
        return settings
    
    def apply_anonymization(self, 
                          image: np.ndarray,
                          blur_regions: List[BlurRegion],
                          org_settings: Dict[str, Any]) -> np.ndarray:
        """
        Apply anonymization to image based on org settings
        
        Args:
            image: Input image
            blur_regions: Regions to potentially blur
            org_settings: Organization privacy settings
            
        Returns:
            Anonymized image
        """
        
        result = image.copy()
        
        for region in blur_regions:
            # Check if this type should be blurred
            if not self.should_blur(org_settings, region.blur_type):
                continue
            
            # Get blur settings
            settings = self.get_blur_settings(org_settings, region.blur_type)
            
            if not settings.get('enabled', True):
                continue
            
            # Update region with org-specific intensity
            blur_region = BlurRegion(
                bbox=region.bbox,
                blur_type=region.blur_type,
                intensity=settings.get('intensity', region.intensity)
            )
            
            # Apply blur strategy
            strategy_name = settings.get('strategy', 'gaussian')
            strategy = self.strategies.get(strategy_name, self.strategies['gaussian'])
            
            try:
                result = strategy.apply_blur(result, blur_region)
            except Exception as e:
                logger.error(f"Failed to apply {strategy_name} blur to {region.blur_type}: {e}")
                continue
        
        return result
    
    def process_frame_b64(self, 
                         frame_b64: str,
                         blur_regions: List[Dict[str, Any]],
                         org_settings: Dict[str, Any]) -> str:
        """
        Process base64 encoded frame
        
        Args:
            frame_b64: Base64 encoded image
            blur_regions: List of region dicts with bbox, type, intensity
            org_settings: Organization privacy settings
            
        Returns:
            Base64 encoded anonymized image
        """
        
        try:
            # Decode image
            img_data = base64.b64decode(frame_b64)
            nparr = np.frombuffer(img_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                logger.error("Failed to decode base64 image")
                return frame_b64
            
            # Convert regions to BlurRegion objects
            regions = []
            for region_dict in blur_regions:
                region = BlurRegion(
                    bbox=tuple(region_dict['bbox']),
                    blur_type=region_dict.get('type', 'custom'),
                    intensity=region_dict.get('intensity', 0.8)
                )
                regions.append(region)
            
            # Apply anonymization
            anonymized = self.apply_anonymization(image, regions, org_settings)
            
            # Encode back to base64
            _, buffer = cv2.imencode('.jpg', anonymized, [cv2.IMWRITE_JPEG_QUALITY, 85])
            anonymized_b64 = base64.b64encode(buffer).decode('utf-8')
            
            return anonymized_b64
            
        except Exception as e:
            logger.error(f"Frame anonymization failed: {e}")
            return frame_b64  # Return original on error
    
    def add_custom_strategy(self, name: str, strategy: BlurStrategy):
        """Add custom blur strategy"""
        self.strategies[name] = strategy

# Singleton instance
_blur_middleware: Optional[BlurMiddleware] = None

def get_blur_middleware() -> BlurMiddleware:
    """Get singleton blur middleware instance"""
    global _blur_middleware
    if _blur_middleware is None:
        _blur_middleware = BlurMiddleware()
    return _blur_middleware

def anonymize_frame(frame: np.ndarray, 
                   detections: List[Dict[str, Any]], 
                   org_settings: Dict[str, Any]) -> np.ndarray:
    """
    Convenience function to anonymize frame with detections
    
    Args:
        frame: Input frame
        detections: Detection results with bbox and class info
        org_settings: Organization privacy settings
        
    Returns:
        Anonymized frame
    """
    
    middleware = get_blur_middleware()
    
    # Convert detections to blur regions
    blur_regions = []
    for detection in detections:
        bbox = detection.get('bbox')
        class_name = detection.get('class', detection.get('class_name', '')).lower()
        
        if not bbox:
            continue
        
        # Map detection classes to blur types
        blur_type = 'custom'
        if 'face' in class_name or 'person' in class_name:
            blur_type = 'face'
        elif 'license' in class_name or 'plate' in class_name:
            blur_type = 'license_plate'
        
        region = BlurRegion(
            bbox=tuple(bbox),
            blur_type=blur_type,
            intensity=0.8
        )
        blur_regions.append(region)
    
    return middleware.apply_anonymization(frame, blur_regions, org_settings)