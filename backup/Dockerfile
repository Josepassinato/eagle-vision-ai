FROM python:3.11-slim

# System deps for pg_dump and SSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appgroup --gid=65532 \
    && useradd -r -g appgroup --uid=65532 --home-dir=/app --shell=/bin/false appuser

WORKDIR /app

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Create non-root directories
RUN mkdir -p /tmp/backup && chown -R appuser:appgroup /app /tmp/backup

ENV BACKUP_INTERVAL_SECONDS=86400

USER 65532:65532

EXPOSE 8093

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:8093/health || exit 1

CMD ["python", "main.py"]
