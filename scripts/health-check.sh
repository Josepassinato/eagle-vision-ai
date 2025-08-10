#!/bin/bash

# ============================================
# HEALTH CHECK SCRIPT - Eagle Vision AI
# Verifica se todos os serviços estão funcionando
# ============================================

echo "🦅 Eagle Vision AI - Health Check"
echo "=================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuração
SUPABASE_URL="https://avbswnnywjyvqfxezgfl.supabase.co"
API_KEY=${1:-"YOUR_API_KEY_HERE"}

if [ "$API_KEY" = "YOUR_API_KEY_HERE" ]; then
    echo -e "${YELLOW}⚠️  Usage: $0 <API_KEY>${NC}"
    echo "   Get your API key from org_api_keys table"
    exit 1
fi

# Helper function
check_service() {
    local name=$1
    local url=$2
    local expected=$3
    
    printf "%-25s" "$name:"
    
    response=$(curl -s -w "%{http_code}" -o /tmp/response.txt "$url" --max-time 10)
    http_code="${response: -3}"
    
    if [ "$http_code" = "$expected" ]; then
        echo -e "${GREEN}✅ OK${NC} ($http_code)"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} ($http_code)"
        if [ -f /tmp/response.txt ]; then
            head -2 /tmp/response.txt
        fi
        return 1
    fi
}

echo ""
echo "1. 🗄️  Supabase Services"
echo "-------------------------"

# Supabase Health
check_service "Supabase API" "$SUPABASE_URL/rest/v1/" "200"
check_service "Supabase Auth" "$SUPABASE_URL/auth/v1/health" "200"

echo ""
echo "2. ⚡ Edge Functions"
echo "-------------------"

# Edge Functions
check_service "org-create" "$SUPABASE_URL/functions/v1/org-create" "405"
check_service "camera-add" "$SUPABASE_URL/functions/v1/camera-add" "405" 
check_service "stream-start" "$SUPABASE_URL/functions/v1/stream-start" "405"
check_service "stream-stop" "$SUPABASE_URL/functions/v1/stream-stop" "405"
check_service "usage-summary" "$SUPABASE_URL/functions/v1/usage-summary" "401"
check_service "apikey-rotate" "$SUPABASE_URL/functions/v1/apikey-rotate" "401"

echo ""
echo "3. 🎥 Media Services (se rodando localmente)"
echo "---------------------------------------------"

# Media Services (local)
if command -v docker &> /dev/null; then
    if docker ps | grep -q mediamtx; then
        check_service "MediaMTX RTSP" "http://localhost:8554/v1/config/global/get" "200"
    else
        echo -e "MediaMTX: ${YELLOW}⚠️  Container não encontrado${NC}"
    fi
    
    # YouTube Proxies
    for service in ytproxy_people ytproxy_vehicles ytproxy_safety ytproxy_classroom; do
        if docker ps | grep -q $service; then
            echo -e "%-25s${GREEN}✅ Running${NC}" "$service:"
        else
            echo -e "%-25s${YELLOW}⚠️  Not running${NC}" "$service:"
        fi
    done
else
    echo -e "${YELLOW}⚠️  Docker não disponível - skip verificação local${NC}"
fi

echo ""
echo "4. 📊 Database Queries"
echo "----------------------"

# Test database access with API key
printf "%-25s" "Organizations:"
response=$(curl -s -H "apikey: $SUPABASE_URL" -H "X-API-Key: $API_KEY" "$SUPABASE_URL/rest/v1/orgs?select=id,name,plan")
if echo "$response" | grep -q '"id"'; then
    count=$(echo "$response" | jq length 2>/dev/null || echo "1")
    echo -e "${GREEN}✅ OK${NC} ($count found)"
else
    echo -e "${RED}❌ FAIL${NC}"
    echo "$response" | head -2
fi

printf "%-25s" "Demo Sources:"
response=$(curl -s -H "apikey: $SUPABASE_URL" "$SUPABASE_URL/rest/v1/demo_sources?select=name,active&active=eq.true")
if echo "$response" | grep -q '"name"'; then
    count=$(echo "$response" | jq length 2>/dev/null || echo "1")
    echo -e "${GREEN}✅ OK${NC} ($count active)"
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo ""
echo "5. 🎯 Demo Streams Test"
echo "-----------------------"

# Test RTSP streams (if accessible)
for stream in yt_people yt_vehicles yt_safety yt_classroom; do
    printf "%-25s" "RTSP $stream:"
    if command -v ffprobe &> /dev/null; then
        if timeout 5 ffprobe -v error -show_streams "rtsp://localhost:8554/$stream" &>/dev/null; then
            echo -e "${GREEN}✅ Streaming${NC}"
        else
            echo -e "${RED}❌ No signal${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  ffprobe not installed${NC}"
    fi
done

echo ""
echo "=================================="
echo "🏁 Health Check Complete"
echo ""
echo "📝 Next Steps:"
echo "   • Fix any ❌ failed services"
echo "   • Verify Docker containers: docker ps"
echo "   • Check logs: docker logs <container_name>"
echo "   • Test demo UI at your frontend URL"

# Cleanup
rm -f /tmp/response.txt