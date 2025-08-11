FROM python:3.11-slim

# System deps and non-root user creation
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

# Python deps
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# App code
COPY . .

# Create non-root directories
RUN mkdir -p /tmp/lpr-service /models \
    && chown -R appuser:appgroup /app /tmp/lpr-service /models

# Environment
ENV PORT=18070
ENV PYTHONPATH="/app:/common_schemas"

# Switch to non-root user
USER 65532:65532

EXPOSE 18070

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python - <<'PY' || exit 1
import requests
try:
  r = requests.get('http://localhost:18070/health', timeout=5)
  raise SystemExit(0 if r.status_code == 200 else 1)
except Exception:
  raise SystemExit(1)
PY

CMD ["python", "main.py"]
