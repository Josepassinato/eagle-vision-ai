# Test Fixtures

Video fixtures for integration testing of AI vision services.

## Structure

```
tests/fixtures/
├── edubehavior/
│   ├── classroom_engagement.mp4      # Students with varying engagement levels
│   ├── classroom_distress.mp4        # Students showing distress signals  
│   └── classroom_attention.mp4       # High attention scenario
├── safetyvision/
│   ├── ppe_violation.mp4             # Workers missing PPE
│   ├── fall_incident.mp4             # Simulated fall scenario
│   └── unsafe_lifting.mp4            # Poor lifting posture
├── antitheft/
│   ├── shelf_removal.mp4             # Items being removed from shelves
│   ├── suspicious_behavior.mp4       # Loitering and concealment
│   └── normal_shopping.mp4           # Normal customer behavior
└── face_reid/
    ├── known_persons.mp4             # Multiple appearances of known individuals
    ├── unknown_persons.mp4           # New faces for enrollment
    └── crowd_scene.mp4               # Multiple people for tracking
```

## Usage

These fixtures are used in integration tests to verify:

1. **End-to-end pipeline functionality**: Frame → Detection → Analysis → Signal
2. **Signal generation**: At least one expected signal per test scenario
3. **Temporal behavior**: Multi-frame analysis and state tracking
4. **Performance**: Processing time within acceptable bounds

## Test Data Format

Each test video should be:
- Duration: 10-30 seconds 
- Resolution: 720p (1280x720) minimum
- Format: MP4 with H.264 encoding
- Frame rate: 25-30 fps
- File size: <50MB per video

## Creating New Fixtures

When adding new test scenarios:

1. **Record or generate** relevant video content
2. **Anonymize** any real faces/identifiable information
3. **Validate** that the scenario triggers expected behaviors
4. **Document** expected outcomes in test files
5. **Keep files small** but realistic enough for testing

## Expected Outcomes

### EduBehavior
- `classroom_engagement.mp4`: Should detect varying engagement levels
- `classroom_distress.mp4`: Should trigger distress signals (MEDIUM/HIGH severity)
- `classroom_attention.mp4`: Should detect high attention signals

### SafetyVision  
- `ppe_violation.mp4`: Should detect missing hardhat/vest violations
- `fall_incident.mp4`: Should trigger fall alert within 2-3 seconds
- `unsafe_lifting.mp4`: Should detect unsafe lifting posture

### Antitheft
- `shelf_removal.mp4`: Should trigger item_removed signals
- `suspicious_behavior.mp4`: Should detect loitering/concealment
- `normal_shopping.mp4`: Should NOT trigger false alarms

### Face/ReID
- `known_persons.mp4`: Should consistently identify known individuals
- `unknown_persons.mp4`: Should trigger enrollment suggestions
- `crowd_scene.mp4`: Should track multiple individuals without ID swapping

## Maintenance

Review and update fixtures:
- **Quarterly**: Ensure compatibility with model updates
- **After model changes**: Verify expected outcomes still occur
- **Performance monitoring**: Check if processing times remain acceptable

Fixtures should be stored in Git LFS due to file sizes.