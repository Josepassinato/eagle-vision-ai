FROM python:3.11-slim

# System deps and non-root user creation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    wget \
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

# App code
COPY . .

# Create non-root directories
RUN mkdir -p /tmp/clip-exporter /data && \
    chown -R appuser:appgroup /app /tmp/clip-exporter /data

ENV PORT=8095
ENV PYTHONPATH="/app:/common_schemas"

USER 65532:65532

EXPOSE 8095

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8095/health || exit 1

CMD ["python", "main.py"]
