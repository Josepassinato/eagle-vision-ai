FROM python:3.11-slim

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8097

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python - <<'PY' || exit 1
import requests
try:
  r = requests.get('http://localhost:8097/health', timeout=5)
  raise SystemExit(0 if r.status_code == 200 else 1)
except Exception:
  raise SystemExit(1)
PY

CMD ["python", "main.py"]
