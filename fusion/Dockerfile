FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup --gid=65532 \
    && useradd -r -g appgroup --uid=65532 --home-dir=/app --shell=/bin/false appuser

WORKDIR /app

# Copy common schemas
COPY ../common_schemas/ /common_schemas/
RUN pip3 install --no-cache-dir /common_schemas/

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy vision_tracking module
COPY ../vision_tracking /vision_tracking

# Copy face-service client (for inline usage)
COPY ../face-service/face_client.py /face-service/

# Copy application code
COPY . .

# Create non-root directories
RUN mkdir -p /tmp/fusion && chown -R appuser:appgroup /app /tmp/fusion

# Environment variables
ENV PORT=8080
ENV PYTHONPATH="/app:/vision_tracking:/face-service:/common_schemas"

USER 65532:65532

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Run the application
CMD ["python3", "main.py"]