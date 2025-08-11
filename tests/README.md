# AI Vision Platform - Integration Tests

This directory contains integration tests to prevent silent regressions in the AI Vision platform.

## Test Structure

```
tests/
├── fixtures/                 # Test video files (auto-generated)
│   ├── people_5s.mp4         # People detection test video
│   ├── vehicles_5s.mp4       # Vehicle detection test video  
│   ├── safety_5s.mp4         # Safety/PPE test video
│   └── classroom_5s.mp4      # Educational behavior test video
├── conftest.py               # Shared test utilities and fixtures
├── test_edubehavior.py       # EduBehavior service tests
├── test_safetyvision.py      # SafetyVision service tests
├── test_peoplevision.py      # YOLO Detection service tests
└── test_integration.py       # Cross-service integration tests
```

## Test Philosophy

These tests follow the **frame → signal** pattern to ensure:
1. Each service processes video frames correctly
2. At least one signal/detection is emitted for relevant content
3. Signal format validation to prevent API contract breakage
4. Cross-service pipeline integration works end-to-end

## Running Tests

### Prerequisites
```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx opencv-python-headless numpy

# Install service dependencies
pip install -r edubehavior/requirements.txt
pip install -r safetyvision/requirements.txt
pip install -r yolo-detection/requirements.txt
```

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Service Tests
```bash
# EduBehavior only
pytest tests/test_edubehavior.py -v

# SafetyVision only  
pytest tests/test_safetyvision.py -v

# YOLO Detection only
pytest tests/test_peoplevision.py -v

# Integration tests only
pytest tests/test_integration.py -v
```

### Run Tests with Service Auto-Skip
Tests automatically skip if services are not available:
```bash
# Tests will skip unavailable services instead of failing
pytest tests/ -v --tb=short
```

## Test Fixtures

Test videos are automatically generated if they don't exist:
- **people_5s.mp4**: Synthetic people walking for detection tests
- **vehicles_5s.mp4**: Cars with license plates for vehicle detection
- **safety_5s.mp4**: Construction workers with/without PPE
- **classroom_5s.mp4**: Students with varying emotions for affect detection

To regenerate fixtures:
```python
from tests.conftest import create_test_fixtures
create_test_fixtures()
```

## Service Requirements

Tests expect services to be running on these ports:
- **YOLO Detection**: `http://localhost:8080`
- **SafetyVision**: `http://localhost:8089`  
- **EduBehavior**: `http://localhost:8087`

Start services via Docker Compose:
```bash
docker-compose up yolo-detection safetyvision edubehavior
```

## CI/CD Integration

Tests run automatically on:
- **Push** to main/develop branches
- **Pull Requests** to main/develop
- **Docker builds** for each service

See `.github/workflows/ci.yml` for full CI configuration.

## Test Coverage

### EduBehavior Tests
- ✅ Service health check
- ✅ Affect signal emission from classroom video
- ✅ Signal format validation
- ✅ Student summary endpoint

### SafetyVision Tests  
- ✅ Service health check
- ✅ Safety signal emission from construction video
- ✅ PPE violation detection in construction zones
- ✅ Multiple zone type testing
- ✅ Signal format validation

### YOLO Detection Tests
- ✅ Service health check  
- ✅ Person detection from people video
- ✅ Detection format validation
- ✅ Multiple detection type testing
- ✅ Confidence threshold filtering

### Integration Tests
- ✅ All service health checks
- ✅ Metrics endpoint validation
- ✅ End-to-end pipeline (YOLO → SafetyVision)
- ✅ Test fixture validation

## Adding New Tests

1. **Service Tests**: Follow the pattern in existing test files
2. **Fixtures**: Add new video creation functions to `conftest.py`
3. **Integration**: Add cross-service tests to `test_integration.py`

Example test structure:
```python
@pytest.mark.asyncio
async def test_new_feature_emits_signal(self):
    """Test description following frame → signal pattern"""
    # 1. Load or create test data
    # 2. Send to service endpoint  
    # 3. Assert signal emission and format
    # 4. Validate business logic
```

## Troubleshooting

### Common Issues
- **Service not available**: Tests skip automatically
- **Fixture creation fails**: Check OpenCV installation
- **Timeout errors**: Increase timeout in test config
- **Port conflicts**: Update service URLs in test files

### Debug Mode
```bash
# Run with detailed output
pytest tests/ -v -s --tb=long

# Run single test with debug
pytest tests/test_edubehavior.py::TestEduBehavior::test_affect_signal_emits_at_least_one -v -s
```