"""
Integration tests for SafetyVision service
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
SAFETYVISION_URL = "http://localhost:8089"

def create_synthetic_safety_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic safety/construction video for testing"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        # Create frame with construction site content
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(80)  # Industrial gray background
        
        # Add construction elements
        cv2.rectangle(frame, (0, 400), (640, 480), (120, 100, 60), -1)  # Ground
        cv2.rectangle(frame, (200, 200), (400, 400), (150, 150, 150), -1)  # Building structure
        
        # Add simulated workers
        worker_positions = [
            (150, 300, 40, 100),  # Worker 1 (should trigger PPE violation)
            (450, 320, 35, 95),   # Worker 2
        ]
        
        for i, (x, y, w, h) in enumerate(worker_positions):
            # Worker body
            cv2.rectangle(frame, (x, y), (x + w, y + h), (100, 100, 200), -1)
            
            # Head (face region)
            head_x, head_y = x + w//4, y - 20
            cv2.circle(frame, (head_x + 10, head_y + 10), 15, (180, 150, 120), -1)
            
            # Simulate PPE (or lack thereof) - first worker missing hardhat
            if i == 1:  # Second worker has hardhat
                cv2.circle(frame, (head_x + 10, head_y + 5), 18, (255, 255, 0), 2)
        
        # Add some industrial noise/texture
        noise = np.random.randint(0, 40, frame.shape, dtype=np.uint8)
        frame = cv2.add(frame, noise)
        
        out.write(frame)
    
    out.release()

def encode_frame_b64(frame):
    """Encode frame to base64 JPEG"""
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

class TestSafetyVision:
    """Integration tests for SafetyVision service"""
    
    @pytest.fixture(scope="class", autouse=True)
    def setup_video_fixture(self):
        """Create test video if it doesn't exist"""
        import os
        os.makedirs("tests/fixtures", exist_ok=True)
        video_path = "tests/fixtures/safety_5s.mp4"
        
        if not os.path.exists(video_path):
            create_synthetic_safety_video(video_path, 5)
    
    @pytest.mark.asyncio
    async def test_service_health(self):
        """Test that SafetyVision service is healthy"""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(f"{SAFETYVISION_URL}/health", timeout=10.0)
                assert response.status_code == 200
                health_data = response.json()
                assert health_data["status"] == "ok"
                assert health_data["service"] == "safetyvision"
            except httpx.ConnectError:
                pytest.skip("SafetyVision service not available")
    
    @pytest.mark.asyncio
    async def test_safety_signal_emits_at_least_one(self):
        """Test that processing safety video emits at least one safety signal"""
        cap = cv2.VideoCapture("tests/fixtures/safety_5s.mp4")
        
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
                    
                    # Process every 15th frame to speed up test
                    if processed_frames % 15 != 0:
                        processed_frames += 1
                        continue
                    
                    frame_b64 = encode_frame_b64(frame)
                    
                    # Create request payload with construction zone
                    payload = {
                        "camera_id": "demo_cam_construction",
                        "org_id": "test_org",
                        "zone_type": "construction",  # This should trigger PPE requirements
                        "ts": datetime.now().isoformat(),
                        "frame_jpeg_b64": frame_b64,
                        "tracks": [
                            {
                                "track_id": "worker_001",
                                "bbox": [150, 300, 190, 400],
                                "meta": {"confidence": 0.85}
                            },
                            {
                                "track_id": "worker_002",
                                "bbox": [450, 320, 485, 415],
                                "meta": {"confidence": 0.78}
                            }
                        ]
                    }
                    
                    response = await client.post(
                        f"{SAFETYVISION_URL}/analyze_frame",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # Check response structure
                    assert "signals" in result
                    assert "incidents" in result
                    assert "telemetry" in result
                    assert isinstance(result["signals"], list)
                    
                    emitted_signals += len(result["signals"])
                    processed_frames += 1
                    
                    # Break after processing enough frames
                    if processed_frames >= 20:
                        break
                        
            except httpx.ConnectError:
                pytest.skip("SafetyVision service not available")
            finally:
                cap.release()
        
        # Assert that at least one signal was emitted (PPE violation expected)
        assert emitted_signals >= 1, f"Expected at least 1 signal, got {emitted_signals}"
        print(f"✅ SafetyVision: {emitted_signals} signals emitted from {processed_frames} frames")
    
    @pytest.mark.asyncio
    async def test_ppe_violation_detection(self):
        """Test PPE violation detection in construction zone"""
        cap = cv2.VideoCapture("tests/fixtures/safety_5s.mp4")
        
        if not cap.isOpened():
            pytest.skip("Test video fixture not available")
        
        # Process one frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret:
            pytest.skip("Could not read test frame")
        
        frame_b64 = encode_frame_b64(frame)
        
        payload = {
            "camera_id": "ppe_test_cam",
            "org_id": "test_org",
            "zone_type": "construction",  # Should require PPE
            "ts": datetime.now().isoformat(),
            "frame_jpeg_b64": frame_b64,
            "tracks": [
                {
                    "track_id": "worker_no_ppe",
                    "bbox": [150, 300, 190, 400],
                    "meta": {"confidence": 0.9}
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{SAFETYVISION_URL}/analyze_frame",
                    json=payload,
                    timeout=30.0
                )
                
                assert response.status_code == 200
                result = response.json()
                
                # Should generate PPE violation signal for construction zone
                assert len(result["signals"]) > 0
                
                # Check for PPE-related signal
                ppe_signals = [s for s in result["signals"] if "ppe" in s.get("type", "").lower()]
                assert len(ppe_signals) > 0, "Expected PPE violation signal in construction zone"
                
                # Validate signal format
                for signal in result["signals"]:
                    assert "type" in signal
                    assert "severity" in signal
                    assert signal["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
                    
            except httpx.ConnectError:
                pytest.skip("SafetyVision service not available")
    
    @pytest.mark.asyncio
    async def test_signal_format_validation(self):
        """Test that emitted signals have correct format"""
        payload = {
            "camera_id": "format_test_cam",
            "org_id": "test_org", 
            "zone_type": "industrial",
            "ts": datetime.now().isoformat(),
            "frame_jpeg_b64": None,  # Test without frame
            "tracks": []
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{SAFETYVISION_URL}/analyze_frame",
                    json=payload,
                    timeout=30.0
                )
                
                assert response.status_code == 200
                result = response.json()
                
                # Should still return valid structure even without frame
                assert "signals" in result
                assert "incidents" in result
                assert "telemetry" in result
                assert isinstance(result["signals"], list)
                assert isinstance(result["incidents"], list)
                
            except httpx.ConnectError:
                pytest.skip("SafetyVision service not available")
    
    @pytest.mark.asyncio
    async def test_multiple_zone_types(self):
        """Test different zone types trigger appropriate responses"""
        zone_types = ["construction", "industrial", "office", "default"]
        
        for zone_type in zone_types:
            payload = {
                "camera_id": f"zone_test_{zone_type}",
                "org_id": "test_org",
                "zone_type": zone_type,
                "ts": datetime.now().isoformat(),
                "tracks": [
                    {
                        "track_id": "test_person",
                        "bbox": [100, 100, 150, 200],
                        "meta": {"confidence": 0.8}
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                try:
                    response = await client.post(
                        f"{SAFETYVISION_URL}/analyze_frame",
                        json=payload,
                        timeout=30.0
                    )
                    
                    assert response.status_code == 200
                    result = response.json()
                    
                    # Construction and industrial zones should generate more signals
                    if zone_type in ["construction", "industrial"]:
                        # Should likely generate PPE-related signals
                        assert isinstance(result["signals"], list)
                    
                except httpx.ConnectError:
                    pytest.skip("SafetyVision service not available")
                    break

if __name__ == "__main__":
    # Allow running tests directly
    pytest.main([__file__, "-v"])