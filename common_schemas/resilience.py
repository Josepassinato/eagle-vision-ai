"""
Resilience infrastructure for analytics services
"""

import asyncio
import json
import time
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import aiofiles
from collections import deque
import threading

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open" 
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    success_threshold: int = 3
    timeout: float = 30.0


@dataclass
class QueueConfig:
    max_queue_size: int = 1000
    max_queue_seconds: float = 300.0  # 5 minutes
    disk_queue_path: str = "/tmp/analytics_queue"
    batch_size: int = 10
    flush_interval: float = 5.0


class CircuitBreaker:
    """Circuit breaker with exponential backoff and jitter"""
    
    def __init__(self, name: str, config: CircuitBreakerConfig):
        self.name = name
        self.config = config
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: Optional[float] = None
        self.next_attempt_time: float = 0
        self._lock = threading.Lock()
    
    def can_execute(self) -> bool:
        with self._lock:
            now = time.time()
            
            if self.state == CircuitState.CLOSED:
                return True
            elif self.state == CircuitState.OPEN:
                if now >= self.next_attempt_time:
                    self.state = CircuitState.HALF_OPEN
                    logger.info(f"Circuit breaker {self.name} transitioning to HALF_OPEN")
                    return True
                return False
            else:  # HALF_OPEN
                return True
    
    def record_success(self):
        with self._lock:
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                if self.success_count >= self.config.success_threshold:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    self.success_count = 0
                    logger.info(f"Circuit breaker {self.name} restored to CLOSED")
            elif self.state == CircuitState.CLOSED:
                self.failure_count = max(0, self.failure_count - 1)
    
    def record_failure(self):
        with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.state == CircuitState.CLOSED:
                if self.failure_count >= self.config.failure_threshold:
                    self._open_circuit()
            elif self.state == CircuitState.HALF_OPEN:
                self._open_circuit()
    
    def _open_circuit(self):
        self.state = CircuitState.OPEN
        self.success_count = 0
        
        # Exponential backoff with jitter
        backoff = min(self.config.recovery_timeout * (2 ** min(self.failure_count - 1, 6)), 300)
        jitter = random.uniform(0.1, 0.3) * backoff
        self.next_attempt_time = time.time() + backoff + jitter
        
        logger.warning(
            f"Circuit breaker {self.name} opened. "
            f"Next attempt in {backoff + jitter:.1f}s"
        )


class ResilienceQueue:
    """Local disk queue with backpressure and TTL"""
    
    def __init__(self, name: str, config: QueueConfig):
        self.name = name
        self.config = config
        self.memory_queue: deque = deque()
        self.disk_queue_path = Path(config.disk_queue_path) / name
        self.disk_queue_path.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()
        self._background_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def enqueue(self, item: Dict[str, Any], priority: int = 0) -> bool:
        """Enqueue item with backpressure"""
        async with self._lock:
            now = time.time()
            
            # Add timestamp and priority
            queued_item = {
                'data': item,
                'timestamp': now,
                'priority': priority,
                'retries': 0
            }
            
            # Check memory queue capacity
            if len(self.memory_queue) < self.config.max_queue_size // 2:
                self.memory_queue.append(queued_item)
                return True
            
            # Fallback to disk queue
            try:
                filename = f"{now}_{priority}_{random.randint(1000, 9999)}.json"
                filepath = self.disk_queue_path / filename
                
                async with aiofiles.open(filepath, 'w') as f:
                    await f.write(json.dumps(queued_item))
                
                logger.debug(f"Item queued to disk: {filepath}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to queue item to disk: {e}")
                return False
    
    async def dequeue_batch(self) -> List[Dict[str, Any]]:
        """Dequeue batch with TTL cleanup"""
        async with self._lock:
            batch = []
            now = time.time()
            cutoff_time = now - self.config.max_queue_seconds
            
            # Process memory queue first
            while self.memory_queue and len(batch) < self.config.batch_size:
                item = self.memory_queue.popleft()
                
                if item['timestamp'] < cutoff_time:
                    logger.warning(f"Discarding expired item: {item['timestamp']}")
                    continue
                
                batch.append(item)
            
            # Load from disk if needed
            if len(batch) < self.config.batch_size:
                disk_files = sorted(self.disk_queue_path.glob("*.json"))
                
                for filepath in disk_files[:self.config.batch_size - len(batch)]:
                    try:
                        async with aiofiles.open(filepath, 'r') as f:
                            content = await f.read()
                            item = json.loads(content)
                        
                        if item['timestamp'] < cutoff_time:
                            await aiofiles.os.remove(filepath)
                            logger.warning(f"Discarding expired disk item: {filepath}")
                            continue
                        
                        batch.append(item)
                        await aiofiles.os.remove(filepath)
                        
                    except Exception as e:
                        logger.error(f"Failed to load disk item {filepath}: {e}")
                        await aiofiles.os.remove(filepath)
            
            return batch
    
    async def start_background_processing(self, processor: Callable):
        """Start background queue processing"""
        if self._running:
            return
        
        self._running = True
        self._background_task = asyncio.create_task(
            self._process_queue(processor)
        )
    
    async def stop_background_processing(self):
        """Stop background processing"""
        self._running = False
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
    
    async def _process_queue(self, processor: Callable):
        """Background queue processor"""
        while self._running:
            try:
                batch = await self.dequeue_batch()
                if batch:
                    await processor(batch)
                else:
                    await asyncio.sleep(self.config.flush_interval)
                    
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(self.config.flush_interval)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        disk_files = list(self.disk_queue_path.glob("*.json"))
        
        return {
            'memory_queue_size': len(self.memory_queue),
            'disk_queue_size': len(disk_files),
            'total_queued': len(self.memory_queue) + len(disk_files),
            'queue_path': str(self.disk_queue_path)
        }


class CameraHealthMonitor:
    """Monitor camera health and publish to Supabase"""
    
    def __init__(self, supabase_client, update_interval: float = 30.0):
        self.supabase = supabase_client
        self.update_interval = update_interval
        self.camera_stats: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._background_task: Optional[asyncio.Task] = None
        self._running = False
    
    def update_camera_stats(self, camera_id: str, stats: Dict[str, Any]):
        """Update camera statistics"""
        with self._lock:
            now = datetime.utcnow()
            
            if camera_id not in self.camera_stats:
                self.camera_stats[camera_id] = {
                    'camera_id': camera_id,
                    'online': True,
                    'last_frame_at': now,
                    'frames_processed': 0,
                    'errors_count': 0,
                    'avg_latency_ms': 0,
                    'circuit_breaker_state': 'closed'
                }
            
            self.camera_stats[camera_id].update(stats)
            self.camera_stats[camera_id]['last_frame_at'] = now
    
    def record_camera_error(self, camera_id: str, error: str):
        """Record camera error"""
        with self._lock:
            if camera_id in self.camera_stats:
                self.camera_stats[camera_id]['errors_count'] += 1
                self.camera_stats[camera_id]['last_error'] = error
                self.camera_stats[camera_id]['last_error_at'] = datetime.utcnow()
    
    async def start_monitoring(self):
        """Start health monitoring"""
        if self._running:
            return
        
        self._running = True
        self._background_task = asyncio.create_task(self._monitor_loop())
    
    async def stop_monitoring(self):
        """Stop health monitoring"""
        self._running = False
        if self._background_task:
            self._background_task.cancel()
            try:
                await self._background_task
            except asyncio.CancelledError:
                pass
    
    async def _monitor_loop(self):
        """Background monitoring loop"""
        while self._running:
            try:
                await self._update_database()
                await asyncio.sleep(self.update_interval)
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(self.update_interval)
    
    async def _update_database(self):
        """Update camera health in database"""
        with self._lock:
            cameras_to_update = []
            now = datetime.utcnow()
            
            for camera_id, stats in self.camera_stats.items():
                # Determine if camera is online
                last_frame = stats.get('last_frame_at', now)
                is_online = (now - last_frame).total_seconds() < 60
                
                camera_update = {
                    'id': camera_id,
                    'online': is_online,
                    'last_seen': last_frame.isoformat(),
                    'metadata': {
                        'frames_processed': stats.get('frames_processed', 0),
                        'errors_count': stats.get('errors_count', 0),
                        'avg_latency_ms': stats.get('avg_latency_ms', 0),
                        'circuit_breaker_state': stats.get('circuit_breaker_state', 'closed'),
                        'last_error': stats.get('last_error'),
                        'last_error_at': stats.get('last_error_at').isoformat() if stats.get('last_error_at') else None
                    }
                }
                cameras_to_update.append(camera_update)
        
        # Batch update cameras
        if cameras_to_update:
            try:
                for camera in cameras_to_update:
                    result = await self.supabase.table('cameras').upsert(camera).execute()
                    if result.data:
                        logger.debug(f"Updated camera health: {camera['id']}")
                        
            except Exception as e:
                logger.error(f"Failed to update camera health: {e}")


class ResilienceManager:
    """Central resilience manager for all services"""
    
    def __init__(self, service_name: str, supabase_client=None):
        self.service_name = service_name
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.queues: Dict[str, ResilienceQueue] = {}
        self.health_monitor = CameraHealthMonitor(supabase_client) if supabase_client else None
        
    def get_circuit_breaker(self, name: str, config: Optional[CircuitBreakerConfig] = None) -> CircuitBreaker:
        """Get or create circuit breaker"""
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker(
                name, config or CircuitBreakerConfig()
            )
        return self.circuit_breakers[name]
    
    def get_queue(self, name: str, config: Optional[QueueConfig] = None) -> ResilienceQueue:
        """Get or create resilience queue"""
        if name not in self.queues:
            queue_config = config or QueueConfig()
            queue_config.disk_queue_path = f"/tmp/{self.service_name}_queue"
            self.queues[name] = ResilienceQueue(name, queue_config)
        return self.queues[name]
    
    async def execute_with_circuit_breaker(
        self, 
        circuit_name: str, 
        operation: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute operation with circuit breaker protection"""
        circuit = self.get_circuit_breaker(circuit_name)
        
        if not circuit.can_execute():
            raise Exception(f"Circuit breaker {circuit_name} is open")
        
        try:
            result = await operation(*args, **kwargs)
            circuit.record_success()
            return result
            
        except Exception as e:
            circuit.record_failure()
            if self.health_monitor:
                camera_id = kwargs.get('camera_id') or args[0] if args else circuit_name
                self.health_monitor.record_camera_error(camera_id, str(e))
            raise
    
    async def start_all(self):
        """Start all resilience components"""
        if self.health_monitor:
            await self.health_monitor.start_monitoring()
    
    async def stop_all(self):
        """Stop all resilience components"""
        for queue in self.queues.values():
            await queue.stop_background_processing()
        
        if self.health_monitor:
            await self.health_monitor.stop_monitoring()
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system resilience statistics"""
        stats = {
            'service_name': self.service_name,
            'circuit_breakers': {},
            'queues': {}
        }
        
        for name, circuit in self.circuit_breakers.items():
            stats['circuit_breakers'][name] = {
                'state': circuit.state.value,
                'failure_count': circuit.failure_count,
                'success_count': circuit.success_count
            }
        
        for name, queue in self.queues.items():
            stats['queues'][name] = queue.get_stats()
        
        return stats