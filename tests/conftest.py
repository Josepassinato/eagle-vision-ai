"""
Shared test utilities and fixtures for AI Vision integration tests
"""

import cv2
import numpy as np
import os
from typing import Tuple, List

def create_test_fixtures():
    """Create all test video fixtures if they don't exist"""
    os.makedirs("tests/fixtures", exist_ok=True)
    
    fixtures = [
        ("tests/fixtures/people_5s.mp4", create_people_video),
        ("tests/fixtures/vehicles_5s.mp4", create_vehicles_video),
        ("tests/fixtures/safety_5s.mp4", create_safety_video),
        ("tests/fixtures/classroom_5s.mp4", create_classroom_video),
    ]
    
    for path, creator_func in fixtures:
        if not os.path.exists(path):
            print(f"Creating test fixture: {path}")
            creator_func(path, 5)

def create_people_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic video with people"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(40)
        
        # Multiple people walking
        people = [
            (100 + frame_num % 50, 200, 50, 120),
            (300 - frame_num % 30, 180, 45, 130),
            (500, 220 + int(20 * np.sin(frame_num * 0.1)), 40, 110),
        ]
        
        for x, y, w, h in people:
            # Body
            cv2.rectangle(frame, (x, y), (x + w, y + h), (100, 120, 80), -1)
            # Head
            cv2.circle(frame, (x + w//2, y - 15), 15, (180, 150, 120), -1)
        
        # Add noise
        noise = np.random.randint(0, 30, frame.shape, dtype=np.uint8)
        frame = cv2.add(frame, noise)
        
        out.write(frame)
    
    out.release()

def create_vehicles_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic video with vehicles"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(60)
        
        # Road
        cv2.rectangle(frame, (0, 300), (640, 480), (80, 80, 80), -1)
        
        # Moving vehicles
        car1_x = (frame_num * 3) % 700 - 60
        car2_x = 640 - (frame_num * 2) % 700
        
        # Car 1
        if 0 <= car1_x <= 580:
            cv2.rectangle(frame, (car1_x, 320), (car1_x + 60, 360), (0, 0, 150), -1)
            cv2.rectangle(frame, (car1_x + 10, 325), (car1_x + 50, 340), (200, 200, 255), -1)
        
        # Car 2  
        if 0 <= car2_x <= 580:
            cv2.rectangle(frame, (car2_x, 380), (car2_x + 70, 420), (150, 0, 0), -1)
            cv2.rectangle(frame, (car2_x + 15, 385), (car2_x + 55, 400), (255, 200, 200), -1)
        
        # License plates
        if 0 <= car1_x <= 580:
            cv2.rectangle(frame, (car1_x + 20, 360), (car1_x + 40, 370), (255, 255, 255), -1)
        if 0 <= car2_x <= 580:
            cv2.rectangle(frame, (car2_x + 25, 375), (car2_x + 45, 385), (255, 255, 255), -1)
        
        out.write(frame)
    
    out.release()

def create_safety_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic safety/construction video"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(100)
        
        # Construction site background
        cv2.rectangle(frame, (0, 400), (640, 480), (120, 100, 60), -1)  # Ground
        cv2.rectangle(frame, (200, 200), (400, 400), (150, 150, 150), -1)  # Structure
        
        # Workers (some with/without PPE)
        workers = [
            (150, 300, 40, 100, True),   # With hardhat
            (450, 320, 35, 95, False),   # Without hardhat (violation)
        ]
        
        for x, y, w, h, has_ppe in workers:
            # Worker body
            cv2.rectangle(frame, (x, y), (x + w, y + h), (100, 100, 200), -1)
            # Head
            head_x, head_y = x + w//4, y - 20
            cv2.circle(frame, (head_x + 10, head_y + 10), 15, (180, 150, 120), -1)
            
            # PPE (hardhat)
            if has_ppe:
                cv2.circle(frame, (head_x + 10, head_y + 5), 18, (255, 255, 0), 3)
        
        # Add industrial equipment
        cv2.rectangle(frame, (50, 250), (150, 350), (200, 200, 200), -1)
        
        out.write(frame)
    
    out.release()

def create_classroom_video(output_path: str, duration_seconds: int = 5):
    """Create synthetic classroom video"""
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, 30.0, (640, 480))
    
    total_frames = duration_seconds * 30
    
    for frame_num in range(total_frames):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame.fill(80)
        
        # Classroom background
        cv2.rectangle(frame, (0, 0), (640, 100), (200, 200, 200), -1)  # Wall
        cv2.rectangle(frame, (20, 20), (620, 80), (100, 100, 100), -1)  # Blackboard
        
        # Student faces (varying emotions)
        students = [
            (100, 150, 50, 60),
            (300, 140, 55, 65),
            (500, 160, 48, 58),
            (150, 300, 52, 62),
            (400, 290, 50, 60),
        ]
        
        for i, (x, y, w, h) in enumerate(students):
            # Face base
            cv2.ellipse(frame, (x + w//2, y + h//2), (w//2, h//2), 0, 0, 360, (180, 150, 120), -1)
            
            # Eyes
            cv2.circle(frame, (x + w//3, y + h//3), 3, (50, 50, 50), -1)
            cv2.circle(frame, (x + 2*w//3, y + h//3), 3, (50, 50, 50), -1)
            
            # Mouth (different expressions)
            mouth_y = y + 2*h//3
            if frame_num % 60 < 20:  # Happy
                cv2.ellipse(frame, (x + w//2, mouth_y), (8, 4), 0, 0, 180, (50, 50, 50), 2)
            elif frame_num % 60 < 40:  # Neutral
                cv2.line(frame, (x + w//2 - 6, mouth_y), (x + w//2 + 6, mouth_y), (50, 50, 50), 2)
            else:  # Sad/distressed
                cv2.ellipse(frame, (x + w//2, mouth_y + 5), (8, 4), 0, 180, 360, (50, 50, 50), 2)
        
        out.write(frame)
    
    out.release()

def get_service_endpoints():
    """Get all service endpoints for testing"""
    return {
        "yolo-detection": "http://localhost:8080",
        "safetyvision": "http://localhost:8089",
        "edubehavior": "http://localhost:8087",
        "antitheft": "http://localhost:8086",
        "fusion": "http://localhost:8084",
        "enricher": "http://localhost:8086",
        "frame-puller": None,  # Client service, no HTTP endpoint
        "multi-tracker": "http://localhost:8087",
        "notifier": "http://localhost:8085",
    }

if __name__ == "__main__":
    # Create all test fixtures
    create_test_fixtures()
    print("✅ All test fixtures created successfully")