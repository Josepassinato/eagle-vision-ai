"""
Universal blur and anonymization middleware
"""

import cv2
import numpy as np
import base64
import logging
from typing import Dict, Any, List, Tuple, Optional
from PIL import Image, ImageFilter
import asyncio
from io import BytesIO

logger = logging.getLogger(__name__)


class BlurConfig:
    """Blur configuration settings"""
    
    def __init__(
        self,
        face_blur_enabled: bool = False,
        license_plate_blur_enabled: bool = False,
        blur_strength: float = 0.8,
        detection_confidence: float = 0.5
    ):
        self.face_blur_enabled = face_blur_enabled
        self.license_plate_blur_enabled = license_plate_blur_enabled
        self.blur_strength = blur_strength
        self.detection_confidence = detection_confidence


class AnonymizationMiddleware:
    """Universal anonymization middleware for video frames and clips"""
    
    def __init__(self, face_detector=None, plate_detector=None):
        self.face_detector = face_detector
        self.plate_detector = plate_detector
    
    async def process_frame(
        self, 
        frame: np.ndarray, 
        config: BlurConfig,
        detections: Optional[List[Dict[str, Any]]] = None
    ) -> np.ndarray:
        """Process frame with anonymization"""
        
        if not config.face_blur_enabled and not config.license_plate_blur_enabled:
            return frame
        
        result_frame = frame.copy()
        
        # Get detections if not provided
        if detections is None:
            detections = await self._detect_objects(frame, config)
        
        # Apply face blur
        if config.face_blur_enabled:
            face_boxes = [d for d in detections if d.get('type') == 'face' 
                         and d.get('confidence', 0) >= config.detection_confidence]
            result_frame = self._apply_blur_to_regions(result_frame, face_boxes, config.blur_strength)
        
        # Apply license plate blur
        if config.license_plate_blur_enabled:
            plate_boxes = [d for d in detections if d.get('type') == 'license_plate' 
                          and d.get('confidence', 0) >= config.detection_confidence]
            result_frame = self._apply_blur_to_regions(result_frame, plate_boxes, config.blur_strength)
        
        return result_frame
    
    async def process_image_b64(self, image_b64: str, config: BlurConfig) -> str:
        """Process base64 image with anonymization"""
        
        # Decode image
        image_data = base64.b64decode(image_b64.split(',')[-1])
        image = Image.open(BytesIO(image_data))
        frame = np.array(image.convert('RGB'))
        
        # Process frame
        processed_frame = await self.process_frame(frame, config)
        
        # Encode back to base64
        processed_image = Image.fromarray(processed_frame)
        buffer = BytesIO()
        processed_image.save(buffer, format='JPEG', quality=85)
        processed_b64 = base64.b64encode(buffer.getvalue()).decode()
        
        return f"data:image/jpeg;base64,{processed_b64}"
    
    async def _detect_objects(self, frame: np.ndarray, config: BlurConfig) -> List[Dict[str, Any]]:
        """Detect faces and license plates in frame"""
        detections = []
        
        # Detect faces
        if config.face_blur_enabled and self.face_detector:
            try:
                face_results = await self._detect_faces(frame)
                detections.extend(face_results)
            except Exception as e:
                logger.error(f"Face detection error: {e}")
        
        # Detect license plates
        if config.license_plate_blur_enabled and self.plate_detector:
            try:
                plate_results = await self._detect_plates(frame)
                detections.extend(plate_results)
            except Exception as e:
                logger.error(f"License plate detection error: {e}")
        
        return detections
    
    async def _detect_faces(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces using face detector"""
        if not self.face_detector:
            return []
        
        # Convert frame to format expected by detector
        height, width = frame.shape[:2]
        _, buffer = cv2.imencode('.jpg', frame)
        image_b64 = base64.b64encode(buffer).decode()
        
        # Call face detection service
        try:
            # This would call your face detection service
            # Placeholder implementation
            detections = []
            
            # Example: If using OpenCV's built-in face detector
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = face_cascade.detectMultiScale(gray, 1.1, 4)
            
            for (x, y, w, h) in faces:
                detections.append({
                    'type': 'face',
                    'bbox': [x, y, x + w, y + h],
                    'confidence': 0.8  # Placeholder confidence
                })
            
            return detections
            
        except Exception as e:
            logger.error(f"Face detection failed: {e}")
            return []
    
    async def _detect_plates(self, frame: np.ndarray) -> List[Dict[str, Any]]:
        """Detect license plates using plate detector"""
        if not self.plate_detector:
            return []
        
        try:
            # Placeholder implementation
            # In real implementation, this would call your ALPR service
            detections = []
            
            # Example: Simple contour-based plate detection
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
            edges = cv2.Canny(gray, 50, 150)
            contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
            
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                aspect_ratio = w / h
                
                # Filter for plate-like rectangles
                if 2 < aspect_ratio < 6 and w > 100 and h > 20:
                    detections.append({
                        'type': 'license_plate',
                        'bbox': [x, y, x + w, y + h],
                        'confidence': 0.7  # Placeholder confidence
                    })
            
            return detections
            
        except Exception as e:
            logger.error(f"License plate detection failed: {e}")
            return []
    
    def _apply_blur_to_regions(
        self, 
        frame: np.ndarray, 
        regions: List[Dict[str, Any]], 
        blur_strength: float
    ) -> np.ndarray:
        """Apply blur to specified regions"""
        
        result = frame.copy()
        
        for region in regions:
            bbox = region.get('bbox')
            if not bbox or len(bbox) != 4:
                continue
            
            x1, y1, x2, y2 = map(int, bbox)
            
            # Ensure coordinates are within frame bounds
            height, width = frame.shape[:2]
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(x1 + 1, min(x2, width))
            y2 = max(y1 + 1, min(y2, height))
            
            # Extract region
            region_img = result[y1:y2, x1:x2]
            
            if region_img.size == 0:
                continue
            
            # Apply blur
            blur_kernel_size = max(3, int(min(region_img.shape[:2]) * blur_strength * 0.1))
            if blur_kernel_size % 2 == 0:
                blur_kernel_size += 1
            
            blurred_region = cv2.GaussianBlur(region_img, (blur_kernel_size, blur_kernel_size), 0)
            
            # Replace region in frame
            result[y1:y2, x1:x2] = blurred_region
        
        return result
    
    def apply_pixelation(
        self, 
        frame: np.ndarray, 
        regions: List[Dict[str, Any]], 
        pixel_size: int = 10
    ) -> np.ndarray:
        """Apply pixelation instead of blur"""
        
        result = frame.copy()
        
        for region in regions:
            bbox = region.get('bbox')
            if not bbox or len(bbox) != 4:
                continue
            
            x1, y1, x2, y2 = map(int, bbox)
            
            # Ensure coordinates are within frame bounds
            height, width = frame.shape[:2]
            x1 = max(0, min(x1, width - 1))
            y1 = max(0, min(y1, height - 1))
            x2 = max(x1 + 1, min(x2, width))
            y2 = max(y1 + 1, min(y2, height))
            
            # Extract region
            region_img = result[y1:y2, x1:x2]
            
            if region_img.size == 0:
                continue
            
            # Apply pixelation
            h, w = region_img.shape[:2]
            
            # Resize down
            small = cv2.resize(region_img, (w // pixel_size, h // pixel_size), interpolation=cv2.INTER_LINEAR)
            
            # Resize back up
            pixelated = cv2.resize(small, (w, h), interpolation=cv2.INTER_NEAREST)
            
            # Replace region in frame
            result[y1:y2, x1:x2] = pixelated
        
        return result


class ClipAnonymizer:
    """Anonymize video clips before storage"""
    
    def __init__(self, middleware: AnonymizationMiddleware):
        self.middleware = middleware
    
    async def anonymize_clip(
        self, 
        input_path: str, 
        output_path: str, 
        config: BlurConfig
    ) -> bool:
        """Anonymize entire video clip"""
        
        try:
            # Open video
            cap = cv2.VideoCapture(input_path)
            
            # Get video properties
            fps = int(cap.get(cv2.CAP_PROP_FPS))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            
            # Setup video writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
            
            frame_count = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Apply anonymization
                anonymized_frame = await self.middleware.process_frame(frame_rgb, config)
                
                # Convert back to BGR
                frame_bgr = cv2.cvtColor(anonymized_frame, cv2.COLOR_RGB2BGR)
                
                # Write frame
                out.write(frame_bgr)
                
                frame_count += 1
                
                # Log progress every 30 frames
                if frame_count % 30 == 0:
                    logger.debug(f"Processed {frame_count} frames")
            
            # Cleanup
            cap.release()
            out.release()
            
            logger.info(f"Anonymized clip saved: {output_path} ({frame_count} frames)")
            return True
            
        except Exception as e:
            logger.error(f"Clip anonymization failed: {e}")
            return False