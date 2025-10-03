#!/bin/sh
set -e

# Set default port if not provided
PORT=${PORT:-8080}

echo "Starting MediaMTX + Nginx on port $PORT"

# Generate nginx config with correct port
envsubst '${PORT}' < /etc/nginx/http.d/default.conf.template > /etc/nginx/http.d/default.conf

echo "Generated nginx configuration:"
cat /etc/nginx/http.d/default.conf

# Test nginx config
nginx -t

# Start nginx in background
nginx

echo "Nginx started successfully"

# Start MediaMTX (foreground)
echo "Starting MediaMTX..."
exec /mediamtx
