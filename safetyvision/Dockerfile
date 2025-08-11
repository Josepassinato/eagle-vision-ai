FROM python:3.11-slim

# Install minimal system deps and create non-root user
RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup --gid=65532 \
    && useradd -r -g appgroup --uid=65532 --home-dir=/app --shell=/bin/false appuser

WORKDIR /app

# Copy common schemas
COPY ../common_schemas/ /common_schemas/
RUN pip3 install --no-cache-dir /common_schemas/

# Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App
COPY . .

# Create non-root directories
RUN mkdir -p /tmp/safetyvision /models && \
    chown -R appuser:appgroup /app /tmp/safetyvision /models

ENV PORT=8089
ENV PYTHONPATH="/app:/common_schemas"

USER 65532:65532

EXPOSE 8089

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["python", "main.py"]
