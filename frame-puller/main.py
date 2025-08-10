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
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, start_http_server

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
METRICS_PORT = int(os.getenv("METRICS_PORT", "9100"))
# Resilience config
RETRY_MAX_ATTEMPTS = int(os.getenv("RETRY_MAX_ATTEMPTS", "5"))
RETRY_BASE_DELAY_MS = int(os.getenv("RETRY_BASE_DELAY_MS", "500"))
CIRCUIT_BREAKER_FAIL_THRESHOLD = float(os.getenv("CIRCUIT_BREAKER_FAIL_THRESHOLD", "0.5"))
CIRCUIT_BREAKER_OPEN_SECONDS = int(os.getenv("CIRCUIT_BREAKER_OPEN_SECONDS", "20"))

# Prometheus metrics
puller_frames_sent_total = Counter('puller_frames_sent_total', 'Total frames sent to fusion')
puller_http_errors_total = Counter('puller_http_errors_total', 'Total HTTP errors', ['status_code'])
puller_latency_seconds = Histogram('puller_latency_seconds', 'Latency of fusion requests')
puller_backpressure_fps = Gauge('puller_backpressure_fps', 'Current FPS after backpressure adjustment')
puller_connection_failures_total = Counter('puller_connection_failures_total', 'Total stream connection failures')
# Resilience metrics
service_http_failures_total = Counter('service_http_failures_total', 'HTTP failures to dependencies', ['service'])
service_http_retries_total = Counter('service_http_retries_total', 'HTTP retries to dependencies', ['service'])
circuit_breaker_open_total = Counter('circuit_breaker_open_total', 'Circuit breaker opened', ['service'])

class FramePuller:
    """Serviço de captura e envio de frames"""
    
    def __init__(self):
        self.current_fps = PULLER_FPS
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        
        # Métricas
        self.latency_history = deque(maxlen=50)  # Últimas 50 latências
        puller_backpressure_fps.set(self.current_fps)
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
            puller_connection_failures_total.inc()
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
    
def _exp_backoff_sleep(attempt: int):
    base = RETRY_BASE_DELAY_MS / 1000.0
    delay = base * (2 ** attempt)
    jitter = np.random.uniform(0, base)
    time.sleep(min(5.0, delay + jitter))

class SimpleBreaker:
    def __init__(self):
        self.state = 'closed'
        self.failures: deque = deque()
        self.open_until = 0.0

    def allow(self) -> bool:
        now = time.time()
        if self.state == 'open':
            if now >= self.open_until:
                self.state = 'half-open'
                return True
            return False
        return True

    def record(self, ok: bool):
        now = time.time()
        horizon = now - 30
        while self.failures and self.failures[0] < horizon:
            self.failures.popleft()
        self.failures.append(now if not ok else horizon)  # store timestamp only for failures
        # Compute failure rate ~ fraction of failures in window
        total = len(self.failures)
        errs = sum(1 for t in self.failures if t >= horizon)
        if total >= 4 and (errs / total) >= CIRCUIT_BREAKER_FAIL_THRESHOLD:
            self.state = 'open'
            self.open_until = now + CIRCUIT_BREAKER_OPEN_SECONDS

    def on_success(self):
        if self.state == 'half-open':
            self.state = 'closed'
        self.record(True)

    def on_failure(self):
        if self.state == 'half-open':
            self.state = 'open'
            self.open_until = time.time() + CIRCUIT_BREAKER_OPEN_SECONDS
        self.record(False)

_breaker = SimpleBreaker()

def send_frame_to_fusion(self, frame_b64: str, timestamp: float) -> bool:
    """Envia frame para Fusion API com retries e circuito"""
    service = 'fusion-ingest'
    if not _breaker.allow():
        circuit_breaker_open_total.labels(service=service).inc()
        logger.warning("Circuit open for fusion, skipping send")
        return False
    payload = {
        "camera_id": CAMERA_ID,
        "ts": timestamp,
        "jpg_b64": frame_b64,
        "max_people": 10
    }
    max_attempts = RETRY_MAX_ATTEMPTS
    for attempt in range(max_attempts):
        try:
            with puller_latency_seconds.time():
                response = requests.post(f"{FUSION_URL}/ingest_frame", json=payload, timeout=5.0)
            if response.status_code == 200:
                _breaker.on_success()
                if attempt > 0:
                    service_http_retries_total.labels(service=service).inc()
                logger.debug("Frame sent successfully")
                puller_frames_sent_total.inc()
                return True
            elif 500 <= response.status_code < 600:
                service_http_failures_total.labels(service=service).inc()
                _breaker.on_failure()
            else:
                puller_http_errors_total.labels(status_code=str(response.status_code)).inc()
                _breaker.on_failure()
                break
        except requests.exceptions.RequestException as e:
            service_http_failures_total.labels(service=service).inc()
            logger.warning(f"Error sending frame to fusion (attempt {attempt+1}/{max_attempts}): {e}")
            _breaker.on_failure()
        if attempt < max_attempts - 1:
            _exp_backoff_sleep(attempt)
    return False
    
    def handle_backpressure(self, latency: float):
        """Gerencia backpressure ajustando FPS"""
        if latency > LATENCY_THRESHOLD:
            self.current_fps = max(MIN_FPS, self.current_fps - 0.5)
        elif latency < LATENCY_THRESHOLD * 0.5:
            self.current_fps = min(MAX_FPS, self.current_fps + 0.2)
        
        if self.current_fps < MIN_FPS:
            self.current_fps = MIN_FPS
        elif self.current_fps > MAX_FPS:
            self.current_fps = MAX_FPS
            
        # Update metrics
        puller_backpressure_fps.set(self.current_fps)
        
        logger.debug(f"Backpressure: latency={latency:.3f}s, new_fps={self.current_fps}")
        self.latency_history.append(latency)
    
    async def run(self):
        """Loop principal de captura e envio"""
        self.running = True
        logger.info("Starting frame pulling...")
        
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
                
                # Enviar para Fusion
                start_time = time.time()
                success = self.send_frame_to_fusion(frame_b64, timestamp)
                latency = time.time() - start_time
                
                if success:
                    self.success_count += 1
                else:
                    self.error_count += 1
                
                # Verificar backpressure
                self.handle_backpressure(latency)
                
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
        
        logger.info("Frame puller stopped")
    
    def stop(self):
        """Para o serviço"""
        self.running = False

if __name__ == "__main__":
    # Start Prometheus metrics server
    start_http_server(METRICS_PORT)
    logger.info(f"Prometheus metrics server started on port {METRICS_PORT}")
    
    puller = FramePuller()
    
    # Health check da Fusion API antes de começar
    try:
        logger.info("Checking Fusion API health...")
        response = requests.get(f"{FUSION_URL}/health", timeout=10)
        if response.status_code == 200:
            logger.info("✅ Fusion API is healthy")
        else:
            logger.warning(f"⚠️ Fusion API returned {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Cannot reach Fusion API: {e}")
        logger.info("Continuing anyway...")
    
    try:
        asyncio.run(puller.run())
    except KeyboardInterrupt:
        logger.info("Shutting down Frame Puller...")
        puller.stop()