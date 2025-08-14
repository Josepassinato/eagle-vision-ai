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
from PIL import Image
from io import BytesIO
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST, start_http_server
from common_schemas.http_resilient import ResilientHttpClient

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
# Resilient ingest config
FRAME_QUEUE_SIZE = int(os.getenv("FRAME_QUEUE_SIZE", "3"))  # Bounded queue 2-4 buffers
STREAM_HEALTH_TIMEOUT = float(os.getenv("STREAM_HEALTH_TIMEOUT", "10.0"))  # Stream stall detection

# Prometheus metrics
puller_frames_sent_total = Counter('puller_frames_sent_total', 'Total frames sent to fusion')
puller_http_errors_total = Counter('puller_http_errors_total', 'Total HTTP errors', ['status_code'])
puller_latency_seconds = Histogram('puller_latency_seconds', 'Latency of fusion requests')
puller_backpressure_fps = Gauge('puller_backpressure_fps', 'Current FPS after backpressure adjustment')
puller_connection_failures_total = Counter('puller_connection_failures_total', 'Total stream connection failures')
# Robust video ingest metrics
frame_queue_depth = Gauge('frame_queue_depth', 'Current frame queue depth', ['camera_id'])
dropped_frames_total = Counter('dropped_frames_total', 'Total dropped frames due to queue saturation', ['camera_id', 'reason'])
stream_reconnects_total = Counter('stream_reconnects_total', 'Total stream reconnections', ['camera_id', 'reason'])
stream_stall_detected_total = Counter('stream_stall_detected_total', 'Stream stall detections', ['camera_id'])

class BoundedFrameQueue:
    """Fila bounded para frames com política drop-oldest"""
    
    def __init__(self, maxsize: int = FRAME_QUEUE_SIZE):
        self.maxsize = maxsize
        self.queue = deque(maxlen=maxsize)
        self.lock = asyncio.Lock()
    
    async def put(self, item):
        async with self.lock:
            if len(self.queue) >= self.maxsize:
                # Drop oldest frame (prioriza tempo real)
                dropped = self.queue.popleft() if self.queue else None
                if dropped:
                    dropped_frames_total.labels(camera_id=CAMERA_ID, reason="queue_full").inc()
                    logger.debug(f"Dropped oldest frame due to queue saturation")
            
            self.queue.append(item)
            frame_queue_depth.labels(camera_id=CAMERA_ID).set(len(self.queue))
    
    async def get(self):
        async with self.lock:
            if not self.queue:
                return None
            item = self.queue.popleft()
            frame_queue_depth.labels(camera_id=CAMERA_ID).set(len(self.queue))
            return item
    
    def qsize(self):
        return len(self.queue)


class StreamWatchdog:
    """Watchdog para detectar stream stall"""
    
    def __init__(self, timeout: float = STREAM_HEALTH_TIMEOUT):
        self.timeout = timeout
        self.last_frame_time = time.time()
        self.stall_count = 0
    
    def update(self):
        """Atualiza timestamp do último frame"""
        self.last_frame_time = time.time()
    
    def is_stalled(self) -> bool:
        """Verifica se stream está em stall"""
        elapsed = time.time() - self.last_frame_time
        if elapsed > self.timeout:
            if self.stall_count == 0:  # Log apenas na primeira detecção
                logger.warning(f"Stream stall detected: {elapsed:.1f}s since last frame")
                stream_stall_detected_total.labels(camera_id=CAMERA_ID).inc()
            self.stall_count += 1
            return True
        
        if self.stall_count > 0:
            logger.info(f"Stream recovered after {self.stall_count} stall checks")
            self.stall_count = 0
        return False


class FramePuller:
    """Serviço de captura e envio de frames com ingestão robusta"""
    
    def __init__(self):
        self.current_fps = PULLER_FPS
        self.cap: Optional[cv2.VideoCapture] = None
        self.running = False
        
        # Robust ingest components
        self.frame_queue = BoundedFrameQueue(FRAME_QUEUE_SIZE)
        self.watchdog = StreamWatchdog(STREAM_HEALTH_TIMEOUT)
        self.http_client = ResilientHttpClient(
            timeout=1.0,
            retry_attempts=3,
            retry_base_delay=0.5
        )
        
        # Métricas
        self.latency_history = deque(maxlen=50)  # Últimas 50 latências
        puller_backpressure_fps.set(self.current_fps)
        frame_queue_depth.labels(camera_id=CAMERA_ID).set(0)
        self.frame_count = 0
        self.success_count = 0
        self.error_count = 0
        self.start_time = time.time()
        self.reconnect_count = 0
        
        # Backpressure
        self.last_fps_adjust = time.time()
        self.consecutive_slow_requests = 0
        
        logger.info(f"FramePuller initialized - Camera: {CAMERA_ID}, Stream: {STREAM_URL}")
        logger.info(f"Target FPS: {PULLER_FPS}, Queue Size: {FRAME_QUEUE_SIZE}, Max Image: {MAX_IMAGE_MB}MB")
    
    def connect_to_stream(self, reason: str = "startup") -> bool:
        """Conecta ao stream de vídeo com watchdog"""
        try:
            if self.cap:
                self.cap.release()
            
            logger.info(f"Connecting to stream: {STREAM_URL} (reason: {reason})")
            self.cap = cv2.VideoCapture(STREAM_URL)
            
            # Configurar buffer mínimo para reduzir latência
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            # Timeout para detecção de problemas
            self.cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 10000)
            self.cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000)
            
            if not self.cap.isOpened():
                logger.error("Failed to open video stream")
                stream_reconnects_total.labels(camera_id=CAMERA_ID, reason=f"open_failed_{reason}").inc()
                return False
            
            # Testar captura de frame
            ret, frame = self.cap.read()
            if not ret:
                logger.error("Failed to read frame from stream")
                stream_reconnects_total.labels(camera_id=CAMERA_ID, reason=f"read_failed_{reason}").inc()
                return False
            
            height, width = frame.shape[:2]
            self.reconnect_count += 1
            self.watchdog.update()  # Reset watchdog
            logger.info(f"Stream connected successfully - Resolution: {width}x{height} (reconnect #{self.reconnect_count})")
            return True
            
        except Exception as e:
            logger.error(f"Error connecting to stream: {e}")
            stream_reconnects_total.labels(camera_id=CAMERA_ID, reason=f"exception_{reason}").inc()
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

    async def send_frame_to_fusion(self, frame_b64: str, timestamp: float) -> bool:
        """Envia frame para Fusion API usando client resiliente"""
        payload = {
            "camera_id": CAMERA_ID,
            "ts": timestamp,
            "jpg_b64": frame_b64,
            "max_people": 10
        }
        
        try:
            with puller_latency_seconds.time():
                response = await self.http_client.post(
                    f"{FUSION_URL}/ingest_frame", 
                    json=payload
                )
            
            if response and response.get("status") == "success":
                logger.debug("Frame sent successfully")
                puller_frames_sent_total.inc()
                return True
            else:
                logger.warning(f"Fusion API returned error: {response}")
                return False
                
        except Exception as e:
            logger.warning(f"Error sending frame to fusion: {e}")
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
    
    async def capture_loop(self):
        """Loop de captura com watchdog e fila bounded"""
        logger.info("Starting capture loop...")
        
        while self.running:
            try:
                # Conectar ao stream se necessário ou detectar stall
                if not self.cap or not self.cap.isOpened() or self.watchdog.is_stalled():
                    reason = "stall" if self.watchdog.is_stalled() else "disconnected"
                    if not self.connect_to_stream(reason):
                        logger.error(f"Failed to connect, retrying in {RECONNECT_DELAY}s...")
                        await asyncio.sleep(RECONNECT_DELAY)
                        continue
                
                # Calcular delay entre frames
                frame_delay = 1.0 / self.current_fps
                frame_start = time.time()
                
                # Capturar frame
                ret, frame = self.cap.read()
                if not ret:
                    logger.warning("Failed to read frame, will reconnect...")
                    self.cap.release()
                    await asyncio.sleep(1)
                    continue
                
                # Update watchdog
                self.watchdog.update()
                self.frame_count += 1
                timestamp = time.time()
                
                # Converter para base64
                frame_b64 = self.frame_to_base64(frame)
                if not frame_b64:
                    continue
                
                # Adicionar à fila bounded
                await self.frame_queue.put({
                    'frame_b64': frame_b64,
                    'timestamp': timestamp,
                    'frame_id': self.frame_count
                })
                
                # Aguardar próximo frame
                processing_time = time.time() - frame_start
                sleep_time = max(0, frame_delay - processing_time)
                
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                
            except KeyboardInterrupt:
                logger.info("Received shutdown signal in capture loop")
                break
                
            except Exception as e:
                logger.error(f"Unexpected error in capture loop: {e}")
                await asyncio.sleep(1)
        
        logger.info("Capture loop stopped")

    async def sender_loop(self):
        """Loop de envio separado para processar fila"""
        logger.info("Starting sender loop...")
        
        while self.running:
            try:
                # Buscar frame da fila
                frame_data = await self.frame_queue.get()
                if not frame_data:
                    await asyncio.sleep(0.01)  # Small delay if queue is empty
                    continue
                
                # Enviar para Fusion
                start_time = time.time()
                success = await self.send_frame_to_fusion(
                    frame_data['frame_b64'], 
                    frame_data['timestamp']
                )
                latency = time.time() - start_time
                
                if success:
                    self.success_count += 1
                else:
                    self.error_count += 1
                
                # Verificar backpressure
                self.handle_backpressure(latency)
                
            except KeyboardInterrupt:
                logger.info("Received shutdown signal in sender loop")
                break
                
            except Exception as e:
                logger.error(f"Unexpected error in sender loop: {e}")
                await asyncio.sleep(0.1)
        
        logger.info("Sender loop stopped")

    async def run(self):
        """Loop principal com captura e envio paralelos"""
        self.running = True
        logger.info("Starting robust frame pulling...")
        
        # Start both loops concurrently
        capture_task = asyncio.create_task(self.capture_loop())
        sender_task = asyncio.create_task(self.sender_loop())
        
        try:
            await asyncio.gather(capture_task, sender_task)
        finally:
            # Limpeza
            if self.cap:
                self.cap.release()
            await self.http_client.close()
            logger.info("Frame puller stopped")
    
    def stop(self):
        """Para o serviço"""
        self.running = False

if __name__ == "__main__":
    # Start Prometheus metrics server
    start_http_server(METRICS_PORT)
    logger.info(f"Prometheus metrics server started on port {METRICS_PORT}")
    
    puller = FramePuller()
    
    # Health check da Fusion API antes de começar (async)
    async def health_check():
        try:
            logger.info("Checking Fusion API health...")
            http_client = ResilientHttpClient()
            response = await http_client.get(f"{FUSION_URL}/health")
            if response:
                logger.info("✅ Fusion API is healthy")
            else:
                logger.warning("⚠️ Fusion API health check failed")
            await http_client.close()
        except Exception as e:
            logger.error(f"❌ Cannot reach Fusion API: {e}")
            logger.info("Continuing anyway...")
    
    asyncio.run(health_check())
    
    try:
        asyncio.run(puller.run())
    except KeyboardInterrupt:
        logger.info("Shutting down Frame Puller...")
        puller.stop()