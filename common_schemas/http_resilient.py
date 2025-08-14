"""
HTTP resilient client with circuit breaker, retry, and correlation tracking
"""

import asyncio
import time
import random
from typing import Dict, Any, Optional, List, Union
from contextlib import asynccontextmanager
import httpx
from .resilience import CircuitBreaker, CircuitBreakerConfig
from .correlation_logger import (
    correlation_id, request_id, org_id, camera_id,
    generate_correlation_id, generate_request_id,
    get_correlation_logger
)

logger = get_correlation_logger('http_client')


class RetryConfig:
    """Configuration for HTTP retry logic"""
    
    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 0.5,
        max_delay: float = 5.0,
        jitter: bool = True,
        retry_status_codes: List[int] = None
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter
        self.retry_status_codes = retry_status_codes or [429, 502, 503, 504]


class ResilientHTTPClient:
    """HTTP client with circuit breaker, retry, and correlation tracking"""
    
    def __init__(
        self,
        service_name: str,
        base_timeout: float = 1.0,
        circuit_config: Optional[CircuitBreakerConfig] = None,
        retry_config: Optional[RetryConfig] = None
    ):
        self.service_name = service_name
        self.base_timeout = base_timeout
        self.retry_config = retry_config or RetryConfig()
        
        # Circuit breakers per host
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.circuit_config = circuit_config or CircuitBreakerConfig(
            failure_threshold=3,
            recovery_timeout=30.0,
            success_threshold=2,
            timeout=base_timeout
        )
        
        # HTTP client with default configuration
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(base_timeout),
            limits=httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100
            ),
            headers={
                'User-Agent': f'{service_name}/1.0',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        )
    
    def _get_host_from_url(self, url: str) -> str:
        """Extract host from URL for circuit breaker grouping"""
        try:
            import urllib.parse
            parsed = urllib.parse.urlparse(url)
            return f"{parsed.scheme}://{parsed.netloc}"
        except Exception:
            return url
    
    def _get_circuit_breaker(self, host: str) -> CircuitBreaker:
        """Get or create circuit breaker for host"""
        if host not in self.circuit_breakers:
            self.circuit_breakers[host] = CircuitBreaker(
                name=f"{self.service_name}_{host}",
                config=self.circuit_config
            )
        return self.circuit_breakers[host]
    
    def _prepare_headers(self, headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Prepare headers with correlation IDs"""
        prepared_headers = {}
        
        # Add correlation headers
        corr_id = correlation_id.get()
        if not corr_id:
            corr_id = generate_correlation_id()
            correlation_id.set(corr_id)
        
        req_id = request_id.get()
        if not req_id:
            req_id = generate_request_id()
            request_id.set(req_id)
        
        prepared_headers.update({
            'X-Correlation-ID': corr_id,
            'X-Request-ID': req_id,
            'X-Service-Name': self.service_name
        })
        
        # Add context headers
        if org_id.get():
            prepared_headers['X-Org-ID'] = org_id.get()
        if camera_id.get():
            prepared_headers['X-Camera-ID'] = camera_id.get()
        
        # Merge with provided headers
        if headers:
            prepared_headers.update(headers)
        
        return prepared_headers
    
    async def _retry_with_backoff(self, operation, *args, **kwargs):
        """Execute operation with exponential backoff retry"""
        last_exception = None
        
        for attempt in range(self.retry_config.max_retries + 1):
            try:
                return await operation(*args, **kwargs)
                
            except httpx.HTTPStatusError as e:
                if e.response.status_code not in self.retry_config.retry_status_codes:
                    raise
                last_exception = e
                
            except (httpx.ConnectError, httpx.TimeoutException) as e:
                last_exception = e
            
            # Don't wait after the last attempt
            if attempt < self.retry_config.max_retries:
                delay = min(
                    self.retry_config.base_delay * (2 ** attempt),
                    self.retry_config.max_delay
                )
                
                if self.retry_config.jitter:
                    delay += random.uniform(0, delay * 0.1)
                
                logger.warning(
                    f"Request failed, retrying in {delay:.2f}s (attempt {attempt + 1})",
                    attempt=attempt + 1,
                    delay=delay,
                    error=str(last_exception)
                )
                
                await asyncio.sleep(delay)
        
        # All retries exhausted
        raise last_exception
    
    async def request(
        self,
        method: str,
        url: str,
        headers: Optional[Dict[str, str]] = None,
        json: Optional[Dict[str, Any]] = None,
        data: Optional[Union[str, bytes]] = None,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
        **kwargs
    ) -> httpx.Response:
        """Make HTTP request with circuit breaker and retry"""
        host = self._get_host_from_url(url)
        circuit = self._get_circuit_breaker(host)
        
        # Check circuit breaker
        if not circuit.can_execute():
            logger.error(
                f"Circuit breaker open for {host}",
                host=host,
                circuit_state=circuit.state.value
            )
            raise httpx.ConnectError(f"Circuit breaker open for {host}")
        
        # Prepare headers with correlation IDs
        prepared_headers = self._prepare_headers(headers)
        request_timeout = timeout or self.base_timeout
        
        start_time = time.time()
        
        try:
            # Execute request with retry
            response = await self._retry_with_backoff(
                self.client.request,
                method=method,
                url=url,
                headers=prepared_headers,
                json=json,
                data=data,
                params=params,
                timeout=request_timeout,
                **kwargs
            )
            
            duration_ms = (time.time() - start_time) * 1000
            
            # Log successful request
            logger.info(
                f"{method} {url} -> {response.status_code}",
                method=method,
                url=url,
                status_code=response.status_code,
                duration_ms=duration_ms,
                response_size=len(response.content) if response.content else 0
            )
            
            # Record success in circuit breaker
            circuit.record_success()
            
            return response
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            
            # Log failed request
            logger.error(
                f"{method} {url} failed: {str(e)}",
                method=method,
                url=url,
                duration_ms=duration_ms,
                error=str(e),
                error_type=type(e).__name__
            )
            
            # Record failure in circuit breaker
            circuit.record_failure()
            
            raise
    
    async def get(self, url: str, **kwargs) -> httpx.Response:
        """GET request"""
        return await self.request('GET', url, **kwargs)
    
    async def post(self, url: str, **kwargs) -> httpx.Response:
        """POST request"""
        return await self.request('POST', url, **kwargs)
    
    async def put(self, url: str, **kwargs) -> httpx.Response:
        """PUT request"""
        return await self.request('PUT', url, **kwargs)
    
    async def delete(self, url: str, **kwargs) -> httpx.Response:
        """DELETE request"""
        return await self.request('DELETE', url, **kwargs)
    
    async def patch(self, url: str, **kwargs) -> httpx.Response:
        """PATCH request"""
        return await self.request('PATCH', url, **kwargs)
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()
    
    @asynccontextmanager
    async def stream(self, method: str, url: str, **kwargs):
        """Stream response"""
        headers = self._prepare_headers(kwargs.pop('headers', None))
        
        async with self.client.stream(method, url, headers=headers, **kwargs) as response:
            yield response
    
    def get_circuit_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get circuit breaker statistics"""
        stats = {}
        for host, circuit in self.circuit_breakers.items():
            stats[host] = {
                'state': circuit.state.value,
                'failure_count': circuit.failure_count,
                'success_count': circuit.success_count,
                'last_failure_time': circuit.last_failure_time,
                'next_attempt_time': circuit.next_attempt_time
            }
        return stats


# Global HTTP client instances
_http_clients: Dict[str, ResilientHTTPClient] = {}


def get_http_client(
    service_name: str,
    base_timeout: float = 1.0,
    circuit_config: Optional[CircuitBreakerConfig] = None,
    retry_config: Optional[RetryConfig] = None
) -> ResilientHTTPClient:
    """Get or create resilient HTTP client for service"""
    if service_name not in _http_clients:
        _http_clients[service_name] = ResilientHTTPClient(
            service_name=service_name,
            base_timeout=base_timeout,
            circuit_config=circuit_config,
            retry_config=retry_config
        )
    return _http_clients[service_name]


async def close_all_clients():
    """Close all HTTP clients"""
    for client in _http_clients.values():
        await client.close()
    _http_clients.clear()


# Convenience functions for common operations
async def resilient_post_json(
    service_name: str,
    url: str,
    data: Dict[str, Any],
    timeout: float = 1.0,
    **kwargs
) -> Dict[str, Any]:
    """Make resilient POST request and return JSON response"""
    client = get_http_client(service_name, base_timeout=timeout)
    
    response = await client.post(url, json=data, **kwargs)
    response.raise_for_status()
    
    return response.json()


async def resilient_get_json(
    service_name: str,
    url: str,
    timeout: float = 1.0,
    **kwargs
) -> Dict[str, Any]:
    """Make resilient GET request and return JSON response"""
    client = get_http_client(service_name, base_timeout=timeout)
    
    response = await client.get(url, **kwargs)
    response.raise_for_status()
    
    return response.json()