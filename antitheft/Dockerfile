FROM python:3.11-slim

# Install ffmpeg for clip recording
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup --gid=65532 \
    && useradd -r -g appgroup --uid=65532 --home-dir=/app --shell=/bin/false appuser

WORKDIR /app

# Copy common schemas
COPY ../common_schemas/ /common_schemas/
RUN pip install --no-cache-dir /common_schemas/

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Create non-root directories
RUN mkdir -p /tmp/antitheft && chown -R appuser:appgroup /app /tmp/antitheft

USER 65532:65532

EXPOSE 8088

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8088/health || exit 1

CMD ["python", "main.py"]
