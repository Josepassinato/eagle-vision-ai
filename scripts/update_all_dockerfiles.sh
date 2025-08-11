#!/bin/bash
"""
Security hardening script for all Dockerfiles
Applies non-root USER and security best practices
"""

set -e

SERVICES=(
    "analytics"
    "antitheft" 
    "backup"
    "camera-sim"
    "clip-exporter"
    "enricher"
    "frame-puller"
    "fusion"
    "lpr-service"
    "media-cleaner"
    "multi-tracker"
    "notifier"
    "reid-service"
    "yolo-detection"
)

echo "🔒 Applying security hardening to all Dockerfiles..."

for service in "${SERVICES[@]}"; do
    dockerfile_path="${service}/Dockerfile"
    
    if [[ -f "$dockerfile_path" ]]; then
        echo "Updating $dockerfile_path..."
        
        # Create backup
        cp "$dockerfile_path" "${dockerfile_path}.backup"
        
        # Apply security template
        cat > "$dockerfile_path" << EOF
FROM python:3.11-slim

# System deps and non-root user creation
RUN apt-get update && apt-get install -y \\
    curl \\
    libgl1-mesa-glx \\
    libglib2.0-0 \\
    libsm6 \\
    libxext6 \\
    libxrender-dev \\
    libgomp1 \\
    && rm -rf /var/lib/apt/lists/* \\
    && groupadd -r appgroup --gid=65532 \\
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
RUN mkdir -p /tmp/${service} /models \\
    && chown -R appuser:appgroup /app /tmp/${service} /models

# Environment
ENV PORT=8080
ENV PYTHONPATH="/app:/common_schemas"

# Switch to non-root user
USER 65532:65532

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["python3", "main.py"]
EOF
        
        echo "✅ Updated $dockerfile_path"
    else
        echo "⚠️  Dockerfile not found: $dockerfile_path"
    fi
done

echo "🔒 Security hardening complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Review updated Dockerfiles"
echo "2. Test builds: docker build -t service-name ."
echo "3. Update kubernetes manifests with:"
echo "   securityContext:"
echo "     readOnlyRootFilesystem: true"
echo "     allowPrivilegeEscalation: false"
echo "     capabilities:"
echo "       drop: ['ALL']"
echo "     runAsNonRoot: true"
echo "     runAsUser: 65532"