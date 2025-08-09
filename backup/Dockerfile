FROM python:3.11-slim

WORKDIR /app

# System deps for pg_dump and SSL
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Python deps
RUN pip install --no-cache-dir requests==2.32.3

COPY main.py .

ENV BACKUP_INTERVAL_SECONDS=86400

CMD ["python", "main.py"]
