"""
Master integration test suite
Runs cross-service tests and validates complete pipeline
"""

import pytest
import asyncio
import httpx
from tests.conftest import get_service_endpoints, create_test_fixtures

class TestServiceIntegration:
    """Cross-service integration tests"""
    
    @pytest.fixture(scope="class", autouse=True) 
    def setup_fixtures(self):
        """Ensure all test fixtures exist"""
        create_test_fixtures()
    
    @pytest.mark.asyncio
    async def test_all_services_health(self):
        """Test that all expected services are healthy"""
        endpoints = get_service_endpoints()
        healthy_services = []
        unhealthy_services = []
        
        for service_name, url in endpoints.items():
            if url is None:  # Skip client-only services
                continue
                
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{url}/health", timeout=10.0)
                    if response.status_code == 200:
                        healthy_services.append(service_name)
                    else:
                        unhealthy_services.append(f"{service_name} (HTTP {response.status_code})")
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                unhealthy_services.append(f"{service_name} ({type(e).__name__})")
        
        print(f"✅ Healthy services: {healthy_services}")
        if unhealthy_services:
            print(f"❌ Unhealthy services: {unhealthy_services}")
        
        # At least one core service should be healthy for tests to be meaningful
        core_services = ["yolo-detection", "safetyvision", "edubehavior"]
        healthy_core = [s for s in healthy_services if s in core_services]
        assert len(healthy_core) > 0, f"No core services healthy. Expected at least one of: {core_services}"
    
    @pytest.mark.asyncio
    async def test_metrics_endpoints(self):
        """Test that services expose Prometheus metrics"""
        endpoints = get_service_endpoints()
        services_with_metrics = ["safetyvision", "edubehavior"]
        
        for service_name in services_with_metrics:
            url = endpoints.get(service_name)
            if not url:
                continue
                
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(f"{url}/metrics", timeout=10.0)
                    assert response.status_code == 200
                    
                    metrics_text = response.text
                    # Check for standard metrics
                    assert "frames_in_total" in metrics_text
                    assert "frames_processed_total" in metrics_text
                    assert "signals_emitted_total" in metrics_text
                    
                    print(f"✅ {service_name}: Metrics endpoint working")
                    
            except (httpx.ConnectError, httpx.TimeoutException):
                pytest.skip(f"{service_name} not available")
    
    @pytest.mark.asyncio
    async def test_pipeline_flow_detection_to_analysis(self):
        """Test complete pipeline: YOLO detection → SafetyVision analysis"""
        yolo_url = get_service_endpoints()["yolo-detection"]
        safety_url = get_service_endpoints()["safetyvision"]
        
        if not yolo_url or not safety_url:
            pytest.skip("Required services not configured")
        
        # Step 1: Get detections from YOLO
        import cv2
        import base64
        
        # Create a test frame
        test_frame = cv2.imread("tests/fixtures/safety_5s.mp4")
        if test_frame is None:
            # Create synthetic frame if fixture not available
            test_frame = cv2.zeros((480, 640, 3), dtype=cv2.uint8)
            test_frame.fill(100)
            cv2.rectangle(test_frame, (150, 200), (250, 400), (100, 120, 80), -1)  # Person
            cv2.circle(test_frame, (200, 180), 20, (180, 150, 120), -1)  # Head
        
        _, buffer = cv2.imencode('.jpg', test_frame)
        frame_b64 = base64.b64encode(buffer).decode('utf-8')
        
        try:
            async with httpx.AsyncClient() as client:
                # YOLO detection
                yolo_payload = {
                    "image_b64": frame_b64,
                    "detection_types": ["person"],
                    "confidence_threshold": 0.3
                }
                
                yolo_response = await client.post(
                    f"{yolo_url}/detect",
                    json=yolo_payload,
                    timeout=30.0
                )
                
                assert yolo_response.status_code == 200
                detections = yolo_response.json()["detections"]
                
                # Convert detections to tracks for SafetyVision
                tracks = []
                for i, det in enumerate(detections):
                    tracks.append({
                        "track_id": f"detected_{i}",
                        "bbox": det["bbox"],
                        "meta": {"confidence": det["confidence"]}
                    })
                
                # If no detections, create a synthetic track
                if not tracks:
                    tracks = [{
                        "track_id": "synthetic_person",
                        "bbox": [150, 200, 250, 400],
                        "meta": {"confidence": 0.8}
                    }]
                
                # SafetyVision analysis
                safety_payload = {
                    "camera_id": "integration_test",
                    "org_id": "test_org",
                    "zone_type": "construction",
                    "frame_jpeg_b64": frame_b64,
                    "tracks": tracks
                }
                
                safety_response = await client.post(
                    f"{safety_url}/analyze_frame", 
                    json=safety_payload,
                    timeout=30.0
                )
                
                assert safety_response.status_code == 200
                safety_result = safety_response.json()
                
                # Verify pipeline completion
                assert "signals" in safety_result
                assert "incidents" in safety_result
                
                print(f"✅ Pipeline test: {len(tracks)} tracks → {len(safety_result['signals'])} signals")
                
        except (httpx.ConnectError, httpx.TimeoutException):
            pytest.skip("Services not available for integration test")
    
    def test_fixture_files_exist(self):
        """Test that all required fixture files exist"""
        import os
        
        required_fixtures = [
            "tests/fixtures/people_5s.mp4",
            "tests/fixtures/safety_5s.mp4", 
            "tests/fixtures/classroom_5s.mp4"
        ]
        
        missing_fixtures = []
        for fixture in required_fixtures:
            if not os.path.exists(fixture):
                missing_fixtures.append(fixture)
        
        if missing_fixtures:
            # Try to create them
            create_test_fixtures()
            
            # Check again
            still_missing = [f for f in missing_fixtures if not os.path.exists(f)]
            assert len(still_missing) == 0, f"Missing test fixtures: {still_missing}"
        
        print(f"✅ All fixture files exist: {required_fixtures}")

if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v", "-s"])