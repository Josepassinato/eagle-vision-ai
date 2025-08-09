FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswscale-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment variables with defaults
ENV STREAM_URL=rtsp://localhost:8554/entrada
ENV FUSION_URL=http://fusion:8080
ENV CAMERA_ID=cam01
ENV PULLER_FPS=8
ENV MAX_IMAGE_MB=0.5
ENV MIN_FPS=3
ENV MAX_FPS=10
ENV LATENCY_THRESHOLD=0.5
ENV RECONNECT_DELAY=5

# No port exposure needed (client only)

# Run the application
CMD ["python3", "main.py"]