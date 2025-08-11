#!/bin/bash
"""
Smoke Tests for AI Vision Platform
Quick validation of core services and integrations
"""

set -e

# Configuration
API_BASE_URL=${API_BASE_URL:-"http://localhost:8080"}
YOLO_URL=${YOLO_URL:-"http://localhost:8080"}
EDU_URL=${EDU_URL:-"http://localhost:8080"} 
SAFETY_URL=${SAFETY_URL:-"http://localhost:8089"}

echo "🧪 Starting AI Vision Platform Smoke Tests..."
echo "API Base: $API_BASE_URL"

# Test 1: Health checks
echo ""
echo "📋 Testing service health endpoints..."

test_health() {
    local service=$1
    local url=$2
    echo -n "  $service: "
    
    if curl -sf "$url/health" > /dev/null; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        return 1
    fi
}

test_health "EduBehavior" "$EDU_URL"
test_health "SafetyVision" "$SAFETY_URL" 
test_health "YOLO Detection" "$YOLO_URL"

# Test 2: Metrics endpoints
echo ""
echo "📊 Testing metrics endpoints..."

test_metrics() {
    local service=$1
    local url=$2
    echo -n "  $service metrics: "
    
    if curl -sf "$url/metrics" | head -5 > /dev/null; then
        echo "✅ PASS" 
    else
        echo "❌ FAIL"
        return 1
    fi
}

test_metrics "EduBehavior" "$EDU_URL"
test_metrics "SafetyVision" "$SAFETY_URL"

# Test 3: Frame analysis endpoints
echo ""
echo "🎯 Testing frame analysis endpoints..."

# Create test frame (base64 encoded small image)
TEST_FRAME="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

test_frame_analysis() {
    local service=$1
    local url=$2
    local payload=$3
    
    echo -n "  $service frame analysis: "
    
    response=$(curl -sf -X POST "$url/analyze_frame" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>/dev/null)
    
    if echo "$response" | jq -e '.signals' > /dev/null 2>&1; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
        return 1
    fi
}

# EduBehavior test payload
EDU_PAYLOAD='{
    "class_id": "test_class",
    "camera_id": "test_camera",
    "frame_jpeg_b64": "'$TEST_FRAME'",
    "tracks": [
        {
            "track_id": "student_001",
            "bbox": [100, 100, 200, 200],
            "meta": {"confidence": 0.8}
        }
    ]
}'

# SafetyVision test payload  
SAFETY_PAYLOAD='{
    "camera_id": "test_camera",
    "org_id": "test_org",
    "zone_type": "construction",
    "frame_jpeg_b64": "'$TEST_FRAME'",
    "tracks": [
        {
            "track_id": "worker_001", 
            "bbox": [100, 100, 200, 200],
            "meta": {"confidence": 0.9}
        }
    ]
}'

test_frame_analysis "EduBehavior" "$EDU_URL" "$EDU_PAYLOAD"
test_frame_analysis "SafetyVision" "$SAFETY_URL" "$SAFETY_PAYLOAD"

# Test 4: Database connectivity
echo ""
echo "🗄️  Testing database connectivity..."

# This would require database queries - placeholder for now
echo "  Database connectivity: ⏳ SKIP (requires DB setup)"

# Test 5: Cache performance
echo ""
echo "⚡ Testing cache performance..."

# Test YOLO cache by making duplicate requests
echo -n "  YOLO cache test: "
start_time=$(date +%s%N)

for i in {1..3}; do
    curl -sf -X POST "$YOLO_URL/detect" \
        -H "Content-Type: application/json" \
        -d '{"image": "'$TEST_FRAME'", "confidence_threshold": 0.5}' > /dev/null 2>&1 || true
done

end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

if [ $duration -lt 5000 ]; then  # Less than 5 seconds for 3 requests
    echo "✅ PASS (${duration}ms for 3 requests)"
else
    echo "⚠️  SLOW (${duration}ms for 3 requests)"
fi

# Test 6: Integration pipeline
echo ""
echo "🔄 Testing integration pipeline..."

echo -n "  End-to-end pipeline: "

# Simulate full pipeline: Frame → YOLO → Safety Analysis → Signal
pipeline_test() {
    # 1. Send frame to YOLO for detection
    yolo_response=$(curl -sf -X POST "$YOLO_URL/detect" \
        -H "Content-Type: application/json" \
        -d '{"image": "'$TEST_FRAME'", "confidence_threshold": 0.3}' 2>/dev/null) || return 1
    
    # 2. Extract detections and send to SafetyVision
    # (In real scenario, tracks would come from multi-tracker)
    safety_response=$(curl -sf -X POST "$SAFETY_URL/analyze_frame" \
        -H "Content-Type: application/json" \
        -d "$SAFETY_PAYLOAD" 2>/dev/null) || return 1
    
    # 3. Check if response contains expected structure
    echo "$safety_response" | jq -e '.signals' > /dev/null 2>&1
}

if pipeline_test; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi

# Summary
echo ""
echo "🎉 Smoke tests completed!"
echo ""
echo "📈 Next steps for validation:"
echo "  1. Check Prometheus metrics: curl http://localhost:9090/metrics"
echo "  2. Monitor logs: docker logs <service_name>"
echo "  3. Run integration tests: pytest tests/test_integration_*.py"
echo "  4. Load testing: siege -c 10 -t 30s http://localhost:8080/health"
echo ""
echo "🔍 For detailed debugging:"
echo "  - Health: curl -v http://localhost:8080/health"
echo "  - Metrics: curl http://localhost:9090/metrics | grep -E '(frames|signals|errors)'"
echo "  - YOLO cache: Check cache hit ratios in /metrics endpoint"