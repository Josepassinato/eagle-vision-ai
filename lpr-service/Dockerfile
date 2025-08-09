FROM python:3.11-slim

WORKDIR /app

# Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY main.py .

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
