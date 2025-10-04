#!/bin/sh
set -euxo pipefail

# Set default port if not provided
PORT=${PORT:-8080}
export PORT

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

# Start MediaMTX in background
/usr/local/bin/mediamtx -config /mediamtx.yml &
echo "MediaMTX started (PID $!)"

# Start nginx in foreground (container main process)
echo "Starting Nginx in foreground..."
exec nginx -g 'daemon off;'
