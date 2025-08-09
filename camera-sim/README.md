# Camera Simulator with Netcam Mode

## Overview

The Camera Simulator supports netcam mode to pull from various video sources (HLS, RTSP, MJPEG) and republish to MediaMTX.

## Supported Input Sources

### HLS (HTTP Live Streaming)
```bash
NETCAM_URL="https://itsstreamingno.dotd.la.gov/public/nor-cam-115.streams/playlist.m3u8"
```

### RTSP
```bash
NETCAM_URL="rtsp://username:password@192.168.1.100:554/stream1"
```

### MJPEG
```bash
NETCAM_URL="http://192.168.1.100:8080/mjpeg"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| INPUT_MODE | netcam | Input mode (currently only 'netcam' supported) |
| NETCAM_URL | (required) | Source URL for the camera stream |
| USE_RTMP | true | Use RTMP output (true) or RTSP (false) |
| RTMP_URL | rtmp://mediamtx:1935/simulador?user=pub&pass=pub123 | RTMP output URL |
| RTSP_URL | rtsp://mediamtx:8554/simulador | RTSP output URL |

## Usage

### Docker Compose
```yaml
camera-sim:
  build: ./camera-sim
  environment:
    - INPUT_MODE=netcam
    - NETCAM_URL=https://example.com/stream.m3u8
    - USE_RTMP=true
  depends_on:
    - mediamtx
  restart: unless-stopped
```

### Manual Docker Run
```bash
docker build -t camera-sim .
docker run -e NETCAM_URL="https://example.com/stream.m3u8" camera-sim
```

## Features

- **Automatic Reconnection**: Exponential backoff on connection failures
- **Multiple Input Formats**: HLS, RTSP, MJPEG support
- **Flexible Output**: RTMP or RTSP output to MediaMTX
- **Low Latency**: Optimized FFmpeg settings for real-time streaming
- **Robust Error Handling**: Graceful handling of network issues

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify MediaMTX is running and accessible
   - Check network connectivity between containers

2. **Authentication Errors**
   - Verify RTMP/RTSP credentials in URLs
   - Check MediaMTX configuration for user permissions

3. **Format Not Supported**
   - Ensure input URL is valid and accessible
   - Check FFmpeg logs for specific error messages

### Testing with Public Streams

```bash
# Louisiana DOT traffic camera
NETCAM_URL="https://itsstreamingno.dotd.la.gov/public/nor-cam-115.streams/playlist.m3u8"

# Test RTSP camera (replace with actual credentials)
NETCAM_URL="rtsp://admin:password@192.168.1.100:554/stream1"
```

### Logs

The service provides structured logging:
- Stream start/stop events
- Reconnection attempts
- FFmpeg output (debug level)
- Error conditions

### Performance Tuning

For high-load scenarios, adjust FFmpeg parameters:
- Reduce bitrate: `-b:v 1M`
- Change preset: `-preset fast`
- Adjust GOP size: `-g 15`