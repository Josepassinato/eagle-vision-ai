# Architecture Improvements

This document outlines the unified architecture improvements implemented across all services.

## Common Schemas Package

### Overview
The `common_schemas/` package provides unified Pydantic models for all analytics services, ensuring consistency across the entire system.

### Key Components

#### Event Models
- **Signal**: Unified signal schema for all analytics (antitheft, education, safety)
- **Incident**: Standardized incident aggregation across services  
- **ZoneHit**: Spatial zone detection events
- **AffectTelemetry**: Education emotion/behavior data
- **TrackUpdate**: Object tracking updates
- **AnalyticsEvent**: Generic wrapper for all events

#### Settings Models
- **BaseServiceSettings**: Common service configuration
- **SupabaseSettings**: Database connection settings with validation
- **NotifierSettings**: Notification service configuration
- **Service-specific settings**: AntitheftSettings, FusionSettings, etc.

### Benefits
- **Consistency**: All services use identical event schemas
- **Validation**: Pydantic provides automatic config validation at startup
- **Type Safety**: Full TypeScript-like validation in Python
- **Maintainability**: Single source of truth for data models

## Security Hardening

### Dockerfile Security
All services now implement:
- **Non-root user**: All containers run as UID/GID 65532
- **Read-only filesystem**: Containers cannot write to root filesystem
- **Health checks**: Proper health endpoints with timeouts
- **Minimal dependencies**: Only required packages installed

### Docker Compose Security
Security overlay file (`docker-compose.security.yml`) provides:
- **no-new-privileges**: Prevents privilege escalation
- **cap_drop: ALL**: Removes all Linux capabilities
- **read_only: true**: Enforces read-only root filesystem
- **tmpfs mounts**: Secure temporary storage with size limits

### Usage
```bash
# Secure deployment
docker-compose -f docker-compose.yml -f docker-compose.security.yml up

# Development (less secure)
docker-compose up
```

## Configuration Management

### Pydantic Settings
Services now use validated configuration instead of `os.getenv()`:

```python
# Old approach
SUPABASE_URL = os.getenv("SUPABASE_URL")  # No validation

# New approach  
from common_schemas import SupabaseSettings
settings = SupabaseSettings()  # Validates at startup
```

### Validation Benefits
- **Fail fast**: Invalid config causes startup failure (not runtime errors)
- **Type conversion**: Automatic string-to-int/float/bool conversion
- **Required fields**: Missing environment variables detected immediately
- **URL validation**: Ensures URLs are properly formatted

## Performance Improvements

### Resource Limits
- **tmpfs**: In-memory temporary storage for better I/O
- **Size limits**: Prevents memory exhaustion attacks
- **CPU/Memory**: Defined resource constraints per service

### Monitoring
- **Health checks**: Consistent health endpoints across all services
- **Metrics**: Prometheus integration for observability
- **Logging**: Structured logging with severity levels

## Migration Guide

### For Service Developers
1. **Import common schemas**: `from common_schemas import Signal, Incident`
2. **Use settings classes**: Replace `os.getenv()` with Pydantic settings
3. **Update Dockerfiles**: Inherit from security-hardened base images
4. **Add health checks**: Implement `/health` endpoints

### For Operations
1. **Update deployment**: Use security overlay for production
2. **Monitor logs**: Check for configuration validation errors
3. **Resource planning**: Account for tmpfs memory usage
4. **Security scanning**: Verify non-root containers and capabilities

## Future Enhancements

### Planned Improvements
- **Schema versioning**: Support for backward-compatible schema evolution
- **Event sourcing**: Complete audit trail of all system events
- **Multi-tenancy**: Organization-level data isolation
- **Rate limiting**: Per-service and per-org request limits

### Observability
- **Distributed tracing**: Full request correlation across services
- **Error aggregation**: Centralized error tracking and alerting
- **Performance profiling**: Automatic bottleneck detection