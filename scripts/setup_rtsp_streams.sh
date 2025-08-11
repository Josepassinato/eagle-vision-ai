#!/bin/bash
"""
RTSP YouTube Proxy Setup
Stream YouTube videos as RTSP for testing AI vision services
"""

set -e

echo "📺 Setting up RTSP YouTube proxy..."

# Create compose file for RTSP streaming
cat > compose/rtsp_youtube.yml << 'EOF'
version: '3.8'

services:
  mediamtx:
    image: aler9/rtsp-simple-server:latest
    container_name: mediamtx
    ports:
      - "8554:8554"    # RTSP port
      - "1935:1935"    # RTMP port  
      - "8888:8888"    # HLS port
      - "8889:8889"    # WebRTC port
    volumes:
      - ./mediamtx.yml:/mediamtx.yml
    restart: unless-stopped

  youtube-dl:
    image: mikefarah/yq:latest
    container_name: youtube-proxy
    volumes:
      - ./scripts:/scripts
    working_dir: /scripts
    command: >
      sh -c "
        apk add --no-cache ffmpeg youtube-dl curl &&
        while true; do
          echo 'Streaming people counting video...' &&
          youtube-dl -f 'best[height<=720]' -g 'https://www.youtube.com/watch?v=MNn9qKG2UFI' | head -1 | xargs -I {} ffmpeg -re -i {} -c copy -f rtsp rtsp://mediamtx:8554/yt_people &&
          sleep 10
        done
      "
    depends_on:
      - mediamtx
    restart: unless-stopped

  youtube-dl-classroom:
    image: mikefarah/yq:latest
    container_name: youtube-classroom
    volumes:
      - ./scripts:/scripts
    working_dir: /scripts
    command: >
      sh -c "
        apk add --no-cache ffmpeg youtube-dl curl &&
        while true; do
          echo 'Streaming classroom video...' &&
          youtube-dl -f 'best[height<=720]' -g 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' | head -1 | xargs -I {} ffmpeg -re -i {} -c copy -f rtsp rtsp://mediamtx:8554/yt_classroom &&
          sleep 10
        done
      "
    depends_on:
      - mediamtx
    restart: unless-stopped

networks:
  default:
    name: ai-vision
    external: true
EOF

# Create MediaMTX config
cat > mediamtx.yml << 'EOF'
# General
logLevel: info
logDestinations: [stdout]
logFile: /dev/stdout

# API
api: yes
apiAddress: 0.0.0.0:9997

# Metrics
metrics: yes
metricsAddress: 0.0.0.0:9998

# RTSP
rtspAddress: 0.0.0.0:8554
protocols: [udp, multicast, tcp]
encryption: "no"
serverKey: server.key
serverCert: server.crt

# RTMP  
rtmpAddress: 0.0.0.0:1935
rtmpEncryption: "no"

# HLS
hlsAddress: 0.0.0.0:8888
hlsEncryption: no
hlsAllowOrigin: "*"

# WebRTC
webrtcAddress: 0.0.0.0:8889
webrtcEncryption: no

# Paths
paths:
  yt_people:
    source: publisher
    sourceProtocol: rtsp
    runOnInit: ""
    runOnInitRestart: no
    runOnDemand: ""
    runOnDemandRestart: no
    runOnDemandStartTimeout: 10s
    runOnDemandCloseAfter: 10s
    runOnReady: ""
    runOnReadyRestart: no
    runOnRead: ""
    runOnReadRestart: no

  yt_classroom:
    source: publisher
    sourceProtocol: rtsp
    runOnInit: ""
    runOnInitRestart: no
    runOnDemand: ""
    runOnDemandRestart: no
    runOnDemandStartTimeout: 10s
    runOnDemandCloseAfter: 10s
    runOnReady: ""
    runOnReadyRestart: no
    runOnRead: ""
    runOnReadRestart: no

  yt_construction:
    source: publisher  
    sourceProtocol: rtsp
    runOnInit: ""
    runOnInitRestart: no
EOF

echo "🚀 Starting RTSP proxy services..."

# Create directory
mkdir -p compose

# Start services
docker compose -f compose/rtsp_youtube.yml up -d

echo "⏳ Waiting for streams to initialize..."
sleep 15

echo "🔍 Testing stream availability..."

test_stream() {
    local stream_name=$1
    local rtsp_url="rtsp://localhost:8554/${stream_name}"
    
    echo -n "  Testing $stream_name: "
    
    if ffprobe -v error -show_streams "$rtsp_url" 2>/dev/null | grep -q "codec_type=video"; then
        echo "✅ AVAILABLE"
    else
        echo "❌ NOT READY"
    fi
}

test_stream "yt_people"
test_stream "yt_classroom"

echo ""
echo "📋 Stream URLs:"
echo "  People counting: rtsp://localhost:8554/yt_people"
echo "  Classroom: rtsp://localhost:8554/yt_classroom" 
echo ""
echo "🧪 Test commands:"
echo "  ffprobe -v error -show_streams rtsp://localhost:8554/yt_people"
echo "  ffplay rtsp://localhost:8554/yt_people"
echo ""
echo "🔧 Management:"
echo "  MediaMTX API: http://localhost:9997"
echo "  Metrics: http://localhost:9998/metrics"
echo "  Stop: docker compose -f compose/rtsp_youtube.yml down"