# Analytics Service - Flow Counting

## Overview

The Analytics Service tracks people and vehicles crossing virtual lines to provide entrance/exit counting and flow analytics.

## Features

- **Virtual Line Detection**: Configurable lines for counting crossings
- **Multi-Class Support**: People, cars, trucks, buses, motorcycles, bicycles
- **Bidirectional Counting**: Tracks A→B and B→A crossings separately
- **Track Persistence**: Maintains track history to avoid double counting
- **Prometheus Metrics**: Exposes metrics for monitoring and alerting

## API Endpoints

### Health Check
```
GET /health
```

### Update Tracks
```
POST /update
Content-Type: application/json

{
  "camera_id": "cam01",
  "ts": 1723200000.5,
  "items": [
    {
      "track_id": 12,
      "cls": "car",
      "xyxy": [100, 200, 300, 400]
    },
    {
      "track_id": 34,
      "cls": "person", 
      "xyxy": [150, 180, 200, 350]
    }
  ],
  "frame_size": [1920, 1080]
}
```

### Get Counters
```
GET /counters?camera_id=cam01
GET /counters  # All cameras
```

Response:
```json
{
  "camera_id": "cam01",
  "counters": {
    "person": {
      "A_to_B": 15,
      "B_to_A": 12,
      "total": 27
    },
    "car": {
      "A_to_B": 45,
      "B_to_A": 38,
      "total": 83
    }
  }
}
```

### Virtual Line Configuration
```
GET /config/cam01      # Get current line
POST /config/cam01     # Set new line

{
  "camera_id": "cam01",
  "point1": [0.0, 0.6],  # Normalized coordinates
  "point2": [1.0, 0.6],  # Horizontal line at 60% height
  "name": "entrance"
}
```

## Supported Classes

- `person` - People detection
- `car` - Cars and small vehicles
- `truck` - Trucks and large vehicles  
- `bus` - Buses
- `motorcycle` - Motorcycles and scooters
- `bicycle` - Bicycles

## Virtual Lines

Virtual lines are defined by two points in normalized coordinates (0-1):
- `(0.0, 0.6)` to `(1.0, 0.6)` - Horizontal line at 60% height
- `(0.3, 0.0)` to `(0.3, 1.0)` - Vertical line at 30% width

### Default Configuration
Each camera gets a default horizontal line at 60% frame height unless configured otherwise.

## Integration with Fusion Service

The Fusion service should call `/update` for each processed frame:

```python
# In fusion service after tracking
analytics_payload = {
    "camera_id": camera_id,
    "ts": timestamp,
    "items": [
        {
            "track_id": track_id,
            "cls": detection_class,
            "xyxy": bbox_coordinates
        }
        for track_id, detection_class, bbox_coordinates in tracked_objects
    ],
    "frame_size": [frame_width, frame_height]
}

# Send to analytics
requests.post(f"{ANALYTICS_URL}/update", json=analytics_payload)
```

## Prometheus Metrics

The service exposes metrics at `/metrics`:

```
# HELP analytics_count_total Total count of objects crossing virtual lines
# TYPE analytics_count_total counter
analytics_count_total{camera_id="cam01",cls="person",direction="A_to_B"} 15
analytics_count_total{camera_id="cam01",cls="person",direction="B_to_A"} 12
analytics_count_total{camera_id="cam01",cls="car",direction="A_to_B"} 45
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8090 | Service port |

## Docker Usage

```bash
docker build -t analytics .
docker run -p 8090:8090 analytics
```

## Testing

```bash
# Test with curl
curl -X POST http://localhost:8090/update \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "cam01",
    "ts": 1723200000.5,
    "items": [
      {"track_id": 1, "cls": "person", "xyxy": [100,200,150,400]}
    ],
    "frame_size": [1920, 1080]
  }'

# Check counters
curl http://localhost:8090/counters?camera_id=cam01
```

## Troubleshooting

### Common Issues

1. **No Crossings Detected**
   - Check virtual line configuration
   - Verify bbox coordinates are in pixel space
   - Ensure frame_size is correct

2. **Double Counting**
   - Track IDs should be consistent across frames
   - Check if tracks are properly maintained

3. **Wrong Direction**
   - Verify virtual line orientation
   - Check point1 and point2 order

### Tuning

- Adjust virtual line position based on camera angle
- Consider object size when placing lines
- Monitor track history length for accuracy vs performance