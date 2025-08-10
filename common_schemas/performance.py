"""
GPU optimization and performance utilities
"""

import os
import logging
import psutil
from typing import Dict, Any, Optional
import threading

logger = logging.getLogger(__name__)


class PerformanceOptimizer:
    """GPU and CPU performance optimization"""
    
    def __init__(self):
        self.gpu_available = self._check_gpu_availability()
        self.cpu_count = psutil.cpu_count()
        self.memory_gb = psutil.virtual_memory().total / (1024**3)
        self._optimization_applied = False
    
    def apply_optimizations(self, service_type: str = "general"):
        """Apply performance optimizations based on hardware"""
        
        if self._optimization_applied:
            return
        
        logger.info(f"Applying optimizations for {service_type}")
        logger.info(f"GPU available: {self.gpu_available}")
        logger.info(f"CPU cores: {self.cpu_count}")
        logger.info(f"Memory: {self.memory_gb:.1f}GB")
        
        # CPU optimizations
        self._optimize_cpu(service_type)
        
        # GPU optimizations
        if self.gpu_available:
            self._optimize_gpu(service_type)
        
        self._optimization_applied = True
    
    def _check_gpu_availability(self) -> bool:
        """Check if CUDA GPU is available"""
        try:
            import subprocess
            result = subprocess.run(['nvidia-smi'], capture_output=True, text=True)
            return result.returncode == 0
        except:
            return False
    
    def _optimize_cpu(self, service_type: str):
        """Apply CPU optimizations"""
        
        # Set OpenMP threads for better latency
        if service_type in ["fusion", "yolo", "face", "reid"]:
            # For real-time services, use fewer threads to reduce jitter
            omp_threads = max(1, self.cpu_count // 4)
        else:
            # For batch services, use more threads
            omp_threads = max(1, self.cpu_count // 2)
        
        os.environ['OMP_NUM_THREADS'] = str(omp_threads)
        os.environ['OPENBLAS_NUM_THREADS'] = str(omp_threads)
        os.environ['MKL_NUM_THREADS'] = str(omp_threads)
        os.environ['NUMEXPR_NUM_THREADS'] = str(omp_threads)
        
        # OpenCV threads for video processing
        try:
            import cv2
            cv2.setNumThreads(1 if service_type in ["fusion", "yolo"] else 2)
            logger.info(f"Set OpenCV threads: {cv2.getNumThreads()}")
        except ImportError:
            pass
        
        logger.info(f"Set OMP threads: {omp_threads}")
    
    def _optimize_gpu(self, service_type: str):
        """Apply GPU optimizations"""
        
        # CUDA optimizations
        os.environ['CUDA_VISIBLE_DEVICES'] = '0'  # Use first GPU
        
        # Memory optimizations
        if service_type in ["yolo", "face", "reid"]:
            # For AI inference services
            os.environ['CUDA_CACHE_DISABLE'] = '0'
            os.environ['CUDA_CACHE_MAXSIZE'] = '2147483648'  # 2GB cache
        
        # TensorRT optimizations for ONNX
        if service_type in ["reid", "face"]:
            os.environ['ORT_TENSORRT_FP16_ENABLE'] = '1'
            os.environ['ORT_TENSORRT_ENGINE_CACHE_ENABLE'] = '1'
            os.environ['ORT_TENSORRT_CACHE_PATH'] = '/tmp/tensorrt_cache'
        
        logger.info("Applied GPU optimizations")
    
    def get_optimal_batch_size(self, service_type: str) -> int:
        """Get optimal batch size based on hardware"""
        
        if not self.gpu_available:
            return 1
        
        # Estimate based on memory and service type
        if service_type == "yolo":
            return min(4, max(1, int(self.memory_gb // 2)))
        elif service_type == "face":
            return min(8, max(1, int(self.memory_gb // 1)))
        elif service_type == "reid":
            return min(16, max(1, int(self.memory_gb // 0.5)))
        else:
            return 1
    
    def get_device_config(self, service_type: str) -> Dict[str, Any]:
        """Get device configuration for the service"""
        
        config = {
            'device': 'cuda' if self.gpu_available else 'cpu',
            'batch_size': self.get_optimal_batch_size(service_type),
            'num_workers': max(1, self.cpu_count // 4),
            'pin_memory': self.gpu_available,
            'precision': 'fp16' if self.gpu_available else 'fp32'
        }
        
        return config


class ONNXOptimizer:
    """ONNX Runtime optimization"""
    
    def __init__(self, gpu_available: bool = False):
        self.gpu_available = gpu_available
    
    def get_session_options(self, service_type: str):
        """Get optimized ONNX session options"""
        try:
            import onnxruntime as ort
            
            session_options = ort.SessionOptions()
            
            # Optimization level
            session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            # Threading
            if service_type in ["fusion", "yolo"]:
                # Real-time services: fewer threads for lower latency
                session_options.intra_op_num_threads = 1
                session_options.inter_op_num_threads = 1
            else:
                # Batch services: more threads for throughput
                session_options.intra_op_num_threads = psutil.cpu_count() // 2
                session_options.inter_op_num_threads = 2
            
            # Memory optimization
            session_options.enable_mem_pattern = True
            session_options.enable_cpu_mem_arena = True
            
            return session_options
            
        except ImportError:
            logger.warning("ONNX Runtime not available")
            return None
    
    def get_providers(self, service_type: str) -> list:
        """Get optimized execution providers"""
        
        providers = []
        
        if self.gpu_available:
            # GPU providers
            if service_type in ["reid", "face"]:
                # TensorRT for heavy inference
                providers.append(('TensorrtExecutionProvider', {
                    'trt_fp16_enable': True,
                    'trt_engine_cache_enable': True,
                    'trt_engine_cache_path': '/tmp/tensorrt_cache'
                }))
            
            # CUDA provider
            providers.append(('CUDAExecutionProvider', {
                'cudnn_conv_use_max_workspace': '1',
                'do_copy_in_default_stream': True,
            }))
        
        # CPU provider (fallback)
        providers.append('CPUExecutionProvider')
        
        return providers


class ResourceMonitor:
    """Monitor resource usage during processing"""
    
    def __init__(self):
        self.stats = {
            'cpu_percent': 0.0,
            'memory_percent': 0.0,
            'memory_used_gb': 0.0,
            'gpu_memory_used_mb': 0.0,
            'gpu_utilization': 0.0
        }
        self._monitoring = False
        self._monitor_thread: Optional[threading.Thread] = None
    
    def start_monitoring(self, interval: float = 1.0):
        """Start resource monitoring"""
        if self._monitoring:
            return
        
        self._monitoring = True
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            args=(interval,),
            daemon=True
        )
        self._monitor_thread.start()
    
    def stop_monitoring(self):
        """Stop resource monitoring"""
        self._monitoring = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=1.0)
    
    def _monitor_loop(self, interval: float):
        """Resource monitoring loop"""
        while self._monitoring:
            try:
                # CPU and memory
                self.stats['cpu_percent'] = psutil.cpu_percent()
                memory = psutil.virtual_memory()
                self.stats['memory_percent'] = memory.percent
                self.stats['memory_used_gb'] = memory.used / (1024**3)
                
                # GPU stats (if available)
                try:
                    import pynvml
                    pynvml.nvmlInit()
                    handle = pynvml.nvmlDeviceGetHandleByIndex(0)
                    
                    # GPU memory
                    mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)
                    self.stats['gpu_memory_used_mb'] = mem_info.used / (1024**2)
                    
                    # GPU utilization
                    util = pynvml.nvmlDeviceGetUtilizationRates(handle)
                    self.stats['gpu_utilization'] = util.gpu
                    
                except:
                    pass
                
            except Exception as e:
                logger.error(f"Resource monitoring error: {e}")
            
            threading.Event().wait(interval)
    
    def get_stats(self) -> Dict[str, float]:
        """Get current resource statistics"""
        return self.stats.copy()
    
    def is_overloaded(self) -> bool:
        """Check if system is overloaded"""
        return (
            self.stats['cpu_percent'] > 90 or
            self.stats['memory_percent'] > 90 or
            self.stats['gpu_utilization'] > 95
        )


# Global optimizer instance
_optimizer = None

def get_optimizer() -> PerformanceOptimizer:
    """Get global performance optimizer"""
    global _optimizer
    if _optimizer is None:
        _optimizer = PerformanceOptimizer()
    return _optimizer

def apply_service_optimizations(service_type: str):
    """Apply optimizations for specific service type"""
    optimizer = get_optimizer()
    optimizer.apply_optimizations(service_type)