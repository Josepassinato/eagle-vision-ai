"""
Universal blur middleware for privacy compliance
Anonymizes faces and license plates based on organizational policies
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

def blur_regions(
    frame_bgr: np.ndarray, 
    rois: List[Tuple[int, int, int, int]], 
    blur_kernel: int = 31,
    blur_type: str = "gaussian"
) -> np.ndarray:
    """
    Apply blur to specified regions in a frame
    
    Args:
        frame_bgr: Input frame in BGR format
        rois: List of regions as (x, y, width, height) tuples
        blur_kernel: Blur kernel size (must be odd)
        blur_type: Type of blur ('gaussian', 'motion', 'median')
    
    Returns:
        Frame with blurred regions
    """
    if not rois:
        return frame_bgr
    
    # Ensure kernel size is odd
    if blur_kernel % 2 == 0:
        blur_kernel += 1
    
    out = frame_bgr.copy()
    
    for x, y, w, h in rois:
        # Validate ROI bounds
        if x < 0 or y < 0 or x + w > frame_bgr.shape[1] or y + h > frame_bgr.shape[0]:
            logger.warning(f"ROI out of bounds: ({x},{y},{w},{h}) for frame {frame_bgr.shape}")
            continue
        
        if w <= 0 or h <= 0:
            continue
        
        # Extract region
        roi = out[y:y+h, x:x+w]
        
        # Apply blur based on type
        if blur_type == "gaussian":
            blurred_roi = cv2.GaussianBlur(roi, (blur_kernel, blur_kernel), 0)
        elif blur_type == "motion":
            # Motion blur kernel
            kernel = np.zeros((blur_kernel, blur_kernel))
            kernel[int((blur_kernel-1)/2), :] = np.ones(blur_kernel)
            kernel = kernel / blur_kernel
            blurred_roi = cv2.filter2D(roi, -1, kernel)
        elif blur_type == "median":
            blurred_roi = cv2.medianBlur(roi, blur_kernel)
        else:
            # Default to Gaussian
            blurred_roi = cv2.GaussianBlur(roi, (blur_kernel, blur_kernel), 0)
        
        # Replace region in output
        out[y:y+h, x:x+w] = blurred_roi
    
    return out

def pixelate_regions(
    frame_bgr: np.ndarray,
    rois: List[Tuple[int, int, int, int]],
    pixel_size: int = 10
) -> np.ndarray:
    """
    Apply pixelation to specified regions
    
    Args:
        frame_bgr: Input frame in BGR format
        rois: List of regions as (x, y, width, height) tuples
        pixel_size: Size of pixelation blocks
    
    Returns:
        Frame with pixelated regions
    """
    if not rois:
        return frame_bgr
    
    out = frame_bgr.copy()
    
    for x, y, w, h in rois:
        # Validate ROI bounds
        if x < 0 or y < 0 or x + w > frame_bgr.shape[1] or y + h > frame_bgr.shape[0]:
            continue
        
        if w <= 0 or h <= 0:
            continue
        
        # Extract region
        roi = out[y:y+h, x:x+w]
        
        # Calculate pixelated dimensions
        temp_h = max(1, h // pixel_size)
        temp_w = max(1, w // pixel_size)
        
        # Downscale
        temp_roi = cv2.resize(roi, (temp_w, temp_h), interpolation=cv2.INTER_LINEAR)
        
        # Upscale back with nearest neighbor for pixelated effect
        pixelated_roi = cv2.resize(temp_roi, (w, h), interpolation=cv2.INTER_NEAREST)
        
        # Replace region in output
        out[y:y+h, x:x+w] = pixelated_roi
    
    return out

def black_box_regions(
    frame_bgr: np.ndarray,
    rois: List[Tuple[int, int, int, int]],
    color: Tuple[int, int, int] = (0, 0, 0)
) -> np.ndarray:
    """
    Apply black box censoring to specified regions
    
    Args:
        frame_bgr: Input frame in BGR format
        rois: List of regions as (x, y, width, height) tuples  
        color: BGR color for the box
    
    Returns:
        Frame with black box regions
    """
    if not rois:
        return frame_bgr
    
    out = frame_bgr.copy()
    
    for x, y, w, h in rois:
        # Validate ROI bounds
        if x < 0 or y < 0 or x + w > frame_bgr.shape[1] or y + h > frame_bgr.shape[0]:
            continue
        
        if w <= 0 or h <= 0:
            continue
        
        # Draw filled rectangle
        cv2.rectangle(out, (x, y), (x + w, y + h), color, -1)
    
    return out

class PrivacyFilter:
    """
    Universal privacy filter for video frames
    Applies anonymization based on organizational policies
    """
    
    def __init__(self):
        self.default_policies = {
            "blur_enabled": False,
            "blur_faces": True,
            "blur_plates": True,
            "blur_method": "gaussian",  # gaussian, pixelate, black_box
            "blur_kernel": 31,
            "pixel_size": 10,
            "retention_days": 30
        }
    
    def apply_privacy_filter(
        self,
        frame_bgr: np.ndarray,
        face_rois: List[Tuple[int, int, int, int]] = None,
        plate_rois: List[Tuple[int, int, int, int]] = None,
        org_policies: Dict[str, Any] = None
    ) -> np.ndarray:
        """
        Apply privacy filtering based on organizational policies
        
        Args:
            frame_bgr: Input frame in BGR format
            face_rois: List of face regions as (x, y, width, height)
            plate_rois: List of license plate regions as (x, y, width, height)
            org_policies: Organization-specific privacy policies
        
        Returns:
            Privacy-filtered frame
        """
        # Merge with default policies
        policies = self.default_policies.copy()
        if org_policies:
            policies.update(org_policies)
        
        # Check if blur is enabled
        if not policies.get("blur_enabled", False):
            return frame_bgr
        
        # Collect ROIs to blur
        blur_rois = []
        
        if policies.get("blur_faces", True) and face_rois:
            blur_rois.extend(face_rois)
        
        if policies.get("blur_plates", True) and plate_rois:
            blur_rois.extend(plate_rois)
        
        if not blur_rois:
            return frame_bgr
        
        # Apply anonymization based on method
        method = policies.get("blur_method", "gaussian")
        
        if method == "gaussian":
            return blur_regions(frame_bgr, blur_rois, policies.get("blur_kernel", 31))
        elif method == "pixelate":
            return pixelate_regions(frame_bgr, blur_rois, policies.get("pixel_size", 10))
        elif method == "black_box":
            return black_box_regions(frame_bgr, blur_rois)
        else:
            # Default to Gaussian blur
            return blur_regions(frame_bgr, blur_rois, policies.get("blur_kernel", 31))

# Global filter instance
_privacy_filter = None

def get_privacy_filter() -> PrivacyFilter:
    """Get singleton privacy filter instance"""
    global _privacy_filter
    if _privacy_filter is None:
        _privacy_filter = PrivacyFilter()
    return _privacy_filter

def apply_privacy_filter(
    frame_bgr: np.ndarray,
    face_rois: List[Tuple[int, int, int, int]] = None,
    plate_rois: List[Tuple[int, int, int, int]] = None,
    org_policies: Dict[str, Any] = None
) -> np.ndarray:
    """
    Convenience function to apply privacy filtering
    
    Usage:
        # Basic usage
        filtered_frame = apply_privacy_filter(frame, face_rois, plate_rois, org_policies)
        
        # With organization policies
        policies = {"blur_enabled": True, "blur_method": "pixelate"}
        filtered_frame = apply_privacy_filter(frame, faces, plates, policies)
    """
    filter_instance = get_privacy_filter()
    return filter_instance.apply_privacy_filter(frame_bgr, face_rois, plate_rois, org_policies)

# Detection format helpers
def bboxes_to_rois(bboxes: List[List[float]]) -> List[Tuple[int, int, int, int]]:
    """
    Convert bounding boxes [x1,y1,x2,y2] to ROI format (x,y,w,h)
    """
    rois = []
    for bbox in bboxes:
        if len(bbox) >= 4:
            x1, y1, x2, y2 = bbox[:4]
            x, y = int(x1), int(y1)
            w, h = int(x2 - x1), int(y2 - y1)
            if w > 0 and h > 0:
                rois.append((x, y, w, h))
    return rois

def detections_to_rois(detections: List[Dict[str, Any]], detection_type: str = "face") -> List[Tuple[int, int, int, int]]:
    """
    Extract ROIs from detection results
    
    Args:
        detections: List of detection dictionaries with 'bbox' and 'type' fields
        detection_type: Type to filter for ('face', 'license_plate', etc.)
    
    Returns:
        List of ROI tuples (x, y, w, h)
    """
    rois = []
    for det in detections:
        if det.get('type', '').lower() == detection_type.lower():
            bbox = det.get('bbox', [])
            if len(bbox) >= 4:
                x1, y1, x2, y2 = bbox[:4]
                x, y = int(x1), int(y1)
                w, h = int(x2 - x1), int(y2 - y1)
                if w > 0 and h > 0:
                    rois.append((x, y, w, h))
    return rois