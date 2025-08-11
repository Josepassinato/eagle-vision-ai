"""
Full integration tests for AI Vision Platform
Tests complete frame processing pipeline from input to signal generation
"""

import pytest
import httpx
import asyncio
import base64
import cv2
import numpy as np
from datetime import datetime
import json

# Test configuration
SERVICES = {
    "yolo-detection": "http://localhost:8080",
    "safetyvision": "http://localhost:8089", 
    "edubehavior": "http://localhost:8087",
    "antitheft": "http://localhost:8086",
    "fusion": "http://localhost:8084"
}

def create_test_frame(width=640, height=480, add_objects=True):
    """Create a synthetic test frame with detectable objects"""
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame.fill(50)  # Gray background
    
    if add_objects:
        # Add a simulated person (rectangle)
        cv2.rectangle(frame, (100, 100), (200, 300), (255, 255, 255), -1)
        
        # Add a simulated face region
        cv2.rectangle(frame, (120, 120), (180, 180), (200, 180, 150), -1)
        
        # Add some noise for realism
        noise = np.random.randint(0, 50, frame.shape, dtype=np.uint8)
        frame = cv2.add(frame, noise)
    
    return frame

def encode_frame(frame):
    """Encode frame to base64 JPEG"""
    _, buffer = cv2.imencode('.jpg', frame)
    return base64.b64encode(buffer).decode('utf-8')

class TestFullPipeline:
    """Integration tests for complete AI pipeline"""
    
    @pytest.mark.asyncio
    async def test_service_health_all(self):
        """Test that all services are healthy"""
        async with httpx.AsyncClient() as client:
            for service_name, url in SERVICES.items():
                try:
                    response = await client.get(f"{url}/health", timeout=10.0)
                    assert response.status_code == 200
                    health_data = response.json()
                    assert health_data["status"] == "ok"
                    print(f"✅ {service_name}: {health_data}")
                except Exception as e:
                    pytest.fail(f"❌ {service_name} health check failed: {e}")
    
    @pytest.mark.asyncio
    async def test_yolo_detection_pipeline(self):
        """Test YOLO detection service with synthetic frame"""
        test_frame = create_test_frame()
        frame_b64 = encode_frame(test_frame)
        
        async with httpx.AsyncClient() as client:
            payload = {
                "image_b64": frame_b64,
                "detection_types": ["person", "face"],
                "confidence_threshold": 0.3
            }
            
            response = await client.post(
                f"{SERVICES['yolo-detection']}/detect",
                json=payload,
                timeout=30.0
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Should detect something in our synthetic frame
            assert "detections" in result
            print(f"YOLO detections: {len(result['detections'])}")
    
    @pytest.mark.asyncio
    async def test_safetyvision_pipeline(self):
        """Test SafetyVision service with synthetic safety scenario"""
        test_frame = create_test_frame()
        frame_b64 = encode_frame(test_frame)
        
        # Create mock tracking data
        tracks = [
            {
                "track_id": "person_001",
                "bbox": [100, 100, 200, 300],
                "meta": {"confidence": 0.85}
            }
        ]
        
        async with httpx.AsyncClient() as client:
            payload = {
                "camera_id": "test_cam_01",
                "org_id": "test_org",
                "zone_type": "construction",
                "ts": datetime.now().isoformat(),
                "frame_jpeg_b64": frame_b64,
                "tracks": tracks
            }
            
            response = await client.post(
                f"{SERVICES['safetyvision']}/analyze_frame",
                json=payload,
                timeout=30.0
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Should generate safety signals for construction zone
            assert "signals" in result
            assert "telemetry" in result
            print(f"Safety signals: {len(result['signals'])}")
            
            # Check for PPE violation signals
            safety_signals = [s for s in result["signals"] if s["type"] == "missing_ppe"]
            assert len(safety_signals) > 0
    
    @pytest.mark.asyncio
    async def test_edubehavior_pipeline(self):
        """Test EduBehavior service with synthetic student scenario"""
        test_frame = create_test_frame()
        frame_b64 = encode_frame(test_frame)
        
        # Create mock student face data
        faces = [
            {
                "student_id": "student_001",
                "bbox": [120, 120, 180, 180],
                "confidence": 0.92,
                "landmarks": [[140, 140], [160, 140], [150, 160]]
            }
        ]
        
        async with httpx.AsyncClient() as client:
            payload = {
                "camera_id": "classroom_cam_01",
                "class_id": "math_101",
                "org_id": "school_district",
                "ts": datetime.now().isoformat(),
                "frame_jpeg_b64": frame_b64,
                "faces": faces
            }
            
            response = await client.post(
                f"{SERVICES['edubehavior']}/analyze_frame",
                json=payload,
                timeout=30.0
            )
            
            assert response.status_code == 200
            result = response.json()
            
            # Should generate affect signals
            assert "signals" in result
            assert "telemetry" in result
            print(f"Affect signals: {len(result['signals'])}")
            
            # High confidence face should generate attention signal
            if result["signals"]:
                attention_signals = [s for s in result["signals"] if s["type"] == "high_attention"]
                assert len(attention_signals) > 0
    
    @pytest.mark.asyncio
    async def test_privacy_anonymization(self):
        """Test privacy middleware integration"""
        from common_schemas.privacy_middleware import anonymize_frame, RegionType
        
        # Create test frame
        test_frame = create_test_frame()
        original_frame = test_frame.copy()
        
        # Mock detections
        detections = [
            {
                "bbox": [120, 120, 180, 180],
                "type": "face",
                "confidence": 0.9
            },
            {
                "bbox": [300, 400, 400, 450],
                "type": "license_plate", 
                "confidence": 0.8
            }
        ]
        
        # Test org settings
        org_settings = {
            RegionType.FACE: {
                "enabled": True,
                "blur_type": "gaussian",
                "intensity": 0.8
            },
            RegionType.LICENSE_PLATE: {
                "enabled": True,
                "blur_type": "black_box",
                "intensity": 1.0
            }
        }
        
        # Apply anonymization
        anonymized_frame = anonymize_frame(test_frame, detections, org_settings)
        
        # Verify frame was modified
        assert not np.array_equal(original_frame, anonymized_frame)
        print("✅ Privacy anonymization applied successfully")
    
    @pytest.mark.asyncio
    async def test_metrics_collection(self):
        """Test that services are collecting Prometheus metrics"""
        services_with_metrics = ["safetyvision", "edubehavior"]
        
        async with httpx.AsyncClient() as client:
            for service_name in services_with_metrics:
                if service_name not in SERVICES:
                    continue
                
                try:
                    response = await client.get(
                        f"{SERVICES[service_name]}/metrics",
                        timeout=10.0
                    )
                    assert response.status_code == 200
                    metrics_text = response.text
                    
                    # Check for key metrics
                    assert "frames_in_total" in metrics_text
                    assert "frames_processed_total" in metrics_text
                    assert "signals_emitted_total" in metrics_text
                    
                    print(f"✅ {service_name}: Metrics endpoint working")
                except Exception as e:
                    pytest.fail(f"❌ {service_name} metrics failed: {e}")
    
    @pytest.mark.asyncio
    async def test_end_to_end_detection_to_signal(self):
        """Test complete pipeline: frame → detection → analysis → signal"""
        
        # Step 1: Create test frame
        test_frame = create_test_frame(add_objects=True)
        frame_b64 = encode_frame(test_frame)
        
        async with httpx.AsyncClient() as client:
            # Step 2: Get detections from YOLO
            yolo_payload = {
                "image_b64": frame_b64,
                "detection_types": ["person"],
                "confidence_threshold": 0.3
            }
            
            yolo_response = await client.post(
                f"{SERVICES['yolo-detection']}/detect",
                json=yolo_payload,
                timeout=30.0
            )
            
            assert yolo_response.status_code == 200
            detections = yolo_response.json()["detections"]
            
            if not detections:
                pytest.skip("No detections found in synthetic frame")
            
            # Step 3: Convert detections to tracks for SafetyVision
            tracks = []
            for i, det in enumerate(detections):
                tracks.append({
                    "track_id": f"track_{i:03d}",
                    "bbox": det["bbox"],
                    "meta": {"confidence": det["confidence"]}
                })
            
            # Step 4: Analyze with SafetyVision
            safety_payload = {
                "camera_id": "integration_test_cam",
                "org_id": "test_org",
                "zone_type": "construction",
                "ts": datetime.now().isoformat(),
                "frame_jpeg_b64": frame_b64,
                "tracks": tracks
            }
            
            safety_response = await client.post(
                f"{SERVICES['safetyvision']}/analyze_frame",
                json=safety_payload,
                timeout=30.0
            )
            
            assert safety_response.status_code == 200
            safety_result = safety_response.json()
            
            # Step 5: Verify signal generation
            assert "signals" in safety_result
            print(f"✅ End-to-end test: {len(tracks)} tracks → {len(safety_result['signals'])} signals")
            
            # Verify signal structure
            for signal in safety_result["signals"]:
                assert "type" in signal
                assert "severity" in signal
                assert signal["severity"] in ["LOW", "MEDIUM", "HIGH"]

if __name__ == "__main__":
    # Run basic health check
    async def quick_test():
        test = TestFullPipeline()
        await test.test_service_health_all()
        print("🚀 All services healthy - ready for full integration testing")
    
    asyncio.run(quick_test())