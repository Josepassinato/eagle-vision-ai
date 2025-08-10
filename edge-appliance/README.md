# Edge Appliance Deployment Guide

## Overview
The Edge Appliance provides a plug-and-play local solution where video processing happens on-site. Only metadata and on-demand clips are uploaded to the cloud, ensuring maximum privacy and minimal bandwidth usage.

## Quick Start

### 1. Download Configuration
```bash
curl -O https://raw.githubusercontent.com/yourorg/ai-runner/main/docker-compose.edge.yml
```

### 2. Environment Setup
Create a `.env` file:
```env
ORG_API_KEY=your_organization_api_key
DEVICE_ID=edge_$(date +%s)_$(openssl rand -hex 4)
SUPABASE_URL=https://your-project.supabase.co
EDGE_MODE=true
METADATA_ONLY=true
MAX_LOCAL_STORAGE_GB=100
CLIP_UPLOAD_POLICY=on_demand
```

### 3. Deploy Services
```bash
docker-compose -f docker-compose.edge.yml up -d
```

### 4. Link Device
Scan the QR code generated in the admin panel at `/edge` to link your device.

## Architecture

### Local Services
- **Fusion**: Main orchestrator and API gateway
- **MediaMTX**: RTSP/HLS media server for local streams
- **AI Workers**: People, Vehicle, Safety, EduBehavior analytics
- **Notifier**: Local alert system
- **Edge Dashboard**: Local web interface (port 3000)
- **Prometheus**: Metrics collection
- **Loki**: Log aggregation

### Data Flow
1. **Video Input**: Cameras connect to MediaMTX via RTSP
2. **Local Processing**: AI workers analyze video streams locally
3. **Metadata Only**: Only detection data (no video) sent to cloud
4. **On-Demand Clips**: Video clips uploaded only when requested
5. **Local Storage**: All video data stored locally with configurable retention

## Network Requirements

### Inbound Ports
- `3000`: Edge Dashboard (local web interface)
- `8080`: Fusion API
- `8554`: RTSP (for camera connections)
- `8889`: HLS (for local video playback)
- `9090`: Prometheus metrics

### Outbound Connectivity
- `443`: HTTPS to Supabase for metadata sync
- `53`: DNS resolution

## Hardware Specifications

### Minimum Requirements
- **CPU**: 4 cores (Intel i5 equivalent)
- **RAM**: 8GB
- **Storage**: 100GB SSD
- **Network**: 1Gbps Ethernet
- **OS**: Ubuntu 20.04+ or Docker-compatible Linux

### Recommended Specifications
- **CPU**: 8 cores (Intel i7 equivalent)
- **RAM**: 16GB
- **Storage**: 500GB NVMe SSD
- **GPU**: NVIDIA GTX 1060+ (for ALPR workloads)
- **Network**: Dedicated network segment for cameras

### Camera Capacity
| Hardware Level | Max Cameras | Analytics |
|---------------|-------------|-----------|
| Minimum | 2-4 | Basic detection |
| Recommended | 8-16 | Full analytics |
| High-end | 32+ | Real-time + GPU |

## Configuration

### Analytics Settings
```yaml
# Edge mode configuration
analytics:
  edge_mode: true
  metadata_only: true
  local_storage:
    retention_days: 7
    max_size_gb: 100
  upload_policy:
    clips: on_demand
    alerts: immediate
    metrics: every_5_minutes
```

### Camera Configuration
```yaml
cameras:
  discovery:
    enabled: true
    protocols: [rtsp, onvif]
  recording:
    enabled: true
    format: h264
    quality: high
    segments: 300  # 5 minute segments
```

## Security Features

### Data Privacy
- **Local Processing**: Video never leaves the premises
- **Encrypted Metadata**: All cloud communication encrypted
- **Access Control**: Role-based access to local interface
- **Audit Trail**: All actions logged locally

### Network Security
- **VPN Support**: Optional VPN tunnel to cloud
- **Firewall Rules**: Minimal required ports
- **Certificate Management**: Automatic SSL/TLS certificates
- **Secure Boot**: Optional hardware security features

## Monitoring & Maintenance

### Health Monitoring
- **Service Status**: All containers monitored via Prometheus
- **Resource Usage**: CPU, memory, disk, network metrics
- **Alert Thresholds**: Configurable limits with notifications
- **Automatic Recovery**: Service restart on failure

### Maintenance Tasks
- **Log Rotation**: Automatic cleanup of old logs
- **Storage Management**: Automatic cleanup of old video files
- **Software Updates**: Docker image updates via watchtower
- **Backup**: Optional configuration backup to cloud

## Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker status
sudo systemctl status docker

# View service logs
docker-compose -f docker-compose.edge.yml logs fusion

# Restart services
docker-compose -f docker-compose.edge.yml restart
```

#### Camera Connection Issues
```bash
# Test RTSP connection
ffprobe rtsp://camera-ip:554/stream

# Check MediaMTX logs
docker-compose -f docker-compose.edge.yml logs mediamtx
```

#### High Resource Usage
```bash
# Monitor resource usage
docker stats

# Check storage usage
df -h

# View Prometheus metrics
curl http://localhost:9090/metrics
```

### Performance Optimization

#### CPU Optimization
- Adjust analytics worker replicas based on load
- Enable hardware acceleration when available
- Configure process priorities

#### Storage Optimization
- Implement tiered storage (SSD + HDD)
- Configure intelligent video retention
- Enable compression for older files

#### Network Optimization
- Use dedicated VLAN for cameras
- Implement QoS for video traffic
- Monitor bandwidth usage

## Support

### Log Collection
```bash
# Collect all logs for support
docker-compose -f docker-compose.edge.yml logs > edge-appliance-logs.txt

# Generate system report
docker system df
docker system events --since 24h
```

### Remote Support
- VPN tunnel for secure remote access
- Screen sharing via local dashboard
- SSH access with proper key management

For additional support, contact: support@yourcompany.com