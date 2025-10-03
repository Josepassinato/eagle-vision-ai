#!/bin/sh
set -e

# Set default port if not provided
PORT=${PORT:-8080}

echo "Starting MediaMTX + Nginx on port $PORT"

# Determine nginx include dir and generate config
NGINX_CONF=/etc/nginx/nginx.conf
DEST_DIR=/etc/nginx/http.d
if grep -q "http\.d/\*\.conf" "$NGINX_CONF"; then
  DEST_DIR=/etc/nginx/http.d
elif grep -q "conf\.d/\*\.conf" "$NGINX_CONF"; then
  DEST_DIR=/etc/nginx/conf.d
fi

mkdir -p "$DEST_DIR"
envsubst '${PORT}' < /etc/nginx/http.d/default.conf.template > "$DEST_DIR/default.conf"

echo "Using nginx include dir: $DEST_DIR"
echo "Generated nginx configuration:"
cat "$DEST_DIR/default.conf"

# Test nginx config
nginx -t

# Start nginx in background
nginx

echo "Nginx started successfully"

# Start MediaMTX (foreground)
echo "Starting MediaMTX..."
exec /usr/local/bin/mediamtx
