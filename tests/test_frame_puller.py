#!/usr/bin/env python3
"""
Testes para o Frame Puller - Validação de captura e envio de frames
"""

import unittest
import tempfile
import os
import json
import base64
from unittest.mock import Mock, patch, MagicMock
import numpy as np
import cv2
from PIL import Image
from io import BytesIO

from frame_puller.main import FramePuller

class TestFramePuller(unittest.TestCase):
    """Testes do serviço Frame Puller"""
    
    def setUp(self):
        """Configuração inicial dos testes"""
        # Configurar env vars para teste
        os.environ.update({
            "STREAM_URL": "test.mp4",
            "FUSION_URL": "http://localhost:8080",
            "CAMERA_ID": "test_cam",
            "PULLER_FPS": "5",
            "MAX_IMAGE_MB": "0.5"
        })
        
        self.puller = FramePuller()
        
        # Criar frame de teste
        self.test_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    
    def test_frame_to_base64(self):
        """Testa conversão de frame para base64"""
        b64_result = self.puller.frame_to_base64(self.test_frame)
        
        self.assertIsNotNone(b64_result)
        self.assertIsInstance(b64_result, str)
        
        # Verificar que é base64 válido
        try:
            decoded = base64.b64decode(b64_result)
            self.assertGreater(len(decoded), 0)
        except Exception:
            self.fail("Invalid base64 encoding")
    
    def test_frame_to_base64_size_limit(self):
        """Testa limite de tamanho da imagem"""
        # Criar frame muito grande para forçar redução de qualidade
        large_frame = np.random.randint(0, 255, (2160, 3840, 3), dtype=np.uint8)
        
        b64_result = self.puller.frame_to_base64(large_frame)
        
        self.assertIsNotNone(b64_result)
        
        # Verificar tamanho
        decoded = base64.b64decode(b64_result)
        size_mb = len(decoded) / (1024 * 1024)
        self.assertLessEqual(size_mb, float(os.getenv("MAX_IMAGE_MB", "0.5")))
    
    @patch('requests.post')
    def test_send_frame_to_fusion_success(self, mock_post):
        """Testa envio bem-sucedido para Fusion API"""
        # Mock resposta de sucesso
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"events": []}
        mock_post.return_value = mock_response
        
        test_b64 = self.puller.frame_to_base64(self.test_frame)
        result = self.puller.send_frame_to_fusion(test_b64, 1234567890.0)
        
        self.assertTrue(result)
        self.assertEqual(self.puller.success_count, 1)
        
        # Verificar chamada
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        
        # Verificar payload
        payload = call_args[1]['json']
        self.assertEqual(payload['camera_id'], 'test_cam')
        self.assertEqual(payload['ts'], 1234567890.0)
        self.assertEqual(payload['jpg_b64'], test_b64)
    
    @patch('requests.post')
    def test_send_frame_to_fusion_failure(self, mock_post):
        """Testa falha no envio para Fusion API"""
        # Mock resposta de erro
        mock_response = Mock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_post.return_value = mock_response
        
        test_b64 = self.puller.frame_to_base64(self.test_frame)
        result = self.puller.send_frame_to_fusion(test_b64, 1234567890.0)
        
        self.assertFalse(result)
        self.assertEqual(self.puller.error_count, 1)
    
    @patch('requests.post')
    def test_send_frame_to_fusion_timeout(self, mock_post):
        """Testa timeout no envio para Fusion API"""
        from requests.exceptions import Timeout
        mock_post.side_effect = Timeout()
        
        test_b64 = self.puller.frame_to_base64(self.test_frame)
        result = self.puller.send_frame_to_fusion(test_b64, 1234567890.0)
        
        self.assertFalse(result)
        self.assertEqual(self.puller.error_count, 1)
    
    def test_backpressure_reduce_fps(self):
        """Testa redução de FPS por backpressure"""
        initial_fps = self.puller.current_fps
        
        # Simular latências altas
        for _ in range(20):
            self.puller.latency_history.append(0.8)  # 800ms
        
        # Simular requests lentos consecutivos
        self.puller.consecutive_slow_requests = 3
        self.puller.last_fps_adjust = 0  # Permitir ajuste
        
        self.puller.handle_backpressure(0.8)
        
        self.assertLess(self.puller.current_fps, initial_fps)
        self.assertGreaterEqual(self.puller.current_fps, 3)  # MIN_FPS
    
    def test_backpressure_increase_fps(self):
        """Testa aumento de FPS com baixa latência"""
        self.puller.current_fps = 5  # Abaixo do máximo
        
        # Simular latências baixas
        for _ in range(20):
            self.puller.latency_history.append(0.1)  # 100ms
        
        self.puller.consecutive_slow_requests = 0
        self.puller.last_fps_adjust = 0  # Permitir ajuste
        
        self.puller.handle_backpressure(0.1)
        
        self.assertEqual(self.puller.current_fps, 6)  # Deveria aumentar
    
    def test_create_test_video(self):
        """Cria vídeo de teste para validação"""
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as tmp_file:
            temp_video_path = tmp_file.name
        
        try:
            # Parâmetros do vídeo
            width, height = 640, 480
            fps = 10
            duration = 3  # 3 segundos
            frame_count = fps * duration
            
            # Codec e writer
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_video_path, fourcc, fps, (width, height))
            
            # Gerar frames com movimento
            for i in range(frame_count):
                # Criar frame com círculo se movendo
                frame = np.zeros((height, width, 3), dtype=np.uint8)
                
                # Posição do círculo (movimento horizontal)
                center_x = int((i / frame_count) * width)
                center_y = height // 2
                
                cv2.circle(frame, (center_x, center_y), 30, (0, 255, 0), -1)
                
                # Adicionar texto
                cv2.putText(frame, f'Frame {i}', (10, 30), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                
                out.write(frame)
            
            out.release()
            
            # Verificar que o arquivo foi criado
            self.assertTrue(os.path.exists(temp_video_path))
            
            # Testar leitura com OpenCV
            cap = cv2.VideoCapture(temp_video_path)
            self.assertTrue(cap.isOpened())
            
            frame_count_read = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_count_read += 1
            
            cap.release()
            
            self.assertEqual(frame_count_read, frame_count)
            
        finally:
            # Limpeza
            if os.path.exists(temp_video_path):
                os.unlink(temp_video_path)
    
    @patch('cv2.VideoCapture')
    def test_connect_to_stream_success(self, mock_videocapture):
        """Testa conexão bem-sucedida ao stream"""
        # Mock do VideoCapture
        mock_cap = Mock()
        mock_cap.isOpened.return_value = True
        mock_cap.read.return_value = (True, self.test_frame)
        mock_videocapture.return_value = mock_cap
        
        result = self.puller.connect_to_stream()
        
        self.assertTrue(result)
        mock_videocapture.assert_called_once_with("test.mp4")
        mock_cap.set.assert_called_with(cv2.CAP_PROP_BUFFERSIZE, 1)
    
    @patch('cv2.VideoCapture')
    def test_connect_to_stream_failure(self, mock_videocapture):
        """Testa falha na conexão ao stream"""
        # Mock do VideoCapture que falha
        mock_cap = Mock()
        mock_cap.isOpened.return_value = False
        mock_videocapture.return_value = mock_cap
        
        result = self.puller.connect_to_stream()
        
        self.assertFalse(result)
    
    def test_stats_calculation(self):
        """Testa cálculo de estatísticas"""
        # Configurar dados de teste
        self.puller.frame_count = 100
        self.puller.success_count = 95
        self.puller.error_count = 5
        self.puller.latency_history.extend([0.1, 0.2, 0.15, 0.3, 0.25])
        
        # Capture logs para verificar output
        import logging
        import io
        log_capture = io.StringIO()
        handler = logging.StreamHandler(log_capture)
        logging.getLogger().addHandler(handler)
        
        self.puller.print_stats()
        
        # Verificar que logs foram gerados
        log_output = log_capture.getvalue()
        self.assertIn("Stats", log_output)
        self.assertIn("95.0%", log_output)  # Success rate
        self.assertIn("FPS", log_output)
        self.assertIn("Latency", log_output)
    
    def test_environmental_config(self):
        """Testa configuração via variáveis de ambiente"""
        # Definir variáveis específicas
        test_env = {
            "STREAM_URL": "rtsp://test:8554/test",
            "FUSION_URL": "http://test:9090",
            "CAMERA_ID": "test_camera_123",
            "PULLER_FPS": "7",
            "MAX_IMAGE_MB": "1.0"
        }
        
        with patch.dict(os.environ, test_env):
            # Import novamente para pegar as novas variáveis
            from importlib import reload
            import frame_puller.main
            reload(frame_puller.main)
            
            self.assertEqual(frame_puller.main.STREAM_URL, "rtsp://test:8554/test")
            self.assertEqual(frame_puller.main.FUSION_URL, "http://test:9090")
            self.assertEqual(frame_puller.main.CAMERA_ID, "test_camera_123")
            self.assertEqual(frame_puller.main.PULLER_FPS, 7)
            self.assertEqual(frame_puller.main.MAX_IMAGE_MB, 1.0)

class TestFrameProcessing(unittest.TestCase):
    """Testes específicos de processamento de frames"""
    
    def test_rgb_bgr_conversion(self):
        """Testa conversão correta entre RGB e BGR"""
        # Criar frame BGR (OpenCV padrão)
        bgr_frame = np.zeros((100, 100, 3), dtype=np.uint8)
        bgr_frame[:, :, 0] = 255  # Canal azul
        
        puller = FramePuller()
        b64_result = puller.frame_to_base64(bgr_frame)
        
        # Decodificar e verificar
        decoded_bytes = base64.b64decode(b64_result)
        img = Image.open(BytesIO(decoded_bytes))
        img_array = np.array(img)
        
        # No resultado RGB, canal vermelho deveria estar em 255
        self.assertEqual(img_array[0, 0, 0], 255)  # Red channel
        self.assertEqual(img_array[0, 0, 2], 0)    # Blue channel
    
    def test_jpeg_quality_optimization(self):
        """Testa otimização de qualidade JPEG"""
        # Criar frame com padrão detalhado
        frame = np.random.randint(0, 255, (1080, 1920, 3), dtype=np.uint8)
        
        puller = FramePuller()
        
        # Definir limite baixo para forçar otimização
        original_max = puller.__class__.__dict__.get('MAX_IMAGE_MB', 0.5)
        
        with patch('frame_puller.main.MAX_IMAGE_MB', 0.1):  # Limite muito baixo
            b64_result = puller.frame_to_base64(frame, quality=95)
            
            self.assertIsNotNone(b64_result)
            
            # Verificar que o tamanho está dentro do limite
            decoded_bytes = base64.b64decode(b64_result)
            size_mb = len(decoded_bytes) / (1024 * 1024)
            self.assertLessEqual(size_mb, 0.1)

if __name__ == "__main__":
    unittest.main()