#!/usr/bin/env python3
"""
SafetyVision Integration Tests
Frame → YOLO → PPE/Fall/Pose Analysis → Signal Generation
"""

import pytest
import cv2
import numpy as np
import asyncio
import os
from datetime import datetime
from unittest.mock import AsyncMock, patch

import sys
sys.path.append('../safetyvision')
sys.path.append('../common_schemas')

from safetyvision.ppe_pipeline import SafetyVisionPipeline
from safetyvision.yolo_client import YOLOClient, Detection

class TestSafetyVisionIntegration:
    
    @pytest.fixture
    def pipeline(self):
        """Create pipeline with mocked YOLO client"""
        return SafetyVisionPipeline(yolo_service_url="http://mock-yolo:8080")
    
    @pytest.fixture
    def sample_frame(self):
        """Create a sample frame for testing"""
        # Create a 720p frame with some content
        frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
        
        # Add a simple rectangle to simulate a person
        cv2.rectangle(frame, (400, 200), (600, 600), (100, 150, 200), -1)
        
        return frame
    
    @pytest.fixture  
    def sample_tracks(self):
        """Sample tracking data"""
        return [
            {
                'track_id': 'person_001',
                'bbox': [400, 200, 600, 600],  # x1, y1, x2, y2
                'confidence': 0.85,
                'class': 'person'
            },
            {
                'track_id': 'person_002', 
                'bbox': [700, 150, 900, 550],
                'confidence': 0.92,
                'class': 'person'
            }
        ]
    
    @pytest.fixture
    def ppe_detections(self):
        """Mock PPE detections"""
        return [
            Detection('hardhat', 0.8, (410, 200, 450, 240), 1),
            Detection('safety_vest', 0.7, (430, 300, 570, 500), 2),
            Detection('person', 0.9, (400, 200, 600, 600), 0)
        ]
    
    @pytest.fixture
    def no_ppe_detections(self):
        """Mock detections with no PPE"""
        return [
            Detection('person', 0.9, (400, 200, 600, 600), 0)
        ]
    
    @pytest.mark.asyncio
    async def test_ppe_compliance_detection(self, pipeline, sample_frame, sample_tracks, ppe_detections):
        """Test PPE compliance detection with compliant worker"""
        
        # Mock YOLO client responses
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                
                mock_detect.return_value = ppe_detections
                mock_ppe.return_value = {
                    'compliant': True,
                    'missing_ppe': [],
                    'detected_ppe': {
                        'hardhat': {'detected': True, 'confidence': 0.8},
                        'vest': {'detected': True, 'confidence': 0.7}
                    },
                    'confidence': 0.75
                }
                
                # Process frame
                signals = await pipeline.process_frame(
                    sample_frame, 
                    sample_tracks,
                    camera_id='camera_001',
                    org_id='test_org',
                    zone_type='construction'
                )
                
                # Should not generate PPE violation signals for compliant worker
                ppe_violations = [s for s in signals if s.get('type') == 'missing_ppe']
                assert len(ppe_violations) == 0
    
    @pytest.mark.asyncio
    async def test_ppe_violation_detection(self, pipeline, sample_frame, sample_tracks, no_ppe_detections):
        """Test PPE violation detection with non-compliant worker"""
        
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                
                mock_detect.return_value = no_ppe_detections
                mock_ppe.return_value = {
                    'compliant': False,
                    'missing_ppe': ['hardhat', 'vest'],
                    'detected_ppe': {
                        'hardhat': {'detected': False, 'confidence': 0.0},
                        'vest': {'detected': False, 'confidence': 0.0}
                    },
                    'confidence': 0.5
                }
                
                # Process frame  
                signals = await pipeline.process_frame(
                    sample_frame,
                    sample_tracks, 
                    camera_id='camera_001',
                    org_id='test_org',
                    zone_type='construction'
                )
                
                # Should generate PPE violation signals
                ppe_violations = [s for s in signals if s.get('type') == 'missing_ppe']
                assert len(ppe_violations) >= 1
                
                # Check signal structure
                violation = ppe_violations[0]
                assert violation['severity'] == 'HIGH'
                assert violation['track_id'] in ['person_001', 'person_002']
                assert 'missing_ppe_type' in violation
                assert violation['missing_ppe_type'] in ['hardhat', 'vest']
    
    @pytest.mark.asyncio
    async def test_fall_detection(self, pipeline, sample_frame, sample_tracks):
        """Test fall detection functionality"""
        
        # Mock YOLO responses for normal case
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                with patch.object(pipeline.fall_detector, 'analyze_fall_risk') as mock_fall:
                    
                    mock_detect.return_value = []
                    mock_ppe.return_value = {'compliant': True, 'missing_ppe': [], 'confidence': 0.8}
                    
                    # Simulate fall detection
                    mock_fall.return_value = {
                        'type': 'fall_suspected',
                        'severity': 'CRITICAL',
                        'track_id': 'person_001',
                        'confidence': 0.85,
                        'fall_confidence': 0.9,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                    
                    signals = await pipeline.process_frame(
                        sample_frame,
                        sample_tracks,
                        camera_id='camera_001', 
                        org_id='test_org'
                    )
                    
                    # Should detect fall
                    fall_signals = [s for s in signals if s.get('type') == 'fall_suspected']
                    assert len(fall_signals) >= 1
                    
                    fall_signal = fall_signals[0]
                    assert fall_signal['severity'] == 'CRITICAL'
                    assert fall_signal['confidence'] >= 0.8
    
    @pytest.mark.asyncio 
    async def test_unsafe_lifting_detection(self, pipeline, sample_frame, sample_tracks):
        """Test unsafe lifting posture detection"""
        
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                with patch.object(pipeline.pose_analyzer, 'analyze_lifting_posture', new_callable=AsyncMock) as mock_pose:
                    
                    mock_detect.return_value = []
                    mock_ppe.return_value = {'compliant': True, 'missing_ppe': [], 'confidence': 0.8}
                    
                    # Simulate unsafe lifting detection
                    mock_pose.return_value = {
                        'unsafe_lifting': True,
                        'risk_factors': ['bent_back', 'twisted_spine'],
                        'confidence': 0.75,
                        'severity': 'HIGH'
                    }
                    
                    signals = await pipeline.process_frame(
                        sample_frame,
                        sample_tracks,
                        camera_id='camera_001',
                        org_id='test_org'
                    )
                    
                    # Should detect unsafe lifting
                    posture_signals = [s for s in signals if s.get('type') == 'unsafe_lifting']
                    assert len(posture_signals) >= 1
                    
                    posture_signal = posture_signals[0]
                    assert posture_signal['severity'] == 'HIGH'
                    assert 'risk_factors' in posture_signal
    
    @pytest.mark.asyncio
    async def test_performance_requirements(self, pipeline, sample_frame, sample_tracks):
        """Test processing performance requirements"""
        
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                
                mock_detect.return_value = []
                mock_ppe.return_value = {'compliant': True, 'missing_ppe': [], 'confidence': 0.8}
                
                # Measure processing time
                start_time = datetime.utcnow()
                
                signals = await pipeline.process_frame(
                    sample_frame,
                    sample_tracks,
                    camera_id='camera_001',
                    org_id='test_org'
                )
                
                end_time = datetime.utcnow()
                processing_time = (end_time - start_time).total_seconds()
                
                # Should process within reasonable time (< 1 second for mock)
                assert processing_time < 1.0
                
                # Should return valid signal structure
                assert isinstance(signals, list)
                for signal in signals:
                    assert 'type' in signal
                    assert 'severity' in signal
                    assert 'track_id' in signal
    
    @pytest.mark.asyncio
    async def test_zone_specific_ppe_requirements(self, pipeline, sample_frame, sample_tracks):
        """Test zone-specific PPE requirement enforcement"""
        
        with patch.object(pipeline.yolo_client, 'detect_objects', new_callable=AsyncMock) as mock_detect:
            with patch.object(pipeline.yolo_client, 'analyze_ppe_compliance', new_callable=AsyncMock) as mock_ppe:
                
                mock_detect.return_value = []
                
                # Test construction zone (requires hardhat, vest, boots)
                mock_ppe.return_value = {
                    'compliant': False,
                    'missing_ppe': ['boots'], 
                    'detected_ppe': {
                        'hardhat': {'detected': True, 'confidence': 0.8},
                        'vest': {'detected': True, 'confidence': 0.7},
                        'boots': {'detected': False, 'confidence': 0.0}
                    },
                    'confidence': 0.5
                }
                
                signals_construction = await pipeline.process_frame(
                    sample_frame,
                    sample_tracks,
                    camera_id='camera_001',
                    org_id='test_org', 
                    zone_type='construction'
                )
                
                # Test warehouse zone (requires vest, boots)
                mock_ppe.return_value = {
                    'compliant': True,
                    'missing_ppe': [],
                    'detected_ppe': {
                        'vest': {'detected': True, 'confidence': 0.8},
                        'boots': {'detected': True, 'confidence': 0.7}
                    },
                    'confidence': 0.75
                }
                
                signals_warehouse = await pipeline.process_frame(
                    sample_frame,
                    sample_tracks,
                    camera_id='camera_001',
                    org_id='test_org',
                    zone_type='warehouse'
                )
                
                # Construction zone should have violation, warehouse should not
                construction_violations = [s for s in signals_construction if s.get('type') == 'missing_ppe']
                warehouse_violations = [s for s in signals_warehouse if s.get('type') == 'missing_ppe']
                
                assert len(construction_violations) >= 1
                assert len(warehouse_violations) == 0
    
    def test_pipeline_initialization(self):
        """Test pipeline initialization with different configurations"""
        
        # Test with all features enabled
        pipeline_full = SafetyVisionPipeline(
            yolo_service_url="http://yolo:8080",
            fall_detection_enabled=True,
            pose_analysis_enabled=True
        )
        
        assert pipeline_full.fall_detector is not None
        assert pipeline_full.pose_analyzer is not None
        assert isinstance(pipeline_full.yolo_client, YOLOClient)
        
        # Test with features disabled
        pipeline_minimal = SafetyVisionPipeline(
            fall_detection_enabled=False,
            pose_analysis_enabled=False
        )
        
        assert pipeline_minimal.fall_detector is None
        assert pipeline_minimal.pose_analyzer is None
        
    @pytest.mark.asyncio
    async def test_error_handling(self, pipeline, sample_frame, sample_tracks):
        """Test error handling and recovery"""
        
        # Test YOLO service failure
        with patch.object(pipeline.yolo_client, 'detect_objects', side_effect=Exception("YOLO service down")):
            
            signals = await pipeline.process_frame(
                sample_frame,
                sample_tracks,
                camera_id='camera_001',
                org_id='test_org'
            )
            
            # Should handle error gracefully and return empty signals
            assert isinstance(signals, list)
            # May return empty list or limited signals depending on error handling

if __name__ == "__main__":
    pytest.main([__file__, "-v"])