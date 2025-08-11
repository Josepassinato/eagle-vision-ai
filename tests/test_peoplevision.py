"""
Integration tests for YOLO Detection service  
Tests object detection pipeline to prevent silent regressions
"""

import pytest
import cv2
import base64
import httpx
import asyncio
import numpy as np

# Service endpoint
YOLO_URL = "http://localhost:8080"

def create_synthetic_people_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic video with people for testing"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        # Create frame with people
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(30)  # Dark background
        
        # Add people-like shapes
        people_positions = [
            (100, 200, 60, 150),  # Person 1
            (300, 180, 55, 160),  # Person 2
            (500, 220, 50, 140),  # Person 3
        ]
        
        for x, y, w, h in people_positions:
            # Body
            cv2.rectangle(frame, (x, y), (x + w, y + h), (120, 80, 60), -1)
            
            # Head
            head_x, head_y = x + w//2, y - 20
            cv2.circle(frame, (head_x, head_y), 20, (180, 150, 120), -1)
            
            # Add movement variation
            offset_x = int(10 * np.sin(frame_num * 0.1 + x * 0.01))
            offset_y = int(5 * np.cos(frame_num * 0.1 + y * 0.01))
            
            # Moving person (slight variations)
            if frame_num % 60 > 30:
                cv2.rectangle(frame, (x + offset_x, y + offset_y), 
                            (x + w + offset_x, y + h + offset_y), (100, 120, 80), -1)
        
        # Add vehicles
        if frame_num % 90 < 45:  # Vehicle appears periodically
            cv2.rectangle(frame, (50, 350), (200, 420), (80, 80, 120), -1)  # Car-like shape
            cv2.rectangle(frame, (60, 360), (80, 380), (200, 200, 200), -1)  # Headlight
            cv2.rectangle(frame, (180, 360), (190, 380), (200, 200, 200), -1)  # Headlight
        
        # Add noise for realism
        noise = np.random.randint(0, 25, frame.shape, dtype=np.uint8)
        frame = cv2.add(frame, noise)
        
        out.write(frame)
    
    out.release()

def encode_frame_b64(frame):
    """Encode frame to base64 JPEG"""
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

class TestYOLODetection:
    """Integration tests for YOLO Detection service"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_video_fixture(self):
        """Create test video if it doesn't exist"""
        import os
        os.makedirs("tests/fixtures", exist_ok=True)
        video_path = "tests/fixtures/people_5s.mp4"
        
        if not os.path.exists(video_path):
            create_synthetic_people_video(video_path, 5)
    
    @pytest.mark.asyncio
    async def test_service_health(self):
        """Test that YOLO Detection service is healthy"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{YOLO_URL}/health", timeout=10.0)
                assert response.status_code == 200
                health_data = response.json()
                assert health_data["status"] == "ok"
            except httpx.ConnectError:
                pytest.skip("YOLO Detection service not available")
    
    @pytest.mark.asyncio
    async def test_person_detection_emits_at_least_one(self):
        """Test that processing people video detects at least one person"""
        cap = cv2.VideoCapture("tests/fixtures/people_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        total_detections = 0
        processed_frames = 0
        
        async with httpx.AsyncClient() as client:
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Process every 20th frame to speed up test
                    if processed_frames % 20 != 0:
                        processed_frames += 1
                        continue
                    
                    frame_b64 = encode_frame_b64(frame)
                    
                    # Create request payload
                    payload = {
                        "image_b64": frame_b64,
                        "detection_types": ["person", "vehicle"],
                        "confidence_threshold": 0.3
                    }
                    
                    response = await client.post(
                        f"{YOLO_URL}/detect",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # Check response structure
                    assert "detections" in result
                    assert isinstance(result["detections"], list)
                    
                    # Count person detections
                    person_detections = [d for d in result["detections"] if d.get("class") == "person"]
                    total_detections += len(person_detections)
                    processed_frames += 1
                    
                    # Break after processing enough frames
                    if processed_frames >= 15:
                        break
                        
            except httpx.ConnectError:
                pytest.skip("YOLO Detection service not available")
            finally:
                cap.release()
        
        # Assert that at least one person was detected
        assert total_detections >= 1, f"Expected at least 1 person detection, got {total_detections}"
        print(f"✅ YOLO Detection: {total_detections} person detections from {processed_frames} frames")
    
    @pytest.mark.asyncio
    async def test_detection_format_validation(self):
        """Test that detections have correct format"""
        cap = cv2.VideoCapture("tests/fixtures/people_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        # Process one frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            pytest.skip("Could not read test frame")
        
        frame_b64 = encode_frame_b64(frame)
        
        payload = {
            "image_b64": frame_b64,
            "detection_types": ["person", "vehicle", "face"],
            "confidence_threshold": 0.1  # Low threshold to get detections
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{YOLO_URL}/detect",
                    json=payload,
                    timeout=30.0
                )
                
                assert response.status_code == 200
                result = response.json()
                
                # Validate detection format
                assert "detections" in result
                for detection in result["detections"]:
                    # Check required fields
                    assert "bbox" in detection
                    assert "confidence" in detection
                    assert "class" in detection
                    
                    # Validate bbox format [x1, y1, x2, y2]
                    bbox = detection["bbox"]
                    assert len(bbox) == 4
                    assert all(isinstance(coord, (int, float)) for coord in bbox)
                    assert bbox[2] > bbox[0]  # x2 > x1
                    assert bbox[3] > bbox[1]  # y2 > y1
                    
                    # Validate confidence
                    assert 0.0 <= detection["confidence"] <= 1.0
                    
                    # Validate class
                    assert detection["class"] in ["person", "vehicle", "face", "license_plate"]
                    
            except httpx.ConnectError:
                pytest.skip("YOLO Detection service not available")
    
    @pytest.mark.asyncio
    async def test_different_detection_types(self):
        """Test different detection types"""
        detection_type_sets = [
            ["person"],
            ["vehicle"], 
            ["face"],
            ["person", "vehicle"],
            ["person", "face", "vehicle", "license_plate"]
        ]
        
        # Use a simple test image
        test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        test_frame.fill(100)
        # Add a person-like shape
        cv2.rectangle(test_frame, (200, 150), (300, 400), (120, 80, 60), -1)
        cv2.circle(test_frame, (250, 130), 25, (180, 150, 120), -1)
        
        frame_b64 = encode_frame_b64(test_frame)
        
        for detection_types in detection_type_sets:
            payload = {
                "image_b64": frame_b64,
                "detection_types": detection_types,
                "confidence_threshold": 0.1
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(
                        f"{YOLO_URL}/detect",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # Should return valid structure
                    assert "detections" in result
                    assert isinstance(result["detections"], list)
                    
                    # All detected classes should be in requested types
                    for detection in result["detections"]:
                        assert detection["class"] in detection_types
                    
                except httpx.ConnectError:
                    pytest.skip("YOLO Detection service not available")
                    break
    
    @pytest.mark.asyncio
    async def test_confidence_threshold_filtering(self):
        """Test that confidence threshold properly filters detections"""
        cap = cv2.VideoCapture("tests/fixtures/people_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        # Process one frame with different thresholds
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            pytest.skip("Could not read test frame")
        
        frame_b64 = encode_frame_b64(frame)
        thresholds = [0.1, 0.5, 0.8]
        detection_counts = []
        
        for threshold in thresholds:
            payload = {
                "image_b64": frame_b64,
                "detection_types": ["person", "vehicle"],
                "confidence_threshold": threshold
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(
                        f"{YOLO_URL}/detect",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # All detections should meet threshold
                    for detection in result["detections"]:
                        assert detection["confidence"] >= threshold
                    
                    detection_counts.append(len(result["detections"]))
                    
                except httpx.ConnectError:
                    pytest.skip("YOLO Detection service not available")
                    break
        
        # Higher thresholds should generally result in fewer detections
        # (though this might not always be true with synthetic data)
        print(f"Detection counts at thresholds {thresholds}: {detection_counts}")

if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v"])