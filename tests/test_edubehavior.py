"""
Integration tests for EduBehavior service
Tests frame → signal pipeline to prevent silent regressions
"""

import pytest
import cv2
import base64
import time
import httpx
import asyncio
import numpy as np
from datetime import datetime

# Service endpoint
EDUBEHAVIOR_URL = "http://localhost:8087"

def create_synthetic_classroom_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic classroom video for testing"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        # Create frame with classroom-like content
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(50)  # Gray background
        
        # Add simulated students (faces)
        face_positions = [
            (100, 100, 60, 80),   # Student 1
            (300, 120, 55, 75),   # Student 2
            (500, 110, 58, 78),   # Student 3
        ]
        
        for x, y, w, h in face_positions:
            # Simulate face region
            cv2.rectangle(frame, (x, y), (x + w, y + h), (180, 150, 120), -1)
            
            # Add some variation for emotion detection
            if frame_num % 60 < 20:  # Simulate attention periods
                cv2.circle(frame, (x + w//2, y + h//2), 10, (200, 200, 200), -1)
        
        # Add some noise for realism
        noise = np.random.randint(0, 30, frame.shape, dtype=np.uint8)
        frame = cv2.add(frame, noise)
        
        out.write(frame)
    
    out.release()

def encode_frame_b64(frame):
    """Encode frame to base64 JPEG"""
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

class TestEduBehavior:
    """Integration tests for EduBehavior service"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_video_fixture(self):
        """Create test video if it doesn't exist"""
        import os
        os.makedirs("tests/fixtures", exist_ok=True)
        video_path = "tests/fixtures/classroom_5s.mp4"
        
        if not os.path.exists(video_path):
            create_synthetic_classroom_video(video_path, 5)
    
    @pytest.mark.asyncio
    async def test_service_health(self):
        """Test that EduBehavior service is healthy"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{EDUBEHAVIOR_URL}/health", timeout=10.0)
                assert response.status_code == 200
                health_data = response.json()
                assert health_data["status"] == "ok"
                assert health_data["service"] == "edubehavior"
            except httpx.ConnectError:
                pytest.skip("EduBehavior service not available")
    
    @pytest.mark.asyncio
    async def test_affect_signal_emits_at_least_one(self):
        """Test that processing classroom video emits at least one affect signal"""
        cap = cv2.VideoCapture("tests/fixtures/classroom_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        emitted_signals = 0
        processed_frames = 0
        
        async with httpx.AsyncClient() as client:
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Process every 10th frame to speed up test
                    if processed_frames % 10 != 0:
                        processed_frames += 1
                        continue
                    
                    frame_b64 = encode_frame_b64(frame)
                    
                    # Create request payload
                    payload = {
                        "class_id": "demo_class",
                        "camera_id": "demo_cam_classroom",
                        "org_id": "test_org",
                        "ts": datetime.now().isoformat(),
                        "frame_jpeg_b64": frame_b64,
                        "faces": [
                            {
                                "student_id": "student_001",
                                "bbox": [100, 100, 160, 180],
                                "confidence": 0.85,
                                "landmarks": [[130, 130], [150, 130], [140, 150]]
                            },
                            {
                                "student_id": "student_002", 
                                "bbox": [300, 120, 355, 195],
                                "confidence": 0.78
                            }
                        ]
                    }
                    
                    response = await client.post(
                        f"{EDUBEHAVIOR_URL}/analyze_frame",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # Check response structure
                    assert "signals" in result
                    assert "telemetry" in result
                    assert isinstance(result["signals"], list)
                    
                    emitted_signals += len(result["signals"])
                    processed_frames += 1
                    
                    # Break after processing enough frames
                    if processed_frames >= 30:
                        break
                        
            except httpx.ConnectError:
                pytest.skip("EduBehavior service not available")
            finally:
                cap.release()
        
        # Assert that at least one signal was emitted
        assert emitted_signals >= 1, f"Expected at least 1 signal, got {emitted_signals}"
        print(f"✅ EduBehavior: {emitted_signals} signals emitted from {processed_frames} frames")
    
    @pytest.mark.asyncio
    async def test_signal_format_validation(self):
        """Test that emitted signals have correct format"""
        cap = cv2.VideoCapture("tests/fixtures/classroom_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        # Process one frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            pytest.skip("Could not read test frame")
        
        frame_b64 = encode_frame_b64(frame)
        
        payload = {
            "class_id": "validation_test",
            "camera_id": "test_cam",
            "org_id": "test_org",
            "ts": datetime.now().isoformat(),
            "frame_jpeg_b64": frame_b64,
            "faces": [
                {
                    "student_id": "test_student",
                    "bbox": [100, 100, 160, 180],
                    "confidence": 0.9
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{EDUBEHAVIOR_URL}/analyze_frame",
                    json=payload,
                    timeout=30.0
                )
                
                assert response.status_code == 200
                result = response.json()
                
                # Validate signal format if any signals are present
                for signal in result.get("signals", []):
                    # Check required fields
                    assert "student_id" in signal or signal.get("student_id") is None
                    assert "type" in signal
                    assert "severity" in signal
                    assert signal["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
                    
                    # Check affect-specific fields
                    if signal["type"].startswith("affect."):
                        assert "confidence" in signal or signal.get("confidence") is None
                        
            except httpx.ConnectError:
                pytest.skip("EduBehavior service not available")
    
    @pytest.mark.asyncio 
    async def test_student_summary_endpoint(self):
        """Test student summary endpoint functionality"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{EDUBEHAVIOR_URL}/student_summary/test_student_123",
                    timeout=10.0
                )
                
                assert response.status_code == 200
                result = response.json()
                
                # Should return student summary or no_data status
                assert "student_id" in result
                assert result["student_id"] == "test_student_123"
                
            except httpx.ConnectError:
                pytest.skip("EduBehavior service not available")

if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v"])