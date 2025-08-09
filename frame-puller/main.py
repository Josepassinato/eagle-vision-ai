#!/usr/bin/env python3
"""
Frame Puller - Ingestão contínua de frames do MediaMTX para Fusion API
Lê streams RTSP/HLS, extrai frames e envia para processamento
"""

import os
import logging
import time
import asyncio
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from collections import deque
import json

import cv2
import numpy as np
import requests
from PIL import Image
from io import BytesIO

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuração via ENV
STREAM_URL = os.getenv("STREAM_URL", "rtsp://localhost:8554/entrada")
FUSION_URL = os.getenv("FUSION_URL", "http://fusion:8080")
CAMERA_ID = os.getenv("CAMERA_ID", "cam01")
PULLER_FPS = int(os.getenv("PULLER_FPS", "8"))
MAX_IMAGE_MB = float(os.getenv("MAX_IMAGE_MB", "0.5"))
MIN_FPS = int(os.getenv("MIN_FPS", "3"))
MAX_FPS = int(os.getenv("MAX_FPS", "10"))
LATENCY_THRESHOLD = float(os.getenv("LATENCY_THRESHOLD", "0.5"))  # 500ms
RECONNECT_DELAY = int(os.getenv("RECONNECT_DELAY", "5"))  # 5 segundos

class FramePuller:
    """Serviço de captura e envio de frames"""
    
    def __init__(self):
        self.current_fps = PULLER_FPS
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        
        # Métricas
        self.latency_history = deque(maxlen=50)  # Últimas 50 latências
        self.frame_count = 0
        self.success_count = 0
        self.error_count = 0
        self.start_time = time.time()
        
        # Backpressure
        self.last_fps_adjust = time.time()
        self.consecutive_slow_requests = 0
        
        logger.info(f"FramePuller initialized - Camera: {CAMERA_ID}, Stream: {STREAM_URL}")
        logger.info(f"Target FPS: {PULLER_FPS}, Max Image: {MAX_IMAGE_MB}MB")
    
    def connect_to_stream(self) -> bool:
        """Conecta ao stream de vídeo"""
        try:
            if self.cap:
                self.cap.release()
            
            logger.info(f"Connecting to stream: {STREAM_URL}")
            self.cap = cv2.VideoCapture(STREAM_URL)
            
            # Configurar buffer mínimo para reduzir latência
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            if not self.cap.isOpened():
                logger.error("Failed to open video stream")
                return False
            
            # Testar captura de frame
            ret, frame = self.cap.read()
            if not ret:
                logger.error("Failed to read frame from stream")
                return False
            
            height, width = frame.shape[:2]
            logger.info(f"Stream connected successfully - Resolution: {width}x{height}")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to stream: {e}")
            return False
    
    def frame_to_base64(self, frame: np.ndarray, quality: int = 85) -> Optional[str]:
        """Converte frame para base64 JPEG"""
        try:
            # Converter BGR para RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            # Comprimir para JPEG
            buffer = BytesIO()
            pil_img.save(buffer, format="JPEG", quality=quality, optimize=True)
            image_bytes = buffer.getvalue()
            
            # Verificar tamanho
            size_mb = len(image_bytes) / (1024 * 1024)
            if size_mb > MAX_IMAGE_MB:
                # Reduzir qualidade se muito grande
                new_quality = max(30, int(quality * 0.8))
                logger.warning(f"Image too large ({size_mb:.2f}MB), reducing quality to {new_quality}")
                return self.frame_to_base64(frame, new_quality)
            
            return base64.b64encode(image_bytes).decode()
            
        except Exception as e:
            logger.error(f"Error encoding frame: {e}")
            return None
    
    def send_frame_to_fusion(self, frame_b64: str, timestamp: float) -> bool:
        """Envia frame para Fusion API"""
        try:
            payload = {
                "camera_id": CAMERA_ID,
                "ts": timestamp,
                "jpg_b64": frame_b64,
                "max_people": 10
            }
            
            start_time = time.time()
            
            response = requests.post(
                f"{FUSION_URL}/ingest_frame",
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=2.0
            )
            
            latency = time.time() - start_time
            self.latency_history.append(latency)
            
            if response.status_code == 200:
                self.success_count += 1
                
                # Log eventos detectados
                result = response.json()
                if result.get("events"):
                    logger.info(f"Events detected: {len(result['events'])} - "
                              f"Latency: {latency:.3f}s")
                
                # Verificar backpressure
                self.handle_backpressure(latency)
                return True
                
            else:
                logger.warning(f"Fusion API error {response.status_code}: {response.text}")
                self.error_count += 1
                return False
                
        except requests.exceptions.Timeout:
            logger.warning("Request to Fusion API timed out")
            self.error_count += 1
            self.handle_backpressure(2.0)  # Considerar timeout como alta latência
            return False
            
        except Exception as e:
            logger.error(f"Error sending frame to Fusion: {e}")
            self.error_count += 1
            return False
    
    def handle_backpressure(self, latency: float):
        """Gerencia backpressure ajustando FPS"""
        now = time.time()
        
        # Só ajustar FPS a cada 10 segundos
        if now - self.last_fps_adjust < 10:
            return
        
        # Calcular latência média
        if len(self.latency_history) > 10:
            avg_latency = sum(self.latency_history) / len(self.latency_history)
            
            if avg_latency > LATENCY_THRESHOLD:
                self.consecutive_slow_requests += 1
                
                # Reduzir FPS se latência alta por vários frames
                if self.consecutive_slow_requests >= 3 and self.current_fps > MIN_FPS:
                    old_fps = self.current_fps
                    self.current_fps = max(MIN_FPS, self.current_fps - 1)
                    logger.warning(f"High latency detected ({avg_latency:.3f}s), "
                                 f"reducing FPS: {old_fps} → {self.current_fps}")
                    self.last_fps_adjust = now
                    self.consecutive_slow_requests = 0
                    
            else:
                self.consecutive_slow_requests = 0
                
                # Aumentar FPS se latência boa e não no máximo
                if avg_latency < LATENCY_THRESHOLD * 0.5 and self.current_fps < MAX_FPS:
                    old_fps = self.current_fps
                    self.current_fps = min(MAX_FPS, self.current_fps + 1)
                    logger.info(f"Low latency detected ({avg_latency:.3f}s), "
                              f"increasing FPS: {old_fps} → {self.current_fps}")
                    self.last_fps_adjust = now
    
    def print_stats(self):
        """Imprime estatísticas do serviço"""
        runtime = time.time() - self.start_time
        
        if len(self.latency_history) > 0:
            avg_latency = sum(self.latency_history) / len(self.latency_history)
            max_latency = max(self.latency_history)
        else:
            avg_latency = 0
            max_latency = 0
        
        success_rate = (self.success_count / max(1, self.frame_count)) * 100
        actual_fps = self.frame_count / max(1, runtime)
        
        logger.info(f"Stats - Runtime: {runtime:.1f}s, Frames: {self.frame_count}, "
                   f"Success: {self.success_count} ({success_rate:.1f}%), "
                   f"Errors: {self.error_count}")
        logger.info(f"FPS - Target: {self.current_fps}, Actual: {actual_fps:.1f}")
        logger.info(f"Latency - Avg: {avg_latency:.3f}s, Max: {max_latency:.3f}s")
    
    async def run(self):
        """Loop principal de captura e envio"""
        self.running = True
        logger.info("Starting frame pulling...")
        
        last_stats = time.time()
        
        while self.running:
            try:
                # Conectar ao stream se necessário
                if not self.cap or not self.cap.isOpened():
                    if not self.connect_to_stream():
                        logger.error(f"Failed to connect, retrying in {RECONNECT_DELAY}s...")
                        await asyncio.sleep(RECONNECT_DELAY)
                        continue
                
                # Calcular delay entre frames
                frame_delay = 1.0 / self.current_fps
                frame_start = time.time()
                
                # Capturar frame
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame, reconnecting...")
                    self.cap.release()
                    await asyncio.sleep(1)
                    continue
                
                self.frame_count += 1
                timestamp = time.time()
                
                # Converter para base64
                frame_b64 = self.frame_to_base64(frame)
                if not frame_b64:
                    continue
                
                # Enviar para Fusion (não bloquear)
                success = self.send_frame_to_fusion(frame_b64, timestamp)
                
                # Estatísticas periódicas
                if time.time() - last_stats > 30:  # A cada 30 segundos
                    self.print_stats()
                    last_stats = time.time()
                
                # Aguardar próximo frame
                processing_time = time.time() - frame_start
                sleep_time = max(0, frame_delay - processing_time)
                
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                
            except KeyboardInterrupt:
                logger.info("Received shutdown signal")
                break
                
            except Exception as e:
                logger.error(f"Unexpected error in main loop: {e}")
                await asyncio.sleep(1)
        
        # Limpeza
        if self.cap:
            self.cap.release()
        
        self.print_stats()
        logger.info("Frame puller stopped")
    
    def stop(self):
        """Para o serviço"""
        self.running = False

async def main():
    """Função principal"""
    logger.info("Starting Frame Puller service...")
    
    # Verificar configuração
    logger.info(f"Configuration:")
    logger.info(f"  STREAM_URL: {STREAM_URL}")
    logger.info(f"  FUSION_URL: {FUSION_URL}")
    logger.info(f"  CAMERA_ID: {CAMERA_ID}")
    logger.info(f"  PULLER_FPS: {PULLER_FPS}")
    logger.info(f"  MAX_IMAGE_MB: {MAX_IMAGE_MB}")
    
    # Testar conectividade com Fusion
    try:
        response = requests.get(f"{FUSION_URL}/health", timeout=5.0)
        if response.status_code == 200:
            logger.info("Fusion API is healthy")
        else:
            logger.warning(f"Fusion API health check failed: {response.status_code}")
    except Exception as e:
        logger.error(f"Cannot reach Fusion API: {e}")
        logger.error("Continuing anyway, will retry on frame send...")
    
    # Iniciar serviço
    puller = FramePuller()
    
    try:
        await puller.run()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    finally:
        puller.stop()

if __name__ == "__main__":
    asyncio.run(main())