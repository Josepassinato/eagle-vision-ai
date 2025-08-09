#!/usr/bin/env python3
"""
Unit tests for Analytics Service
"""

import unittest
from unittest.mock import patch
import json
import sys
import os

# Add analytics to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'analytics'))

from main import AnalyticsService, UpdateRequest, BBoxItem, VirtualLine
from fastapi.testclient import TestClient
from main import app

class TestVirtualLine(unittest.TestCase):
    def setUp(self):
        self.line = VirtualLine((0.0, 0.5), (1.0, 0.5), "test")
    
    def test_horizontal_line_sides(self):
        """Test side detection for horizontal line"""
        # Point above line should be side A
        self.assertEqual(self.line.which_side((0.5, 0.3)), "A")
        # Point below line should be side B  
        self.assertEqual(self.line.which_side((0.5, 0.7)), "B")
    
    def test_distance_calculation(self):
        """Test distance calculation to line"""
        # Point on line should have distance 0
        distance = self.line.distance_to_line((0.5, 0.5))
        self.assertAlmostEqual(distance, 0.0, places=5)
        
        # Point 0.1 units away should have distance 0.1
        distance = self.line.distance_to_line((0.5, 0.6))
        self.assertAlmostEqual(distance, 0.1, places=5)

class TestAnalyticsService(unittest.TestCase):
    def setUp(self):
        self.service = AnalyticsService()
        self.test_client = TestClient(app)
    
    def test_health_endpoint(self):
        """Test health endpoint"""
        response = self.test_client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["service"], "analytics")
    
    def test_virtual_line_crossing_detection(self):
        """Test line crossing detection"""
        camera_id = "test_cam"
        frame_size = [1920, 1080]
        
        # Set horizontal line at middle
        self.service.set_virtual_line(camera_id, (0.0, 0.5), (1.0, 0.5))
        
        # First update - person above line (side A)
        request1 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200000.0,
            items=[
                BBoxItem(track_id=1, cls="person", xyxy=[950, 400, 970, 480])  # Center at (960, 440)
            ],
            frame_size=frame_size
        )
        events1 = self.service.update_tracks(request1)
        self.assertEqual(len(events1), 0)  # No crossing yet
        
        # Second update - same person below line (side B) -> crossing!
        request2 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200001.0,
            items=[
                BBoxItem(track_id=1, cls="person", xyxy=[950, 600, 970, 680])  # Center at (960, 640)
            ],
            frame_size=frame_size
        )
        events2 = self.service.update_tracks(request2)
        self.assertEqual(len(events2), 1)  # One crossing detected
        
        event = events2[0]
        self.assertEqual(event["camera_id"], camera_id)
        self.assertEqual(event["track_id"], 1)
        self.assertEqual(event["cls"], "person")
        self.assertEqual(event["direction"], "A_to_B")
        
        # Check counter was updated
        counters = self.service.get_counters(camera_id)
        self.assertEqual(counters["person"]["A_to_B"], 1)
        self.assertEqual(counters["person"]["total"], 1)
    
    def test_bidirectional_crossing(self):
        """Test crossing in both directions"""
        camera_id = "test_cam"
        frame_size = [1920, 1080]
        
        # Car crossing A to B
        request1 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200000.0,
            items=[BBoxItem(track_id=10, cls="car", xyxy=[500, 400, 600, 500])],
            frame_size=frame_size
        )
        self.service.update_tracks(request1)
        
        request2 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200001.0,
            items=[BBoxItem(track_id=10, cls="car", xyxy=[500, 600, 600, 700])],
            frame_size=frame_size
        )
        events = self.service.update_tracks(request2)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["direction"], "A_to_B")
        
        # Another car crossing B to A
        request3 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200002.0,
            items=[BBoxItem(track_id=20, cls="car", xyxy=[700, 600, 800, 700])],
            frame_size=frame_size
        )
        self.service.update_tracks(request3)
        
        request4 = UpdateRequest(
            camera_id=camera_id,
            ts=1723200003.0,
            items=[BBoxItem(track_id=20, cls="car", xyxy=[700, 400, 800, 500])],
            frame_size=frame_size
        )
        events = self.service.update_tracks(request4)
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["direction"], "B_to_A")
        
        # Check final counters
        counters = self.service.get_counters(camera_id)
        self.assertEqual(counters["car"]["A_to_B"], 1)
        self.assertEqual(counters["car"]["B_to_A"], 1)
        self.assertEqual(counters["car"]["total"], 2)
    
    def test_update_endpoint(self):
        """Test update API endpoint"""
        payload = {
            "camera_id": "api_test",
            "ts": 1723200000.5,
            "items": [
                {"track_id": 1, "cls": "person", "xyxy": [100, 200, 150, 400]},
                {"track_id": 2, "cls": "car", "xyxy": [500, 300, 700, 500]}
            ],
            "frame_size": [1920, 1080]
        }
        
        response = self.test_client.post("/update", json=payload)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["processed_items"], 2)
    
    def test_counters_endpoint(self):
        """Test counters API endpoint"""
        # First add some data
        payload = {
            "camera_id": "counter_test",
            "ts": 1723200000.0,
            "items": [{"track_id": 1, "cls": "person", "xyxy": [100, 200, 150, 400]}],
            "frame_size": [1920, 1080]
        }
        self.test_client.post("/update", json=payload)
        
        # Get counters for specific camera
        response = self.test_client.get("/counters?camera_id=counter_test")
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data["camera_id"], "counter_test")
        self.assertIn("counters", data)
        
        # Get all counters
        response = self.test_client.get("/counters")
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn("counters", data)
    
    def test_virtual_line_config(self):
        """Test virtual line configuration endpoints"""
        camera_id = "config_test"
        
        # Get default config
        response = self.test_client.get(f"/config/{camera_id}")
        self.assertEqual(response.status_code, 200)
        
        # Set custom config
        config = {
            "camera_id": camera_id,
            "point1": [0.2, 0.0],
            "point2": [0.8, 1.0],
            "name": "diagonal"
        }
        response = self.test_client.post(f"/config/{camera_id}", json=config)
        self.assertEqual(response.status_code, 200)
        
        # Verify config was set
        response = self.test_client.get(f"/config/{camera_id}")
        data = response.json()
        self.assertEqual(data["point1"], [0.2, 0.0])
        self.assertEqual(data["point2"], [0.8, 1.0])
        self.assertEqual(data["name"], "diagonal")
    
    def test_unsupported_classes_ignored(self):
        """Test that unsupported classes are ignored"""
        camera_id = "filter_test"
        
        payload = {
            "camera_id": camera_id,
            "ts": 1723200000.0,
            "items": [
                {"track_id": 1, "cls": "person", "xyxy": [100, 200, 150, 400]},
                {"track_id": 2, "cls": "dog", "xyxy": [200, 200, 250, 300]},  # Unsupported
                {"track_id": 3, "cls": "car", "xyxy": [300, 200, 400, 350]}
            ],
            "frame_size": [1920, 1080]
        }
        
        response = self.test_client.post("/update", json=payload)
        self.assertEqual(response.status_code, 200)
        
        # Only person and car should be tracked (dog ignored)
        track_keys = list(self.service.tracks.keys())
        expected_keys = [f"{camera_id}_1", f"{camera_id}_3"]
        for key in expected_keys:
            self.assertIn(key, track_keys)
        
        # Verify dog track was not created
        self.assertNotIn(f"{camera_id}_2", track_keys)

if __name__ == "__main__":
    unittest.main()