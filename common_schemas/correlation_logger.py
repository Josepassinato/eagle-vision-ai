"""
Correlation-aware structured logging for distributed tracing
"""

import logging
import json
import uuid
import time
from typing import Dict, Any, Optional
from datetime import datetime
from contextvars import ContextVar
import asyncio
from functools import wraps

# Context variables for correlation tracking
correlation_id: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)
request_id: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
org_id: ContextVar[Optional[str]] = ContextVar('org_id', default=None)
camera_id: ContextVar[Optional[str]] = ContextVar('camera_id', default=None)

class CorrelationFormatter(logging.Formatter):
    """Custom formatter that includes correlation IDs and structured data"""
    
    def format(self, record):
        # Get correlation context
        corr_id = correlation_id.get()
        req_id = request_id.get()
        org = org_id.get()
        camera = camera_id.get()
        
        # Build structured log entry
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'service': getattr(record, 'service', 'unknown'),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
            'correlation_id': corr_id,
            'request_id': req_id,
            'org_id': org,
            'camera_id': camera,
            'thread_id': record.thread,
            'process_id': record.process
        }
        
        # Add custom attributes
        for key, value in record.__dict__.items():
            if key.startswith('custom_'):
                log_data[key.replace('custom_', '')] = value
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Performance metrics if available
        if hasattr(record, 'duration_ms'):
            log_data['duration_ms'] = record.duration_ms
        if hasattr(record, 'memory_mb'):
            log_data['memory_mb'] = record.memory_mb
        
        return json.dumps(log_data, ensure_ascii=False)

def setup_correlation_logging(service_name: str, log_level: str = "INFO"):
    """Setup correlation-aware logging for a service"""
    
    # Create logger
    logger = logging.getLogger(service_name)
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Console handler with correlation formatter
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(CorrelationFormatter())
    logger.addHandler(console_handler)
    
    # File handler for structured logs
    file_handler = logging.FileHandler(f'/var/log/{service_name}.log')
    file_handler.setFormatter(CorrelationFormatter())
    logger.addHandler(file_handler)
    
    return logger

def set_correlation_context(
    corr_id: Optional[str] = None,
    req_id: Optional[str] = None,
    org: Optional[str] = None,
    camera: Optional[str] = None
):
    """Set correlation context for current async context"""
    if corr_id:
        correlation_id.set(corr_id)
    if req_id:
        request_id.set(req_id)
    if org:
        org_id.set(org)
    if camera:
        camera_id.set(camera)

def generate_correlation_id() -> str:
    """Generate new correlation ID"""
    return str(uuid.uuid4())

def generate_request_id() -> str:
    """Generate new request ID"""
    return f"req_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}"

def with_correlation(func):
    """Decorator to ensure correlation context for async functions"""
    
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        # Generate correlation ID if not present
        if not correlation_id.get():
            correlation_id.set(generate_correlation_id())
        
        # Generate request ID if not present
        if not request_id.get():
            request_id.set(generate_request_id())
        
        try:
            start_time = time.time()
            result = await func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            
            # Log successful completion
            logger = logging.getLogger(func.__module__)
            logger.info(
                f"Function {func.__name__} completed successfully",
                extra={'custom_duration_ms': duration_ms}
            )
            
            return result
            
        except Exception as e:
            # Log error with correlation context
            logger = logging.getLogger(func.__module__)
            logger.error(
                f"Function {func.__name__} failed: {str(e)}",
                exc_info=True
            )
            raise
    
    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        # Generate correlation ID if not present
        if not correlation_id.get():
            correlation_id.set(generate_correlation_id())
        
        # Generate request ID if not present
        if not request_id.get():
            request_id.set(generate_request_id())
        
        try:
            start_time = time.time()
            result = func(*args, **kwargs)
            duration_ms = (time.time() - start_time) * 1000
            
            # Log successful completion
            logger = logging.getLogger(func.__module__)
            logger.info(
                f"Function {func.__name__} completed successfully",
                extra={'custom_duration_ms': duration_ms}
            )
            
            return result
            
        except Exception as e:
            # Log error with correlation context
            logger = logging.getLogger(func.__module__)
            logger.error(
                f"Function {func.__name__} failed: {str(e)}",
                exc_info=True
            )
            raise
    
    return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper

class CorrelationLogger:
    """Enhanced logger with correlation tracking and performance metrics"""
    
    def __init__(self, service_name: str):
        self.service_name = service_name
        self.logger = setup_correlation_logging(service_name)
    
    def info(self, message: str, **kwargs):
        self.logger.info(message, extra=self._prepare_extra(**kwargs))
    
    def warning(self, message: str, **kwargs):
        self.logger.warning(message, extra=self._prepare_extra(**kwargs))
    
    def error(self, message: str, **kwargs):
        self.logger.error(message, extra=self._prepare_extra(**kwargs))
    
    def debug(self, message: str, **kwargs):
        self.logger.debug(message, extra=self._prepare_extra(**kwargs))
    
    def critical(self, message: str, **kwargs):
        self.logger.critical(message, extra=self._prepare_extra(**kwargs))
    
    def _prepare_extra(self, **kwargs) -> Dict[str, Any]:
        """Prepare extra data for logging"""
        extra = {'service': self.service_name}
        
        # Add custom attributes with custom_ prefix
        for key, value in kwargs.items():
            extra[f'custom_{key}'] = value
        
        return extra
    
    def performance_log(
        self, 
        operation: str, 
        duration_ms: float, 
        memory_mb: Optional[float] = None,
        **kwargs
    ):
        """Log performance metrics"""
        extra = {
            'custom_operation': operation,
            'custom_duration_ms': duration_ms,
            'custom_performance': True
        }
        
        if memory_mb:
            extra['custom_memory_mb'] = memory_mb
        
        for key, value in kwargs.items():
            extra[f'custom_{key}'] = value
        
        self.logger.info(
            f"Performance: {operation} completed in {duration_ms:.2f}ms",
            extra=extra
        )

# Global logger instances
_loggers: Dict[str, CorrelationLogger] = {}

def get_correlation_logger(service_name: str) -> CorrelationLogger:
    """Get or create correlation logger for service"""
    if service_name not in _loggers:
        _loggers[service_name] = CorrelationLogger(service_name)
    return _loggers[service_name]

# Convenience functions
def log_frame_processing(
    camera_id: str,
    operation: str,
    duration_ms: float,
    success: bool = True,
    **kwargs
):
    """Log frame processing with correlation context"""
    logger = get_correlation_logger('frame_processor')
    
    # Set camera context
    set_correlation_context(camera=camera_id)
    
    if success:
        logger.performance_log(
            operation=operation,
            duration_ms=duration_ms,
            camera_id=camera_id,
            **kwargs
        )
    else:
        logger.error(
            f"Frame processing failed: {operation}",
            camera_id=camera_id,
            duration_ms=duration_ms,
            **kwargs
        )

def log_ai_inference(
    model_name: str,
    duration_ms: float,
    input_shape: tuple,
    output_size: int,
    accuracy: Optional[float] = None,
    **kwargs
):
    """Log AI inference with performance metrics"""
    logger = get_correlation_logger('ai_inference')
    
    logger.performance_log(
        operation=f"inference_{model_name}",
        duration_ms=duration_ms,
        model_name=model_name,
        input_shape=str(input_shape),
        output_size=output_size,
        accuracy=accuracy,
        **kwargs
    )