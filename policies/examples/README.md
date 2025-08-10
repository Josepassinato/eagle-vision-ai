# Policy Management Examples

This directory contains example policy configurations for all analytics services.

## Policy Types

### Antitheft Policies
Control theft detection thresholds and behaviors:
- `shelf_out_delta`: Distance threshold for item removal detection
- `concealment_dwell_s`: Time threshold for concealment detection
- `exit_grace_min`: Grace period before exit violations
- `notify_enabled`: Enable/disable notifications

### Education Policies  
Control classroom behavior monitoring:
- `emotion_confidence_threshold`: Minimum confidence for emotion detection
- `attention_threshold`: Attention level detection threshold
- `aggression_threshold`: Threshold for aggressive behavior alerts
- `incident_window_minutes`: Time window for incident aggregation

### Safety Policies
Control PPE and safety monitoring:
- `helmet_confidence`: Helmet detection confidence threshold
- `vest_confidence`: Safety vest detection threshold
- `restricted_zone_enabled`: Enable zone violation monitoring
- `zone_dwell_threshold`: Time limit for restricted zones

### Privacy Policies
Control anonymization and data retention:
- `face_blur_enabled`: Enable face blurring in recordings
- `license_plate_blur_enabled`: Enable license plate blurring
- `blur_strength`: Blur intensity (0.0-1.0)
- `clip_retention_days`: How long to keep video clips

## Usage Examples

### Set Organization-wide Policy
```bash
# Set privacy policy for entire organization
./scripts/policy-manager.sh set privacy privacy policies/examples/privacy-policy.json
```

### Set Camera-specific Policy
```bash
# Set antitheft policy for specific camera
CAMERA_ID=cam_entrance ./scripts/policy-manager.sh set antitheft antitheft policies/examples/antitheft-policy.json
```

### List Current Policies
```bash
# List all policies for antitheft service
./scripts/policy-manager.sh list antitheft

# List policies for specific organization
./scripts/policy-manager.sh list "" org_123
```

### Validate Policy Configuration
```bash
# Validate policy JSON before deployment
./scripts/policy-manager.sh validate policies/examples/education-policy.json
```

### Monitor Policy Changes
```bash
# Monitor all policy changes in real-time
./scripts/policy-manager.sh monitor
```

## Policy Hierarchy

Policies are applied in order of specificity:

1. **Camera-specific**: `org_id + camera_id`
2. **Organization-specific**: `org_id` only
3. **Global default**: No filters

More specific policies override general ones.

## Hot Reload

Policy changes are automatically reloaded across all services without restart:

- Changes detected via database polling (every 60s)
- Webhook notifications for immediate updates
- Local caching with TTL for performance
- Graceful fallback to defaults

## Field Validation

Each policy type has required and optional fields:

### Required Fields
- `policy_type`: Must match service policy type
- Service-specific thresholds (varies by type)

### Optional Fields  
- `org_id`: Organization scope (null = global)
- `camera_id`: Camera scope (null = all cameras)
- `class_id`: Education class scope
- `site_id`: Site/location scope
- `version`: Policy version number
- Notification settings
- Retention periods

## Best Practices

1. **Start with defaults**: Use example policies as templates
2. **Test incrementally**: Validate policies before deployment
3. **Monitor changes**: Use policy monitoring during updates
4. **Document changes**: Include version notes for policy updates
5. **Backup configurations**: Keep policy configurations in version control