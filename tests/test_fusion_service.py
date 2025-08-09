#!/usr/bin/env python3
"""
Testes para o Fusion Service - Validação do pipeline de fusão
"""

import unittest
import base64
import json
import time
from unittest.mock import Mock, patch, MagicMock
from io import BytesIO
from PIL import Image
import numpy as np

# Mock dos módulos de vision tracking
with patch.dict('sys.modules', {
    'vision_tracking': MagicMock(),
    'vision_tracking.VisionTracker': MagicMock(),
    'vision_tracking.MotionAnalyzer': MagicMock()
}):
    from fusion.main import app, decode_base64_image, crop_image, encode_image_b64

from fastapi.testclient import TestClient

class TestFusionService(unittest.TestCase):
    """Testes do serviço de fusão"""
    
    def setUp(self):
        """Configuração inicial dos testes"""
        self.client = TestClient(app)
        
        # Criar imagem de teste
        test_img = Image.new('RGB', (640, 480), color='red')
        buffer = BytesIO()
        test_img.save(buffer, format='JPEG')
        self.test_image_b64 = base64.b64encode(buffer.getvalue()).decode()
        
        # Mock das respostas dos serviços
        self.mock_yolo_response = {
            "detections": [
                {
                    "class": 0,
                    "confidence": 0.85,
                    "x1": 100, "y1": 100, "x2": 200, "y2": 300
                }
            ]
        }
        
        self.mock_face_response = [
            {
                "bbox": [10, 10, 50, 60],
                "det_score": 0.99,
                "embedding": [0.1] * 512,
                "gender": "Male",
                "age": 25
            }
        ]
        
        self.mock_face_match_response = [
            {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "João Silva",
                "similarity": 0.85
            }
        ]
        
        self.mock_reid_response = {
            "results": [
                {
                    "id": "550e8400-e29b-41d4-a716-446655440000",
                    "name": "João Silva", 
                    "similarity": 0.90
                }
            ]
        }
        
        # Mock do ingest event response
        self.mock_ingest_response = {
            "success": True,
            "event_id": 123
        }
    
    def test_health_endpoint(self):
        """Testa endpoint de saúde"""
        with patch('requests.get') as mock_get:
            mock_get.return_value.status_code = 200
            
            response = self.client.get("/health")
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "ok")
            self.assertIn("services", data)
            self.assertIn("thresholds", data)
    
    def test_decode_base64_image(self):
        """Testa decodificação de imagem base64"""
        img_array = decode_base64_image(self.test_image_b64)
        
        self.assertIsInstance(img_array, np.ndarray)
        self.assertEqual(len(img_array.shape), 3)  # Height, Width, Channels
        self.assertEqual(img_array.shape[2], 3)    # RGB
    
    def test_crop_image(self):
        """Testa recorte de imagem"""
        img = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        bbox = [100, 100, 200, 300]
        
        cropped = crop_image(img, bbox)
        
        self.assertEqual(cropped.shape, (200, 100, 3))  # height, width, channels
    
    def test_encode_image_b64(self):
        """Testa codificação de imagem para base64"""
        img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
        
        b64_str = encode_image_b64(img)
        
        self.assertIsInstance(b64_str, str)
        self.assertTrue(len(b64_str) > 0)
        
        # Validar que é um base64 válido
        try:
            base64.b64decode(b64_str)
        except Exception:
            self.fail("Base64 encoding failed")
    
    @patch('fusion.main.vision_tracker')
    @patch('fusion.main.motion_analyzer')
    @patch('requests.post')
    @patch('requests.get')
    def test_ingest_frame_face_confirmation(self, mock_get, mock_post, mock_motion, mock_tracker):
        """Testa confirmação por reconhecimento facial"""
        # Setup mocks
        mock_get.return_value.status_code = 200
        
        # Mock YOLO detection
        mock_post.side_effect = [
            Mock(status_code=200, json=lambda: self.mock_yolo_response),  # YOLO
            Mock(status_code=200, json=lambda: self.mock_face_response),  # Face extract
            Mock(status_code=200, json=lambda: self.mock_ingest_response) # Ingest event
        ]
        
        # Mock tracking
        mock_tracker.update.return_value = [1]  # track_id = 1
        mock_tracker.frames_confirmed.return_value = 20  # > N_FRAMES
        mock_motion.update_and_displacement.return_value = 5.0  # movimento
        
        # Mock face matching
        with patch('fusion.main.match_face') as mock_face_match:
            mock_face_match.return_value = self.mock_face_match_response
            
            request_data = {
                "camera_id": "cam01",
                "ts": time.time(),
                "jpg_b64": self.test_image_b64,
                "max_people": 5
            }
            
            response = self.client.post("/ingest_frame", json=request_data)
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            self.assertIn("events", data)
            self.assertEqual(len(data["events"]), 1)
            
            event = data["events"][0]
            self.assertEqual(event["reason"], "face")
            self.assertEqual(event["camera_id"], "cam01")
            self.assertIsNotNone(event["person_id"])
            self.assertGreaterEqual(event["face_similarity"], 0.60)  # T_FACE
            self.assertEqual(event["frames_confirmed"], 20)
    
    @patch('fusion.main.vision_tracker')
    @patch('fusion.main.motion_analyzer')
    @patch('requests.post')
    @patch('requests.get')
    def test_ingest_frame_reid_confirmation(self, mock_get, mock_post, mock_motion, mock_tracker):
        """Testa confirmação por Re-ID + movimento"""
        # Setup mocks
        mock_get.return_value.status_code = 200
        
        # Mock YOLO detection + Reid match
        mock_post.side_effect = [
            Mock(status_code=200, json=lambda: self.mock_yolo_response),  # YOLO
            Mock(status_code=500),  # Face extract falha
            Mock(status_code=200, json=lambda: self.mock_reid_response), # Reid match
            Mock(status_code=200, json=lambda: self.mock_ingest_response) # Ingest event
        ]
        
        # Mock tracking com movimento suficiente
        mock_tracker.update.return_value = [1]
        mock_tracker.frames_confirmed.return_value = 18  # > N_FRAMES
        mock_motion.update_and_displacement.return_value = 4.5  # > T_MOVE
        
        request_data = {
            "camera_id": "cam02", 
            "ts": time.time(),
            "jpg_b64": self.test_image_b64
        }
        
        response = self.client.post("/ingest_frame", json=request_data)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(len(data["events"]), 1)
        
        event = data["events"][0]
        self.assertEqual(event["reason"], "reid+motion")
        self.assertIsNone(event["face_similarity"])
        self.assertGreaterEqual(event["reid_similarity"], 0.82)  # T_REID
        self.assertGreaterEqual(event["movement_px"], 3.0)      # T_MOVE
    
    @patch('fusion.main.vision_tracker')
    @patch('fusion.main.motion_analyzer')
    @patch('requests.post')
    @patch('requests.get')
    def test_ingest_frame_no_confirmation(self, mock_get, mock_post, mock_motion, mock_tracker):
        """Testa caso onde não há confirmação suficiente"""
        # Setup mocks
        mock_get.return_value.status_code = 200
        
        # Mock baixa similaridade
        low_similarity_face = [{"id": "uuid", "name": "test", "similarity": 0.30}]
        low_similarity_reid = {"results": [{"id": "uuid", "name": "test", "similarity": 0.50}]}
        
        mock_post.side_effect = [
            Mock(status_code=200, json=lambda: self.mock_yolo_response),
            Mock(status_code=200, json=lambda: self.mock_face_response),
            Mock(status_code=200, json=lambda: low_similarity_reid)
        ]
        
        # Mock tracking com poucos frames
        mock_tracker.update.return_value = [1]
        mock_tracker.frames_confirmed.return_value = 5  # < N_FRAMES
        mock_motion.update_and_displacement.return_value = 1.0  # < T_MOVE
        
        with patch('fusion.main.match_face') as mock_face_match:
            mock_face_match.return_value = low_similarity_face
            
            request_data = {
                "camera_id": "cam03",
                "ts": time.time(), 
                "jpg_b64": self.test_image_b64
            }
            
            response = self.client.post("/ingest_frame", json=request_data)
            
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            # Não deve haver eventos confirmados
            self.assertEqual(len(data["events"]), 0)
    
    def test_invalid_base64_image(self):
        """Testa validação de imagem base64 inválida"""
        request_data = {
            "camera_id": "cam01",
            "ts": time.time(),
            "jpg_b64": "invalid_base64"
        }
        
        response = self.client.post("/ingest_frame", json=request_data)
        
        self.assertEqual(response.status_code, 500)
    
    @patch('requests.post')
    def test_service_failure_handling(self, mock_post):
        """Testa tratamento de falhas dos serviços"""
        # Simular falha no YOLO
        mock_post.return_value = Mock(status_code=500)
        
        request_data = {
            "camera_id": "cam01",
            "ts": time.time(),
            "jpg_b64": self.test_image_b64
        }
        
        response = self.client.post("/ingest_frame", json=request_data)
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Deve retornar lista vazia se YOLO falhar
        self.assertEqual(len(data["events"]), 0)
    
    def test_max_people_limit(self):
        """Testa limite máximo de pessoas"""
        # Criar muitas detecções
        many_detections = {
            "detections": [
                {"class": 0, "confidence": 0.8, "x1": i*50, "y1": 100, "x2": i*50+40, "y2": 200}
                for i in range(20)  # 20 pessoas
            ]
        }
        
        with patch('requests.post') as mock_post:
            mock_post.return_value = Mock(status_code=200, json=lambda: many_detections)
            
            request_data = {
                "camera_id": "cam01",
                "ts": time.time(),
                "jpg_b64": self.test_image_b64,
                "max_people": 5
            }
            
            with patch('fusion.main.vision_tracker') as mock_tracker:
                mock_tracker.update.return_value = [1, 2, 3, 4, 5]  # Apenas 5 tracks
                
                response = self.client.post("/ingest_frame", json=request_data)
                
                self.assertEqual(response.status_code, 200)
                
                # Verificar que apenas 5 pessoas foram processadas
                mock_tracker.update.assert_called_once()
                boxes_arg = mock_tracker.update.call_args[0][1]
                self.assertEqual(len(boxes_arg), 5)

if __name__ == "__main__":
    unittest.main()