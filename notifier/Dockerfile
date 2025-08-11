FROM python:3.11-slim

# System deps and non-root user creation
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
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
RUN mkdir -p /tmp/notifier /models \
    && chown -R appuser:appgroup /app /tmp/notifier /models

# Environment
ENV PORT=8085
ENV PYTHONPATH="/app:/common_schemas"

# Switch to non-root user
USER 65532:65532

# Expose port
EXPOSE 8085

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8085/health || exit 1

# Run the application
CMD ["python", "main.py"]