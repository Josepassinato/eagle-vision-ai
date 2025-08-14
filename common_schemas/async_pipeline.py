"""
Complete async pipeline with parallelization and error recovery
"""

import asyncio
import aiohttp
import time
import json
from typing import Dict, List, Any, Optional, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import logging
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from .correlation_logger import get_correlation_logger, set_correlation_context, generate_correlation_id
from .resilience import ResilienceManager, QueueConfig, CircuitBreakerConfig
from .batch_processor import BatchProcessor

logger = get_correlation_logger('async_pipeline')

class PipelineStage(Enum):
    INGESTION = "ingestion"
    PREPROCESSING = "preprocessing" 
    AI_INFERENCE = "ai_inference"
    POSTPROCESSING = "postprocessing"
    DECISION = "decision"
    OUTPUT = "output"

@dataclass
class FrameData:
    frame_id: str
    org_id: str
    camera_id: str
    timestamp: float
    frame_data: Union[np.ndarray, bytes, str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    correlation_id: Optional[str] = None
    stage_results: Dict[str, Any] = field(default_factory=dict)
    processing_stats: Dict[str, float] = field(default_factory=dict)

@dataclass 
class PipelineConfig:
    max_concurrent_frames: int = 10
    stage_timeout_seconds: float = 30.0
    retry_attempts: int = 3
    enable_batching: bool = True
    batch_size: int = 8
    queue_config: QueueConfig = field(default_factory=QueueConfig)
    circuit_breaker_config: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)

class AsyncPipelineStage:
    """Base class for pipeline stages"""
    
    def __init__(self, name: str, stage_type: PipelineStage):
        self.name = name
        self.stage_type = stage_type
        self.resilience_manager = ResilienceManager(name)
        
    async def process_single(self, frame: FrameData) -> FrameData:
        """Process a single frame - to be implemented by subclasses"""
        raise NotImplementedError
    
    async def process_batch(self, frames: List[FrameData]) -> List[FrameData]:
        """Process a batch of frames - default implementation processes sequentially"""
        results = []
        for frame in frames:
            try:
                result = await self.process_single(frame)
                results.append(result)
            except Exception as e:
                logger.error(f"Stage {self.name} failed for frame {frame.frame_id}: {str(e)}")
                # Continue with other frames in batch
                frame.metadata['error'] = str(e)
                frame.metadata['failed_stage'] = self.name
                results.append(frame)
        return results
    
    async def process(self, frames: Union[FrameData, List[FrameData]]) -> Union[FrameData, List[FrameData]]:
        """Main processing entry point"""
        is_single = isinstance(frames, FrameData)
        frame_list = [frames] if is_single else frames
        
        start_time = time.time()
        
        try:
            # Set correlation context for first frame
            if frame_list:
                set_correlation_context(
                    corr_id=frame_list[0].correlation_id,
                    org=frame_list[0].org_id,
                    camera=frame_list[0].camera_id
                )
            
            # Process using circuit breaker protection
            results = await self.resilience_manager.execute_with_circuit_breaker(
                f"{self.name}_processing",
                self._process_with_timeout,
                frame_list
            )
            
            duration_ms = (time.time() - start_time) * 1000
            
            # Log performance metrics
            logger.performance_log(
                operation=f"{self.name}_stage",
                duration_ms=duration_ms,
                frame_count=len(frame_list),
                stage=self.stage_type.value
            )
            
            # Update frame processing stats
            for frame in results:
                frame.processing_stats[self.name] = duration_ms / len(frame_list)
            
            return results[0] if is_single else results
            
        except Exception as e:
            logger.error(f"Stage {self.name} failed: {str(e)}")
            raise
    
    async def _process_with_timeout(self, frames: List[FrameData]) -> List[FrameData]:
        """Process with timeout protection"""
        try:
            # Use batch processing if multiple frames and stage supports it
            if len(frames) > 1 and hasattr(self, 'supports_batching') and self.supports_batching:
                return await asyncio.wait_for(
                    self.process_batch(frames),
                    timeout=self.resilience_manager.get_circuit_breaker(f"{self.name}_processing").config.timeout
                )
            else:
                results = []
                for frame in frames:
                    result = await asyncio.wait_for(
                        self.process_single(frame),
                        timeout=self.resilience_manager.get_circuit_breaker(f"{self.name}_processing").config.timeout
                    )
                    results.append(result)
                return results
                
        except asyncio.TimeoutError:
            raise Exception(f"Stage {self.name} timed out")

class YOLODetectionStage(AsyncPipelineStage):
    """YOLO detection stage with batch processing"""
    
    def __init__(self, yolo_service_url: str = "http://yolo-detection:8080"):
        super().__init__("yolo_detection", PipelineStage.AI_INFERENCE)
        self.yolo_service_url = yolo_service_url
        self.supports_batching = True
        self.batch_processor = BatchProcessor(
            max_batch_size=8,
            max_wait_time=0.1,
            processor_func=self._batch_detect
        )
    
    async def process_single(self, frame: FrameData) -> FrameData:
        """Process single frame through YOLO"""
        async with aiohttp.ClientSession() as session:
            # Convert frame data to base64 if needed
            if isinstance(frame.frame_data, np.ndarray):
                import cv2
                import base64
                _, buffer = cv2.imencode('.jpg', frame.frame_data)
                frame_b64 = base64.b64encode(buffer).decode('utf-8')
            else:
                frame_b64 = frame.frame_data
            
            payload = {
                'image': frame_b64,
                'camera_id': frame.camera_id,
                'org_id': frame.org_id
            }
            
            async with session.post(f"{self.yolo_service_url}/detect", json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    frame.stage_results['yolo_detections'] = result.get('detections', [])
                    frame.metadata['detection_count'] = len(result.get('detections', []))
                else:
                    raise Exception(f"YOLO detection failed: {response.status}")
        
        return frame
    
    async def process_batch(self, frames: List[FrameData]) -> List[FrameData]:
        """Process batch through YOLO service"""
        return await self.batch_processor.process_batch(frames)
    
    async def _batch_detect(self, frames: List[FrameData]) -> List[FrameData]:
        """Internal batch processing"""
        async with aiohttp.ClientSession() as session:
            batch_payload = []
            
            for frame in frames:
                # Convert frame data to base64 if needed
                if isinstance(frame.frame_data, np.ndarray):
                    import cv2
                    import base64
                    _, buffer = cv2.imencode('.jpg', frame.frame_data)
                    frame_b64 = base64.b64encode(buffer).decode('utf-8')
                else:
                    frame_b64 = frame.frame_data
                
                batch_payload.append({
                    'frame_id': frame.frame_id,
                    'image': frame_b64,
                    'camera_id': frame.camera_id,
                    'org_id': frame.org_id
                })
            
            async with session.post(f"{self.yolo_service_url}/detect_batch", json={'frames': batch_payload}) as response:
                if response.status == 200:
                    results = await response.json()
                    
                    # Match results back to frames
                    for i, frame in enumerate(frames):
                        if i < len(results.get('results', [])):
                            frame_result = results['results'][i]
                            frame.stage_results['yolo_detections'] = frame_result.get('detections', [])
                            frame.metadata['detection_count'] = len(frame_result.get('detections', []))
                else:
                    raise Exception(f"YOLO batch detection failed: {response.status}")
        
        return frames

class SafetyAnalysisStage(AsyncPipelineStage):
    """Safety analysis stage"""
    
    def __init__(self, safety_service_url: str = "http://safetyvision:8089"):
        super().__init__("safety_analysis", PipelineStage.AI_INFERENCE)
        self.safety_service_url = safety_service_url
    
    async def process_single(self, frame: FrameData) -> FrameData:
        """Process single frame for safety analysis"""
        # Only process if we have detections
        if 'yolo_detections' not in frame.stage_results:
            return frame
        
        async with aiohttp.ClientSession() as session:
            payload = {
                'frame_id': frame.frame_id,
                'detections': frame.stage_results['yolo_detections'],
                'camera_id': frame.camera_id,
                'org_id': frame.org_id,
                'timestamp': frame.timestamp
            }
            
            async with session.post(f"{self.safety_service_url}/analyze_safety", json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    frame.stage_results['safety_analysis'] = result
                    frame.metadata['safety_signals'] = len(result.get('signals', []))
                else:
                    raise Exception(f"Safety analysis failed: {response.status}")
        
        return frame

class FusionDecisionStage(AsyncPipelineStage):
    """Fusion and decision stage"""
    
    def __init__(self, fusion_service_url: str = "http://fusion:8080"):
        super().__init__("fusion_decision", PipelineStage.DECISION)
        self.fusion_service_url = fusion_service_url
    
    async def process_single(self, frame: FrameData) -> FrameData:
        """Process single frame for fusion and decision"""
        async with aiohttp.ClientSession() as session:
            payload = {
                'frame_id': frame.frame_id,
                'camera_id': frame.camera_id,
                'org_id': frame.org_id,
                'timestamp': frame.timestamp,
                'yolo_detections': frame.stage_results.get('yolo_detections', []),
                'safety_analysis': frame.stage_results.get('safety_analysis', {}),
                'processing_stats': frame.processing_stats
            }
            
            async with session.post(f"{self.fusion_service_url}/process_frame", json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    frame.stage_results['fusion_decision'] = result
                    frame.metadata['final_signals'] = len(result.get('signals', []))
                    frame.metadata['incidents'] = len(result.get('incidents', []))
                else:
                    raise Exception(f"Fusion decision failed: {response.status}")
        
        return frame

class AsyncFramePipeline:
    """Complete async frame processing pipeline"""
    
    def __init__(self, config: PipelineConfig = PipelineConfig()):
        self.config = config
        self.stages: List[AsyncPipelineStage] = []
        self.resilience_manager = ResilienceManager("frame_pipeline")
        self.semaphore = asyncio.Semaphore(config.max_concurrent_frames)
        self.is_running = False
        self.stats = {
            'frames_processed': 0,
            'frames_failed': 0,
            'avg_processing_time_ms': 0,
            'total_processing_time_ms': 0
        }
    
    def add_stage(self, stage: AsyncPipelineStage):
        """Add a processing stage to the pipeline"""
        self.stages.append(stage)
    
    async def process_frame(self, frame: FrameData) -> FrameData:
        """Process a single frame through the entire pipeline"""
        async with self.semaphore:
            start_time = time.time()
            
            try:
                # Ensure correlation ID
                if not frame.correlation_id:
                    frame.correlation_id = generate_correlation_id()
                
                # Set correlation context
                set_correlation_context(
                    corr_id=frame.correlation_id,
                    org=frame.org_id,
                    camera=frame.camera_id
                )
                
                # Process through each stage
                current_frame = frame
                for stage in self.stages:
                    try:
                        current_frame = await stage.process(current_frame)
                    except Exception as e:
                        logger.error(f"Pipeline stage {stage.name} failed for frame {frame.frame_id}: {str(e)}")
                        current_frame.metadata['failed_at_stage'] = stage.name
                        current_frame.metadata['error'] = str(e)
                        
                        # Decide whether to continue or abort
                        if stage.stage_type in [PipelineStage.AI_INFERENCE, PipelineStage.DECISION]:
                            raise  # Critical stages - abort processing
                        # Non-critical stages - continue with error marked
                
                duration_ms = (time.time() - start_time) * 1000
                current_frame.processing_stats['total_pipeline'] = duration_ms
                
                # Update stats
                self.stats['frames_processed'] += 1
                self.stats['total_processing_time_ms'] += duration_ms
                self.stats['avg_processing_time_ms'] = (
                    self.stats['total_processing_time_ms'] / self.stats['frames_processed']
                )
                
                logger.performance_log(
                    operation="complete_pipeline",
                    duration_ms=duration_ms,
                    frame_id=frame.frame_id,
                    camera_id=frame.camera_id,
                    stage_count=len(self.stages)
                )
                
                return current_frame
                
            except Exception as e:
                self.stats['frames_failed'] += 1
                logger.error(f"Pipeline processing failed for frame {frame.frame_id}: {str(e)}")
                raise
    
    async def process_frames_parallel(self, frames: List[FrameData]) -> List[FrameData]:
        """Process multiple frames in parallel"""
        tasks = []
        for frame in frames:
            task = asyncio.create_task(self.process_frame(frame))
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Separate successful results from exceptions
        successful_frames = []
        failed_frames = []
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed_frames.append((frames[i], result))
                logger.error(f"Frame {frames[i].frame_id} failed: {str(result)}")
            else:
                successful_frames.append(result)
        
        return successful_frames
    
    async def start_continuous_processing(self, frame_source: Callable[[], asyncio.AsyncIterator[FrameData]]):
        """Start continuous frame processing from a source"""
        self.is_running = True
        logger.info("Starting continuous frame processing")
        
        try:
            async for frame in frame_source():
                if not self.is_running:
                    break
                
                # Process frame asynchronously without blocking
                asyncio.create_task(self._process_frame_safe(frame))
                
        except Exception as e:
            logger.error(f"Continuous processing error: {str(e)}")
        finally:
            self.is_running = False
    
    async def _process_frame_safe(self, frame: FrameData):
        """Process frame with error isolation"""
        try:
            await self.process_frame(frame)
        except Exception as e:
            logger.error(f"Safe frame processing failed for {frame.frame_id}: {str(e)}")
    
    def stop_processing(self):
        """Stop continuous processing"""
        self.is_running = False
        logger.info("Stopping continuous frame processing")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get pipeline statistics"""
        return {
            **self.stats,
            'is_running': self.is_running,
            'active_semaphore_count': self.config.max_concurrent_frames - self.semaphore._value,
            'stage_count': len(self.stages),
            'stage_names': [stage.name for stage in self.stages]
        }

# Factory function to create a standard pipeline
def create_standard_pipeline(config: PipelineConfig = PipelineConfig()) -> AsyncFramePipeline:
    """Create a standard AI vision pipeline"""
    pipeline = AsyncFramePipeline(config)
    
    # Add standard stages
    pipeline.add_stage(YOLODetectionStage())
    pipeline.add_stage(SafetyAnalysisStage())
    pipeline.add_stage(FusionDecisionStage())
    
    return pipeline