FROM python:3.11-slim

# System deps and non-root user creation
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    wget \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup --gid=65532 \
    && useradd -r -g appgroup --uid=65532 --home-dir=/app --shell=/bin/false appuser

WORKDIR /app

# Copy common schemas
COPY ../common_schemas/ /common_schemas/
RUN pip3 install --no-cache-dir /common_schemas/

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create non-root directories
RUN mkdir -p /tmp/camera-sim /data && \
    chown -R appuser:appgroup /app /tmp/camera-sim /data

ENV PORT=8092
ENV PYTHONPATH="/app:/common_schemas"

USER 65532:65532

EXPOSE 8092

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8092/health || exit 1

CMD ["python", "main.py"]