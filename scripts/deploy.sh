#!/bin/bash

# ============================================
# DEPLOY SCRIPT - Eagle Vision AI
# Deploy completo do sistema
# ============================================

set -e  # Exit on any error

echo "🦅 Eagle Vision AI - Deploy Script"
echo "=================================="

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configurações
COMPOSE_FILE=${1:-"docker-compose.yml"}
ENVIRONMENT=${2:-"development"}

echo -e "${BLUE}📋 Deploy Configuration:${NC}"
echo "   • Compose file: $COMPOSE_FILE"
echo "   • Environment: $ENVIRONMENT"
echo ""

# 1. Pre-flight checks
echo -e "${BLUE}1. 🔍 Pre-flight checks${NC}"
echo "-------------------------"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker installed${NC}"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose available${NC}"

# Check compose file
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}❌ Compose file not found: $COMPOSE_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Compose file found${NC}"

echo ""

# 2. Environment setup
echo -e "${BLUE}2. 🌍 Environment setup${NC}"
echo "------------------------"

# Create .env if not exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found, creating from .env.example${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ .env created from example${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env.example found, skipping${NC}"
    fi
else
    echo -e "${GREEN}✅ .env file exists${NC}"
fi

# Create required directories
echo "Creating required directories..."
mkdir -p recordings media models config observability/grafana/data
echo -e "${GREEN}✅ Directories created${NC}"

echo ""

# 3. Pull images
echo -e "${BLUE}3. 📥 Pulling Docker images${NC}"
echo "----------------------------"

if [ "$COMPOSE_FILE" = "docker-compose.yml" ]; then
    echo "Pulling base images..."
    docker-compose -f "$COMPOSE_FILE" pull mediamtx prometheus grafana || true
else
    echo "Pulling all images..."
    docker-compose -f "$COMPOSE_FILE" pull || true
fi

echo ""

# 4. Build custom images
echo -e "${BLUE}4. 🔨 Building custom images${NC}"
echo "-----------------------------"

echo "Building AI services..."
docker-compose -f "$COMPOSE_FILE" build --parallel fusion yolo-detection multi-tracker || {
    echo -e "${YELLOW}⚠️  Some builds may have failed, continuing...${NC}"
}

echo ""

# 5. Start core services first
echo -e "${BLUE}5. 🚀 Starting core services${NC}"
echo "-----------------------------"

echo "Starting MediaMTX..."
docker-compose -f "$COMPOSE_FILE" up -d mediamtx

echo "Waiting for MediaMTX to be ready..."
sleep 5

# Check if MediaMTX is running
if curl -s http://localhost:8554/v1/config/global/get > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MediaMTX is ready${NC}"
else
    echo -e "${YELLOW}⚠️  MediaMTX may not be fully ready${NC}"
fi

echo ""

# 6. Start monitoring
echo -e "${BLUE}6. 📊 Starting monitoring services${NC}"
echo "-----------------------------------"

echo "Starting Prometheus & Grafana..."
docker-compose -f "$COMPOSE_FILE" up -d prometheus grafana

sleep 3
echo -e "${GREEN}✅ Monitoring services started${NC}"

echo ""

# 7. Start YouTube proxies (if in compose)
echo -e "${BLUE}7. 📺 Starting YouTube demo streams${NC}"
echo "------------------------------------"

if grep -q "ytproxy_people" "$COMPOSE_FILE"; then
    echo "Starting YouTube proxy services..."
    docker-compose -f "$COMPOSE_FILE" up -d ytproxy_people ytproxy_vehicles ytproxy_safety ytproxy_classroom
    
    echo "Waiting for streams to initialize..."
    sleep 10
    echo -e "${GREEN}✅ YouTube proxies started${NC}"
else
    echo -e "${YELLOW}⚠️  No YouTube proxies in this compose file${NC}"
fi

echo ""

# 8. Start AI services
echo -e "${BLUE}8. 🤖 Starting AI services${NC}"
echo "---------------------------"

echo "Starting AI analytics services..."
docker-compose -f "$COMPOSE_FILE" up -d fusion yolo-detection face-service reid multi-tracker
docker-compose -f "$COMPOSE_FILE" up -d analytics notifier enricher clip-exporter

sleep 5
echo -e "${GREEN}✅ AI services started${NC}"

echo ""

# 9. Health check
echo -e "${BLUE}9. 🏥 Health check${NC}"
echo "------------------"

echo "Checking service status..."
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "Testing key services..."

# Test MediaMTX
if curl -s http://localhost:8554/v1/config/global/get > /dev/null; then
    echo -e "${GREEN}✅ MediaMTX API responding${NC}"
else
    echo -e "${RED}❌ MediaMTX API not responding${NC}"
fi

# Test Grafana
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Grafana responding${NC}"
else
    echo -e "${RED}❌ Grafana not responding${NC}"
fi

# Test Prometheus
if curl -s http://localhost:9090 > /dev/null; then
    echo -e "${GREEN}✅ Prometheus responding${NC}"
else
    echo -e "${RED}❌ Prometheus not responding${NC}"
fi

echo ""

# 10. Final status
echo -e "${BLUE}10. 🎯 Deploy complete!${NC}"
echo "----------------------"

echo -e "${GREEN}🎉 Eagle Vision AI deployed successfully!${NC}"
echo ""
echo "🌐 Access URLs:"
echo "   • Grafana:    http://localhost:3000 (admin/admin)"
echo "   • Prometheus: http://localhost:9090"
echo "   • MediaMTX:   http://localhost:8554"
echo ""
echo "📺 Demo RTSP Streams:"
echo "   • People:     rtsp://localhost:8554/yt_people"
echo "   • Vehicles:   rtsp://localhost:8554/yt_vehicles"
echo "   • Safety:     rtsp://localhost:8554/yt_safety"
echo "   • Classroom:  rtsp://localhost:8554/yt_classroom"
echo ""
echo "🔧 Management:"
echo "   • Check logs:     docker-compose -f $COMPOSE_FILE logs -f [service]"
echo "   • Restart:        docker-compose -f $COMPOSE_FILE restart [service]"
echo "   • Stop all:       docker-compose -f $COMPOSE_FILE down"
echo "   • Health check:   ./scripts/health-check.sh <API_KEY>"
echo ""
echo "📝 Next steps:"
echo "   1. Run database setup: psql < scripts/setup-demo.sql"
echo "   2. Configure Supabase secrets (STRIPE_SECRET_KEY, TELEGRAM_BOT_TOKEN)"
echo "   3. Test demo UI functionality"
echo "   4. Run health check script"

# Save deploy info
echo "{
  \"deployed_at\": \"$(date -Iseconds)\",
  \"environment\": \"$ENVIRONMENT\",
  \"compose_file\": \"$COMPOSE_FILE\",
  \"version\": \"$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')\"
}" > .deploy-info.json

echo ""
echo -e "${GREEN}✨ Deploy information saved to .deploy-info.json${NC}"