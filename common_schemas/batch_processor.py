#!/usr/bin/env python3
"""
Universal GPU Batching System - Visão de Águia
Otimiza performance de inferências através de batching inteligente
"""

import asyncio
import time
import logging
from typing import List, Dict, Any, Callable, Optional, Union
from dataclasses import dataclass, field
from collections import deque
import threading
import numpy as np
import torch
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

@dataclass
class BatchItem:
    """Item individual para processamento em batch"""
    id: str
    data: Any
    timestamp: float
    callback: Optional[Callable] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class BatchResult:
    """Resultado do processamento em batch"""
    item_id: str
    result: Any
    processing_time: float
    error: Optional[str] = None

class BatchProcessor:
    """
    Processador de batch universal para otimização GPU
    Suporta batching temporal e por tamanho com fallback automático
    """
    
    def __init__(self,
                 batch_size: int = 8,
                 max_wait_time: float = 0.05,  # 50ms
                 max_queue_size: int = 100,
                 device: str = "auto"):
        """
        Initialize batch processor
        
        Args:
            batch_size: Maximum items per batch
            max_wait_time: Maximum time to wait for batch (seconds)
            max_queue_size: Maximum queue size before dropping items
            device: Processing device ("auto", "cuda", "cpu")
        """
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self.max_queue_size = max_queue_size
        
        # Device setup
        self.device = self._setup_device(device)
        logger.info(f"BatchProcessor initialized with device: {self.device}")
        
        # Queue and processing
        self.queue = deque()
        self.results = {}
        self.processing = False
        self.executor = ThreadPoolExecutor(max_workers=2)
        
        # Statistics
        self.stats = {
            'total_items': 0,
            'total_batches': 0,
            'avg_batch_size': 0.0,
            'avg_processing_time': 0.0,
            'queue_overflows': 0
        }
        
        # Lock for thread safety
        self._lock = threading.Lock()
        
        # Start processing loop
        self._start_processing_loop()
    
    def _setup_device(self, device: str) -> str:
        """Setup processing device"""
        if device == "auto":
            if torch.cuda.is_available():
                return "cuda"
            else:
                return "cpu"
        return device
    
    def _start_processing_loop(self):
        """Start the background processing loop"""
        def processing_loop():
            while True:
                try:
                    if len(self.queue) > 0:
                        batch_items = self._collect_batch()
                        if batch_items:
                            self._process_batch(batch_items)
                    else:
                        time.sleep(0.001)  # Small sleep to prevent busy waiting
                except Exception as e:
                    logger.error(f"Error in processing loop: {e}")
                    time.sleep(0.01)
        
        self.processing_thread = threading.Thread(target=processing_loop, daemon=True)
        self.processing_thread.start()
    
    def _collect_batch(self) -> List[BatchItem]:
        """Collect items for batch processing"""
        with self._lock:
            if len(self.queue) == 0:
                return []
            
            batch_items = []
            start_time = time.time()
            
            # Collect items based on batch size or timeout
            while (len(batch_items) < self.batch_size and 
                   len(self.queue) > 0 and
                   (time.time() - start_time) < self.max_wait_time):
                
                batch_items.append(self.queue.popleft())
                
                # If we have a full batch, break immediately
                if len(batch_items) >= self.batch_size:
                    break
            
            return batch_items
    
    def _process_batch(self, batch_items: List[BatchItem]):
        """Process a batch of items"""
        if not batch_items:
            return
        
        start_time = time.time()
        
        try:
            # Group items by processing function if different
            grouped_items = self._group_by_processor(batch_items)
            
            for processor_func, items in grouped_items.items():
                results = self._run_batch_inference(processor_func, items)
                
                # Store results
                for item, result in zip(items, results):
                    processing_time = time.time() - start_time
                    batch_result = BatchResult(
                        item_id=item.id,
                        result=result,
                        processing_time=processing_time
                    )
                    
                    with self._lock:
                        self.results[item.id] = batch_result
                    
                    # Call callback if provided
                    if item.callback:
                        try:
                            item.callback(batch_result)
                        except Exception as e:
                            logger.error(f"Error in callback for item {item.id}: {e}")
            
            # Update statistics
            self._update_stats(len(batch_items), time.time() - start_time)
            
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
            
            # Mark all items as failed
            for item in batch_items:
                error_result = BatchResult(
                    item_id=item.id,
                    result=None,
                    processing_time=time.time() - start_time,
                    error=str(e)
                )
                
                with self._lock:
                    self.results[item.id] = error_result
                
                if item.callback:
                    try:
                        item.callback(error_result)
                    except Exception as callback_error:
                        logger.error(f"Error in error callback: {callback_error}")
    
    def _group_by_processor(self, batch_items: List[BatchItem]) -> Dict[Callable, List[BatchItem]]:
        """Group batch items by their processor function"""
        grouped = {}
        
        for item in batch_items:
            processor = item.metadata.get('processor')
            if processor not in grouped:
                grouped[processor] = []
            grouped[processor].append(item)
        
        return grouped
    
    def _run_batch_inference(self, processor_func: Callable, items: List[BatchItem]) -> List[Any]:
        """Run batch inference with the specified processor"""
        try:
            # Extract data from items
            batch_data = [item.data for item in items]
            
            # Run batch inference
            if processor_func:
                if self.device == "cuda" and torch.cuda.is_available():
                    with torch.cuda.amp.autocast():
                        results = processor_func(batch_data)
                else:
                    results = processor_func(batch_data)
            else:
                # Fallback: process individually
                results = [self._process_single_item(item.data) for item in items]
            
            return results
            
        except Exception as e:
            logger.error(f"Error in batch inference: {e}")
            return [None] * len(items)
    
    def _process_single_item(self, data: Any) -> Any:
        """Fallback single item processing"""
        logger.warning("Using fallback single item processing")
        return data
    
    def _update_stats(self, batch_size: int, processing_time: float):
        """Update processing statistics"""
        with self._lock:
            self.stats['total_items'] += batch_size
            self.stats['total_batches'] += 1
            
            # Update averages
            total_batches = self.stats['total_batches']
            self.stats['avg_batch_size'] = (
                (self.stats['avg_batch_size'] * (total_batches - 1) + batch_size) / total_batches
            )
            self.stats['avg_processing_time'] = (
                (self.stats['avg_processing_time'] * (total_batches - 1) + processing_time) / total_batches
            )
    
    async def add_item(self, 
                      item_id: str, 
                      data: Any, 
                      processor: Optional[Callable] = None,
                      callback: Optional[Callable] = None,
                      metadata: Optional[Dict[str, Any]] = None) -> str:
        """
        Add item to batch queue for processing
        
        Args:
            item_id: Unique identifier for the item
            data: Data to process
            processor: Processing function for this item type
            callback: Optional callback function
            metadata: Additional metadata
            
        Returns:
            str: Item ID for result retrieval
        """
        if metadata is None:
            metadata = {}
        
        metadata['processor'] = processor
        
        batch_item = BatchItem(
            id=item_id,
            data=data,
            timestamp=time.time(),
            callback=callback,
            metadata=metadata
        )
        
        with self._lock:
            if len(self.queue) >= self.max_queue_size:
                self.stats['queue_overflows'] += 1
                logger.warning(f"Queue overflow! Dropping oldest item. Queue size: {len(self.queue)}")
                self.queue.popleft()  # Drop oldest item
            
            self.queue.append(batch_item)
        
        return item_id
    
    async def get_result(self, item_id: str, timeout: float = 5.0) -> Optional[BatchResult]:
        """
        Get processing result for an item
        
        Args:
            item_id: Item identifier
            timeout: Maximum time to wait for result
            
        Returns:
            BatchResult or None if timeout
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            with self._lock:
                if item_id in self.results:
                    result = self.results.pop(item_id)
                    return result
            
            await asyncio.sleep(0.001)  # Small async sleep
        
        logger.warning(f"Timeout waiting for result of item {item_id}")
        return None
    
    def get_stats(self) -> Dict[str, Any]:
        """Get processing statistics"""
        with self._lock:
            stats = self.stats.copy()
            stats['queue_size'] = len(self.queue)
            stats['pending_results'] = len(self.results)
            stats['device'] = self.device
            return stats
    
    def clear_old_results(self, max_age: float = 300.0):
        """Clear old results to prevent memory leaks"""
        current_time = time.time()
        with self._lock:
            items_to_remove = []
            for item_id, result in self.results.items():
                if current_time - result.processing_time > max_age:
                    items_to_remove.append(item_id)
            
            for item_id in items_to_remove:
                del self.results[item_id]
            
            if items_to_remove:
                logger.info(f"Cleared {len(items_to_remove)} old results")


class YOLOBatchProcessor(BatchProcessor):
    """Specialized batch processor for YOLO detection"""
    
    def __init__(self, model, **kwargs):
        super().__init__(**kwargs)
        self.model = model
    
    def _run_batch_inference(self, processor_func: Callable, items: List[BatchItem]) -> List[Any]:
        """YOLO-specific batch inference"""
        try:
            # Stack images for batch processing
            images = []
            for item in items:
                if isinstance(item.data, np.ndarray):
                    images.append(item.data)
                else:
                    logger.warning(f"Invalid image data type for item {item.id}")
                    images.append(np.zeros((640, 640, 3), dtype=np.uint8))
            
            # Run YOLO batch inference
            if self.device == "cuda" and torch.cuda.is_available():
                with torch.cuda.amp.autocast():
                    results = self.model(images, verbose=False)
            else:
                results = self.model(images, verbose=False)
            
            # Process results
            processed_results = []
            for i, result in enumerate(results):
                boxes = []
                if result.boxes is not None:
                    for box in result.boxes:
                        cls_id = int(box.cls.item())
                        if cls_id == 0:  # person class
                            score = float(box.conf.item())
                            xyxy = box.xyxy[0].cpu().numpy().astype(int).tolist()
                            boxes.append({
                                'score': score,
                                'cls': 'person',
                                'xyxy': xyxy
                            })
                
                processed_results.append({'boxes': boxes})
            
            return processed_results
            
        except Exception as e:
            logger.error(f"Error in YOLO batch inference: {e}")
            return [{'boxes': []} for _ in items]


class FaceBatchProcessor(BatchProcessor):
    """Specialized batch processor for face recognition"""
    
    def __init__(self, face_client, **kwargs):
        super().__init__(**kwargs)
        self.face_client = face_client
    
    def _run_batch_inference(self, processor_func: Callable, items: List[BatchItem]) -> List[Any]:
        """Face recognition batch inference"""
        try:
            results = []
            
            # Process images in batch
            for item in items:
                try:
                    if 'operation' in item.metadata:
                        operation = item.metadata['operation']
                        
                        if operation == 'embed':
                            embedding = self.face_client.embed_face(item.data)
                            results.append({'embedding': embedding})
                        elif operation == 'match':
                            top_k = item.metadata.get('top_k', 5)
                            matches = self.face_client.match_face(item.data, top_k)
                            results.append({'matches': matches})
                        else:
                            results.append({'error': f'Unknown operation: {operation}'})
                    else:
                        results.append({'error': 'No operation specified'})
                        
                except Exception as e:
                    logger.error(f"Error processing face item {item.id}: {e}")
                    results.append({'error': str(e)})
            
            return results
            
        except Exception as e:
            logger.error(f"Error in face batch inference: {e}")
            return [{'error': str(e)} for _ in items]


# Global batch processor instances
_batch_processors = {}

def get_batch_processor(processor_type: str, **kwargs) -> BatchProcessor:
    """
    Get or create a batch processor instance
    
    Args:
        processor_type: Type of processor ('yolo', 'face', 'reid', 'general')
        **kwargs: Additional arguments for processor initialization
        
    Returns:
        BatchProcessor: Processor instance
    """
    if processor_type not in _batch_processors:
        if processor_type == 'yolo':
            _batch_processors[processor_type] = YOLOBatchProcessor(**kwargs)
        elif processor_type == 'face':
            _batch_processors[processor_type] = FaceBatchProcessor(**kwargs)
        else:
            _batch_processors[processor_type] = BatchProcessor(**kwargs)
    
    return _batch_processors[processor_type]


if __name__ == "__main__":
    # Test batch processor
    import asyncio
    
    async def test_batch_processor():
        print("Testing Batch Processor...")
        
        processor = BatchProcessor(batch_size=4, max_wait_time=0.1)
        
        # Add test items
        item_ids = []
        for i in range(10):
            item_id = f"test_item_{i}"
            await processor.add_item(
                item_id=item_id,
                data=f"test_data_{i}",
                metadata={'test': True}
            )
            item_ids.append(item_id)
        
        # Wait for processing
        await asyncio.sleep(0.2)
        
        # Get results
        for item_id in item_ids:
            result = await processor.get_result(item_id, timeout=1.0)
            if result:
                print(f"✓ {item_id}: {result.result} (time: {result.processing_time:.3f}s)")
            else:
                print(f"❌ {item_id}: timeout")
        
        # Print stats
        stats = processor.get_stats()
        print(f"\n📊 Stats: {stats}")
        
        print("✅ Batch processor test completed!")
    
    # Run test
    asyncio.run(test_batch_processor())