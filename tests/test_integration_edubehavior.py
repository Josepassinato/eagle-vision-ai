#!/usr/bin/env python3
"""
EduBehavior Integration Tests  
Frame → Face Detection → Emotion Inference → EMA/Hysteresis → Signal Generation
"""

import pytest
import cv2
import numpy as np
import os
from datetime import datetime
from unittest.mock import patch, MagicMock

import sys
sys.path.append('../edubehavior')
sys.path.append('../common_schemas')

from edubehavior.inference_pipeline import EmotionPipeline, AffectPrediction

class TestEduBehaviorIntegration:
    
    @pytest.fixture
    def pipeline(self):
        """Create emotion pipeline with mocked ONNX model"""
        with patch('edubehavior.inference_pipeline.ONNXEmotionModel') as mock_model_class:
            mock_model = MagicMock()
            mock_model.session = MagicMock()  # Simulate loaded model
            mock_model_class.return_value = mock_model
            
            pipeline = EmotionPipeline(
                model_path="/mock/emotion_model.onnx",
                ema_alpha=0.3,
                hysteresis_threshold=3  # Lower threshold for testing
            )
            pipeline.emotion_model = mock_model
            return pipeline
    
    @pytest.fixture
    def sample_frame(self):
        """Create sample frame with face-like regions"""
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Add rectangular regions to simulate faces
        cv2.rectangle(frame, (200, 100), (300, 200), (180, 150, 120), -1)  # Face 1
        cv2.rectangle(frame, (400, 150), (500, 250), (170, 140, 110), -1)  # Face 2
        
        return frame
    
    @pytest.fixture
    def face_detections(self):
        """Sample face detection data"""
        return [
            {
                'bbox': [200, 100, 300, 200],  # x1, y1, x2, y2
                'confidence': 0.85,
                'track_id': 'student_001',
                'student_id': 'alice'
            },
            {
                'bbox': [400, 150, 500, 250],
                'confidence': 0.92,
                'track_id': 'student_002', 
                'student_id': 'bob'
            }
        ]
    
    @pytest.fixture
    def happy_prediction(self):
        """Happy emotion prediction"""
        return AffectPrediction(
            emotion='happiness',
            confidence=0.8,
            valence=0.7,
            arousal=0.6,
            engagement=0.8
        )
    
    @pytest.fixture
    def sad_prediction(self):
        """Sad emotion prediction"""
        return AffectPrediction(
            emotion='sadness',
            confidence=0.75,
            valence=-0.6,
            arousal=0.3,
            engagement=0.4
        )
    
    @pytest.fixture 
    def distressed_prediction(self):
        """Distressed emotion prediction"""
        return AffectPrediction(
            emotion='fear',
            confidence=0.85,
            valence=-0.7,
            arousal=0.8,
            engagement=0.3
        )
    
    def test_single_frame_processing(self, pipeline, sample_frame, face_detections, happy_prediction):
        """Test processing single frame with happy students"""
        
        # Mock emotion prediction
        pipeline.emotion_model.predict.return_value = happy_prediction
        
        signals = pipeline.process_frame(
            sample_frame,
            face_detections, 
            class_id='math_101',
            timestamp=datetime.utcnow()
        )
        
        # Should not generate distress signals for happy students
        distress_signals = [s for s in signals if s.get('type') == 'distress']
        assert len(distress_signals) == 0
        
        # Should update student states
        assert len(pipeline.student_states) == 2
        assert 'alice' in pipeline.student_states
        assert 'bob' in pipeline.student_states
    
    def test_distress_signal_generation(self, pipeline, sample_frame, face_detections, distressed_prediction):
        """Test distress signal generation with hysteresis"""
        
        pipeline.emotion_model.predict.return_value = distressed_prediction
        
        # Process multiple frames to trigger hysteresis
        signals_total = []
        for i in range(5):  # Process 5 frames
            signals = pipeline.process_frame(
                sample_frame,
                face_detections,
                class_id='math_101',
                timestamp=datetime.utcnow()
            )
            signals_total.extend(signals)
        
        # Should generate distress signals after threshold
        distress_signals = [s for s in signals_total if s.get('type') == 'distress']
        assert len(distress_signals) >= 1
        
        # Check signal structure
        distress_signal = distress_signals[0]
        assert distress_signal['severity'] == 'MEDIUM'
        assert distress_signal['student_id'] in ['alice', 'bob']
        assert 'class_id' in distress_signal
    
    def test_disengagement_detection(self, pipeline, sample_frame, face_detections):
        """Test disengagement detection"""
        
        # Create low engagement prediction
        low_engagement_prediction = AffectPrediction(
            emotion='boredom',
            confidence=0.7,
            valence=-0.2,
            arousal=0.2,
            engagement=0.15  # Very low engagement
        )
        
        pipeline.emotion_model.predict.return_value = low_engagement_prediction
        
        # Process multiple frames
        signals_total = []
        for i in range(4):
            signals = pipeline.process_frame(
                sample_frame,
                face_detections,
                class_id='math_101'
            )
            signals_total.extend(signals)
        
        # Should generate disengagement signals
        disengagement_signals = [s for s in signals_total if s.get('type') == 'disengagement']
        assert len(disengagement_signals) >= 1
        
        disengagement_signal = disengagement_signals[0]
        assert disengagement_signal['severity'] == 'HIGH'
    
    def test_high_attention_detection(self, pipeline, sample_frame, face_detections):
        """Test high attention signal generation"""
        
        # Create high attention prediction
        high_attention_prediction = AffectPrediction(
            emotion='concentration',
            confidence=0.85,
            valence=0.1,  # Neutral valence
            arousal=0.6,
            engagement=0.9  # Very high engagement
        )
        
        pipeline.emotion_model.predict.return_value = high_attention_prediction
        
        # Process multiple frames
        signals_total = []
        for i in range(4):
            signals = pipeline.process_frame(
                sample_frame,
                face_detections,
                class_id='math_101'
            )
            signals_total.extend(signals)
        
        # Should generate high attention signals
        attention_signals = [s for s in signals_total if s.get('type') == 'high_attention']
        assert len(attention_signals) >= 1
        
        attention_signal = attention_signals[0]
        assert attention_signal['severity'] == 'LOW'  # Positive signal
    
    def test_ema_smoothing(self, pipeline, sample_frame, face_detections, happy_prediction, sad_prediction):
        """Test EMA smoothing of emotional states"""
        
        # Process happy frame first
        pipeline.emotion_model.predict.return_value = happy_prediction
        pipeline.process_frame(sample_frame, face_detections, class_id='math_101')
        
        # Check initial state
        alice_state = pipeline.student_states['alice']
        initial_valence = alice_state.valence_ema
        assert initial_valence > 0  # Should be positive for happiness
        
        # Process sad frame
        pipeline.emotion_model.predict.return_value = sad_prediction
        pipeline.process_frame(sample_frame, face_detections, class_id='math_101')
        
        # Check smoothed state
        updated_valence = alice_state.valence_ema
        
        # Should be smoothed (not jumping directly to sad values)
        assert updated_valence > sad_prediction.valence  # Should be higher than raw sad value
        assert updated_valence < initial_valence  # Should be lower than initial happy value
    
    def test_quality_filtering(self, pipeline, sample_frame, face_detections, happy_prediction):
        """Test face quality filtering"""
        
        # Mock low quality assessment
        with patch.object(pipeline.quality_assessor, 'assess_quality', return_value=0.3):
            pipeline.emotion_model.predict.return_value = happy_prediction
            
            signals = pipeline.process_frame(
                sample_frame,
                face_detections,
                class_id='math_101'
            )
            
            # Should skip low quality faces
            assert len(signals) == 0
            assert len(pipeline.student_states) == 0
    
    def test_temporal_state_cleanup(self, pipeline, sample_frame, face_detections, happy_prediction):
        """Test cleanup of old student states"""
        
        pipeline.emotion_model.predict.return_value = happy_prediction
        
        # Process frame to create states
        pipeline.process_frame(sample_frame, face_detections, class_id='math_101')
        assert len(pipeline.student_states) == 2
        
        # Simulate old timestamp for cleanup
        old_timestamp = datetime.utcnow() - pipeline.cleanup_timeout - timedelta(minutes=1)
        for state in pipeline.student_states.values():
            state.last_updated = old_timestamp
        
        # Process new frame to trigger cleanup
        pipeline.process_frame(sample_frame, face_detections, class_id='math_101')
        
        # Old states should be cleaned up, new ones created
        assert len(pipeline.student_states) == 2
        for state in pipeline.student_states.values():
            assert state.last_updated > old_timestamp
    
    def test_student_summary_generation(self, pipeline, sample_frame, face_detections, happy_prediction):
        """Test student state summary generation"""
        
        pipeline.emotion_model.predict.return_value = happy_prediction
        
        # Process some frames
        for i in range(3):
            pipeline.process_frame(sample_frame, face_detections, class_id='math_101')
        
        # Get student summary
        alice_summary = pipeline.get_student_summary('alice')
        
        assert alice_summary is not None
        assert 'student_id' in alice_summary
        assert 'engagement_ema' in alice_summary
        assert 'valence_ema' in alice_summary
        assert 'emotion_history' in alice_summary
        assert len(alice_summary['emotion_history']) > 0
    
    def test_performance_requirements(self, pipeline, sample_frame, face_detections, happy_prediction):
        """Test processing performance"""
        
        pipeline.emotion_model.predict.return_value = happy_prediction
        
        start_time = datetime.utcnow()
        
        # Process frame
        signals = pipeline.process_frame(
            sample_frame,
            face_detections,
            class_id='math_101'
        )
        
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        
        # Should process quickly (< 0.5 seconds for mocked inference)
        assert processing_time < 0.5
        
        # Should return valid structure
        assert isinstance(signals, list)
        for signal in signals:
            assert 'type' in signal
            assert 'severity' in signal
            assert 'student_id' in signal
    
    def test_error_handling(self, pipeline, sample_frame, face_detections):
        """Test error handling and recovery"""
        
        # Test ONNX model failure
        pipeline.emotion_model.predict.side_effect = Exception("Model inference failed")
        
        signals = pipeline.process_frame(
            sample_frame,
            face_detections,
            class_id='math_101'
        )
        
        # Should handle errors gracefully
        assert isinstance(signals, list)
        # Processing should continue for other faces even if one fails

if __name__ == "__main__":
    pytest.main([__file__, "-v"])