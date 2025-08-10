#!/bin/bash

# Policy management utility script
# Usage: ./scripts/policy-manager.sh [command] [options]

set -e

COMMAND=${1:-"help"}
SERVICE_NAME=${2:-""}
ORG_ID=${3:-""}
CAMERA_ID=${4:-""}

# Configuration
SUPABASE_URL=${SUPABASE_URL:-""}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-""}
POLICY_CONFIG_FILE=${5:-"policy.json"}

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
    echo "Policy Management Utility"
    echo
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  list [service] [org_id]           List policies"
    echo "  get [service] [policy_type] [org] Get specific policy"
    echo "  set [service] [policy_type] [file] Set policy from JSON file"
    echo "  delete [service] [policy_type]    Delete policy"
    echo "  validate [file]                   Validate policy JSON"
    echo "  reload [service]                  Trigger policy reload"
    echo "  monitor                           Monitor policy changes"
    echo
    echo "Examples:"
    echo "  $0 list antitheft org_123"
    echo "  $0 get antitheft antitheft org_123"
    echo "  $0 set antitheft antitheft policy.json"
    echo "  $0 reload fusion"
    echo
    echo "Environment Variables:"
    echo "  SUPABASE_URL               Supabase project URL"
    echo "  SUPABASE_SERVICE_ROLE_KEY  Supabase service role key"
}

check_dependencies() {
    if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        echo -e "${RED}Error: Supabase credentials not configured${NC}"
        echo "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables"
        exit 1
    fi
    
    if ! command -v curl > /dev/null 2>&1; then
        echo -e "${RED}Error: curl is required${NC}"
        exit 1
    fi
    
    if ! command -v jq > /dev/null 2>&1; then
        echo -e "${RED}Error: jq is required for JSON processing${NC}"
        exit 1
    fi
}

supabase_query() {
    local query="$1"
    local method="${2:-GET}"
    local data="$3"
    
    local url="$SUPABASE_URL/rest/v1/service_policies"
    
    if [ "$method" = "GET" ]; then
        curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
             -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
             -H "Content-Type: application/json" \
             "$url?$query"
    else
        curl -s -X "$method" \
             -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
             -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$url"
    fi
}

list_policies() {
    local service="$1"
    local org_id="$2"
    
    echo -e "${BLUE}📋 Listing policies...${NC}"
    
    local query="select=*"
    
    if [ -n "$service" ]; then
        query="$query&service_name=eq.$service"
    fi
    
    if [ -n "$org_id" ]; then
        query="$query&org_id=eq.$org_id"
    fi
    
    local result=$(supabase_query "$query")
    
    if echo "$result" | jq -e '. | length > 0' > /dev/null; then
        echo "$result" | jq -r '.[] | "\(.service_name)/\(.policy_type) (\(.org_id // "global")) - v\(.version) - \(.updated_at)"'
    else
        echo "No policies found"
    fi
}

get_policy() {
    local service="$1"
    local policy_type="$2" 
    local org_id="$3"
    
    echo -e "${BLUE}📄 Getting policy: $service/$policy_type${NC}"
    
    local query="select=*&service_name=eq.$service&policy_type=eq.$policy_type"
    
    if [ -n "$org_id" ]; then
        query="$query&org_id=eq.$org_id"
    fi
    
    local result=$(supabase_query "$query")
    
    if echo "$result" | jq -e '. | length > 0' > /dev/null; then
        echo "$result" | jq '.[0]'
    else
        echo "Policy not found"
        return 1
    fi
}

set_policy() {
    local service="$1"
    local policy_type="$2"
    local config_file="$3"
    
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Error: Config file not found: $config_file${NC}"
        return 1
    fi
    
    echo -e "${BLUE}📝 Setting policy from: $config_file${NC}"
    
    # Validate JSON
    if ! jq . "$config_file" > /dev/null; then
        echo -e "${RED}Error: Invalid JSON in config file${NC}"
        return 1
    fi
    
    # Read config
    local config=$(jq -c . "$config_file")
    
    # Create policy payload
    local policy_data=$(jq -n \
        --arg service "$service" \
        --arg policy_type "$policy_type" \
        --argjson config "$config" \
        --arg org_id "$ORG_ID" \
        --arg camera_id "$CAMERA_ID" \
        '{
            service_name: $service,
            policy_type: $policy_type,
            config: $config,
            org_id: (if $org_id != "" then $org_id else null end),
            camera_id: (if $camera_id != "" then $camera_id else null end),
            version: 1,
            updated_at: now
        }')
    
    local result=$(supabase_query "" "POST" "$policy_data")
    
    if echo "$result" | jq -e '. | length > 0' > /dev/null; then
        echo -e "${GREEN}✓ Policy created successfully${NC}"
        echo "$result" | jq '.[0] | {id, service_name, policy_type, version}'
    else
        echo -e "${RED}Error creating policy${NC}"
        echo "$result"
        return 1
    fi
}

delete_policy() {
    local service="$1"
    local policy_type="$2"
    
    echo -e "${YELLOW}🗑️  Deleting policy: $service/$policy_type${NC}"
    
    # First get the policy ID
    local policy=$(get_policy "$service" "$policy_type" "$ORG_ID")
    
    if [ $? -ne 0 ]; then
        echo "Policy not found"
        return 1
    fi
    
    local policy_id=$(echo "$policy" | jq -r '.id')
    
    # Delete the policy
    local result=$(supabase_query "id=eq.$policy_id" "DELETE")
    
    echo -e "${GREEN}✓ Policy deleted${NC}"
}

validate_policy() {
    local config_file="$1"
    
    echo -e "${BLUE}✅ Validating policy: $config_file${NC}"
    
    if [ ! -f "$config_file" ]; then
        echo -e "${RED}Error: File not found${NC}"
        return 1
    fi
    
    # Basic JSON validation
    if ! jq . "$config_file" > /dev/null; then
        echo -e "${RED}Error: Invalid JSON${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✓ Valid JSON structure${NC}"
    
    # Check for required fields based on policy type
    local policy_type=$(jq -r '.policy_type // empty' "$config_file")
    
    if [ -n "$policy_type" ]; then
        echo "Policy type: $policy_type"
        
        case "$policy_type" in
            "antitheft")
                echo "  Checking antitheft fields..."
                jq -e '.shelf_out_delta and .concealment_dwell_s' "$config_file" > /dev/null && echo "  ✓ Required fields present"
                ;;
            "education")
                echo "  Checking education fields..."
                jq -e '.emotion_confidence_threshold and .attention_threshold' "$config_file" > /dev/null && echo "  ✓ Required fields present"
                ;;
            "safety")
                echo "  Checking safety fields..."
                jq -e '.helmet_confidence and .vest_confidence' "$config_file" > /dev/null && echo "  ✓ Required fields present"
                ;;
            "privacy")
                echo "  Checking privacy fields..."
                jq -e 'has("face_blur_enabled") and has("license_plate_blur_enabled")' "$config_file" > /dev/null && echo "  ✓ Required fields present"
                ;;
        esac
    fi
    
    echo -e "${GREEN}✓ Policy validation complete${NC}"
}

reload_policies() {
    local service="$1"
    
    echo -e "${BLUE}🔄 Reloading policies for: $service${NC}"
    
    # Find service port
    case "$service" in
        "fusion") port="8080" ;;
        "antitheft") port="8088" ;;
        "edubehavior") port="8080" ;;
        "enricher") port="8086" ;;
        *) echo "Unknown service: $service"; return 1 ;;
    esac
    
    # Trigger policy reload via webhook
    if curl -sf "http://localhost:$port/policies/reload" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Policy reload triggered${NC}"
    else
        echo -e "${YELLOW}? Service not responding or no reload endpoint${NC}"
    fi
}

monitor_policies() {
    echo -e "${BLUE}👀 Monitoring policy changes...${NC}"
    echo "Press Ctrl+C to stop"
    
    local last_check=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    while true; do
        sleep 5
        
        # Check for recent policy changes
        local query="select=*&updated_at=gte.$last_check&order=updated_at.desc"
        local changes=$(supabase_query "$query")
        
        if echo "$changes" | jq -e '. | length > 0' > /dev/null; then
            echo
            echo -e "${GREEN}🔔 Policy changes detected:${NC}"
            echo "$changes" | jq -r '.[] | "  \(.service_name)/\(.policy_type) (\(.org_id // "global")) updated at \(.updated_at)"'
        fi
        
        last_check=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    done
}

# Main execution
case "$COMMAND" in
    "list")
        check_dependencies
        list_policies "$SERVICE_NAME" "$ORG_ID"
        ;;
    "get")
        check_dependencies
        get_policy "$SERVICE_NAME" "$3" "$ORG_ID"
        ;;
    "set")
        check_dependencies
        set_policy "$SERVICE_NAME" "$3" "$4"
        ;;
    "delete")
        check_dependencies
        delete_policy "$SERVICE_NAME" "$3"
        ;;
    "validate")
        validate_policy "$SERVICE_NAME"
        ;;
    "reload")
        reload_policies "$SERVICE_NAME"
        ;;
    "monitor")
        check_dependencies
        monitor_policies
        ;;
    "help"|*)
        usage
        ;;
esac