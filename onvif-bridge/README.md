# ONVIF Bridge Service

ONVIF bridge service for Eagle Vision that provides camera discovery, profile management, streaming configuration, and PTZ control.

## Features

### Discovery & Detection
- **Network Scanning**: Automatic discovery of ONVIF cameras on local networks
- **Nmap Integration**: Port scanning for common camera ports (80, 8080, 554, 8000, 443, 8443)
- **Auto Network Detection**: Automatically detects local network ranges to scan
- **ONVIF Validation**: Tests ONVIF connectivity and compatibility

### Camera Profiles
- **Device Information**: Manufacturer, model, firmware, serial number
- **Stream Profiles**: Video encoding, resolution, framerate, bitrate
- **RTSP URIs**: Direct streaming endpoints for each profile
- **Capabilities**: Device, events, imaging, media, PTZ support detection

### Authentication & Security
- **Credential Testing**: Validate camera username/password combinations
- **Authenticated Sessions**: Maintain authenticated ONVIF connections
- **Connection Caching**: Cache authenticated cameras for efficient reuse

### PTZ Control
- **Movement Commands**: Up, down, left, right, zoom in/out, stop
- **Preset Management**: Goto, set, and remove PTZ presets
- **Speed Control**: Configurable movement speed (0.0-1.0)
- **Duration Control**: Auto-stop after specified duration

### Monitoring & Resilience
- **Prometheus Metrics**: Discovery duration, connection counts, PTZ commands
- **Circuit Breakers**: Resilient connection handling
- **Health Checks**: Service health and status monitoring
- **Correlation Logging**: Request tracing and debugging

## API Endpoints

### Discovery
```bash
# Discover cameras on network
POST /discover
{
  "network_range": "192.168.1.0/24",  # optional, auto-detects if not provided
  "timeout": 10,                      # discovery timeout in seconds
  "include_profiles": false           # whether to fetch detailed profiles
}

# Get cached discovery results
GET /discovered_cache
```

### Connection Testing
```bash
# Test camera connection and authentication
POST /test_connection
{
  "ip": "192.168.1.100",
  "port": 80,
  "credentials": {
    "username": "admin",
    "password": "password"
  }
}
```

### Profile Management
```bash
# Get detailed camera profiles
POST /get_profiles
{
  "ip": "192.168.1.100",
  "port": 80,
  "credentials": {
    "username": "admin",
    "password": "password"
  }
}
```

### PTZ Control
```bash
# Control PTZ movement
POST /ptz_control
{
  "ip": "192.168.1.100",
  "credentials": {
    "username": "admin",
    "password": "password"
  },
  "command": "move_up",    # move_up, move_down, move_left, move_right, zoom_in, zoom_out, stop
  "speed": 0.5,           # 0.0 to 1.0
  "duration": 2.0         # auto-stop after seconds
}

# Manage PTZ presets
POST /ptz_preset
{
  "ip": "192.168.1.100",
  "credentials": {
    "username": "admin",
    "password": "password"
  },
  "action": "goto",           # goto, set, remove
  "preset_token": "preset1",  # for goto/remove
  "preset_name": "Home"       # for set
}
```

### Cache Management
```bash
# Clear discovery and authentication cache
DELETE /clear_cache
```

## Configuration

### Environment Variables
```bash
# Network discovery
ONVIF_DISCOVERY_TIMEOUT=10        # Discovery timeout in seconds
NETWORK_SCAN_RANGE=auto           # Network range to scan (auto or CIDR)
DEFAULT_ONVIF_PORT=80             # Default ONVIF port to test

# Connection settings
ONVIF_CONNECTION_TIMEOUT=5        # Camera connection timeout

# CORS
ALLOWED_ORIGINS=https://panel.inigrai.com
```

### Network Configuration
- **Auto Detection**: Service automatically detects local network interfaces and ranges
- **Manual Override**: Set `NETWORK_SCAN_RANGE` to specific CIDR (e.g., "192.168.1.0/24")
- **Multiple Ranges**: Service scans all detected network ranges by default

## Docker Deployment

```bash
# Build container
docker build -t onvif-bridge .

# Run service
docker run -d \
  --name onvif-bridge \
  --network host \
  -e ALLOWED_ORIGINS=https://panel.inigrai.com \
  -e ONVIF_DISCOVERY_TIMEOUT=15 \
  -p 8097:8097 \
  onvif-bridge
```

**Note**: `--network host` is recommended for proper network discovery on the local subnet.

## Integration

### With Eagle Vision
The ONVIF bridge integrates with Eagle Vision's camera management system:

1. **Discovery Phase**: Scan network for ONVIF cameras
2. **Authentication**: Test credentials and validate access
3. **Profile Setup**: Configure stream profiles and capabilities
4. **Integration**: Add cameras to Eagle Vision monitoring system

### Stream Configuration
```json
{
  "camera_id": "cam_001",
  "ip": "192.168.1.100",
  "rtsp_uri": "rtsp://192.168.1.100:554/stream1",
  "profile": {
    "encoding": "H264",
    "resolution": "1920x1080",
    "framerate": 25,
    "bitrate": 4000000
  },
  "credentials": {
    "username": "admin",
    "password": "password"
  }
}
```

## Security Considerations

### Network Security
- Service requires network access to scan and connect to cameras
- Use VPN or isolated networks for camera management
- Limit network ranges to prevent unauthorized scanning

### Credential Management
- Credentials are passed in requests but not stored persistently
- Use strong camera passwords and change default credentials
- Consider implementing credential encryption for production

### Access Control
- Implement authentication for production deployments
- Use CORS configuration to limit frontend access
- Monitor and log all discovery and control activities

## Troubleshooting

### Common Issues

**No cameras discovered**:
- Check network connectivity and ranges
- Verify cameras are powered and connected
- Ensure ONVIF is enabled on cameras
- Check firewall rules for scanning ports

**Authentication failures**:
- Verify username/password combinations
- Check camera ONVIF user permissions
- Ensure cameras allow multiple connections
- Test with camera's web interface first

**PTZ not working**:
- Verify camera has PTZ capabilities
- Check PTZ is enabled in camera settings
- Ensure user has PTZ control permissions
- Test PTZ with camera's web interface

### Monitoring
```bash
# Check service health
curl http://localhost:8097/health

# View metrics
curl http://localhost:8097/metrics

# Check discovered cameras
curl http://localhost:8097/discovered_cache
```

## Development

### Requirements
- Python 3.11+
- python-onvif-zeep
- nmap
- netifaces
- FastAPI
- Docker (for containerization)

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Run service
python main.py

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8097
```

### Testing
```bash
# Test discovery
curl -X POST http://localhost:8097/discover \
  -H "Content-Type: application/json" \
  -d '{"timeout": 10}'

# Test specific camera
curl -X POST http://localhost:8097/test_connection \
  -H "Content-Type: application/json" \
  -d '{
    "ip": "192.168.1.100",
    "credentials": {
      "username": "admin",
      "password": "password"
    }
  }'
```