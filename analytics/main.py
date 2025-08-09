#!/usr/bin/env python3
"""
Analytics Service for Flow Counting
Tracks people and vehicles crossing virtual lines
"""

import os
import logging
import math
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict, deque
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Prometheus metrics
analytics_counter = Counter(
    'analytics_count_total',
    'Total count of objects crossing virtual lines',
    ['camera_id', 'cls', 'direction']
)

app = FastAPI(title="Analytics Service", version="1.0.0")

# Pydantic models
class BBoxItem(BaseModel):
    track_id: int
    cls: str  # person, car, truck, bus, motorcycle, bicycle
    xyxy: List[float]  # [x1, y1, x2, y2]

class UpdateRequest(BaseModel):
    camera_id: str
    ts: float
    items: List[BBoxItem]
    frame_size: List[int]  # [width, height]

class VirtualLineConfig(BaseModel):
    camera_id: str
    point1: List[float]  # [x, y] normalized coordinates (0-1)
    point2: List[float]  # [x, y] normalized coordinates (0-1)
    name: str = "default"

@dataclass
class TrackHistory:
    track_id: int
    camera_id: str
    cls: str
    positions: deque = field(default_factory=lambda: deque(maxlen=10))
    last_side: Optional[str] = None  # "A" or "B"
    crossed_count: int = 0

class VirtualLine:
    def __init__(self, point1: Tuple[float, float], point2: Tuple[float, float], name: str = "default"):
        self.point1 = point1  # (x, y) normalized
        self.point2 = point2  # (x, y) normalized
        self.name = name
        
    def which_side(self, point: Tuple[float, float]) -> str:
        """Determine which side of the line the point is on"""
        x, y = point
        x1, y1 = self.point1
        x2, y2 = self.point2
        
        # Calculate cross product to determine side
        cross_product = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1)
        return "A" if cross_product > 0 else "B"
    
    def distance_to_line(self, point: Tuple[float, float]) -> float:
        """Calculate perpendicular distance from point to line"""
        x, y = point
        x1, y1 = self.point1
        x2, y2 = self.point2
        
        # Line equation: ax + by + c = 0
        a = y2 - y1
        b = x1 - x2
        c = x2 * y1 - x1 * y2
        
        # Distance formula
        distance = abs(a * x + b * y + c) / math.sqrt(a * a + b * b)
        return distance

class AnalyticsService:
    def __init__(self):
        self.tracks: Dict[str, TrackHistory] = {}  # key: f"{camera_id}_{track_id}"
        self.virtual_lines: Dict[str, VirtualLine] = {}  # key: camera_id
        self.counters: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )  # camera_id -> cls -> direction -> count
        
        # Default virtual lines (horizontal line at 60% height)
        self._setup_default_lines()
        
    def _setup_default_lines(self):
        """Setup default virtual lines for cameras"""
        # Default horizontal line at 60% of frame height
        default_line = VirtualLine((0.0, 0.6), (1.0, 0.6), "default")
        self.virtual_lines["default"] = default_line
        
    def get_virtual_line(self, camera_id: str) -> VirtualLine:
        """Get virtual line for camera, fallback to default"""
        return self.virtual_lines.get(camera_id, self.virtual_lines["default"])
    
    def set_virtual_line(self, camera_id: str, point1: Tuple[float, float], 
                        point2: Tuple[float, float], name: str = "custom"):
        """Set virtual line for specific camera"""
        self.virtual_lines[camera_id] = VirtualLine(point1, point2, name)
        logger.info(f"Set virtual line for {camera_id}: {point1} -> {point2}")
    
    def update_tracks(self, request: UpdateRequest):
        """Update track positions and detect line crossings"""
        camera_id = request.camera_id
        frame_w, frame_h = request.frame_size
        virtual_line = self.get_virtual_line(camera_id)
        
        events = []
        
        for item in request.items:
            # Only process certain classes
            if item.cls not in ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle']:
                continue
                
            track_key = f"{camera_id}_{item.track_id}"
            
            # Calculate center point (normalized coordinates)
            x1, y1, x2, y2 = item.xyxy
            cx = (x1 + x2) / 2 / frame_w
            cy = (y1 + y2) / 2 / frame_h
            center = (cx, cy)
            
            # Get or create track history
            if track_key not in self.tracks:
                self.tracks[track_key] = TrackHistory(
                    track_id=item.track_id,
                    camera_id=camera_id,
                    cls=item.cls
                )
            
            track = self.tracks[track_key]
            track.positions.append(center)
            
            # Determine current side
            current_side = virtual_line.which_side(center)
            
            # Check for crossing
            if track.last_side is not None and track.last_side != current_side:
                # Line crossed!
                direction = f"{track.last_side}_to_{current_side}"
                
                self.counters[camera_id][item.cls][direction] += 1
                track.crossed_count += 1
                
                # Update Prometheus metrics
                analytics_counter.labels(
                    camera_id=camera_id,
                    cls=item.cls,
                    direction=direction
                ).inc()
                
                event = {
                    "camera_id": camera_id,
                    "track_id": item.track_id,
                    "cls": item.cls,
                    "direction": direction,
                    "ts": datetime.fromtimestamp(request.ts).isoformat(),
                    "position": center,
                    "crossed_count": track.crossed_count
                }
                events.append(event)
                
                logger.info(f"Line crossing detected: {track_key} {item.cls} {direction}")
            
            track.last_side = current_side
            
        return events
    
    def get_counters(self, camera_id: str) -> Dict:
        """Get counter totals for a camera"""
        if camera_id not in self.counters:
            return {}
            
        result = {}
        for cls, directions in self.counters[camera_id].items():
            result[cls] = dict(directions)
            result[cls]["total"] = sum(directions.values())
            
        return result
    
    def get_all_counters(self) -> Dict:
        """Get all counters"""
        result = {}
        for camera_id, classes in self.counters.items():
            result[camera_id] = {}
            for cls, directions in classes.items():
                result[camera_id][cls] = dict(directions)
                result[camera_id][cls]["total"] = sum(directions.values())
        return result

# Global service instance
analytics_service = AnalyticsService()

@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}

@app.post("/update")
async def update_tracks(request: UpdateRequest):
    """Update track positions and detect crossings"""
    try:
        events = analytics_service.update_tracks(request)
        return {
            "status": "ok",
            "events": events,
            "processed_items": len(request.items)
        }
    except Exception as e:
        logger.error(f"Error updating tracks: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/counters")
async def get_counters(camera_id: Optional[str] = None):
    """Get counter totals"""
    try:
        if camera_id:
            result = analytics_service.get_counters(camera_id)
            return {"camera_id": camera_id, "counters": result}
        else:
            result = analytics_service.get_all_counters()
            return {"counters": result}
    except Exception as e:
        logger.error(f"Error getting counters: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/config/{camera_id}")
async def get_virtual_line_config(camera_id: str):
    """Get virtual line configuration for camera"""
    line = analytics_service.get_virtual_line(camera_id)
    return {
        "camera_id": camera_id,
        "point1": list(line.point1),
        "point2": list(line.point2),
        "name": line.name
    }

@app.post("/config/{camera_id}")
async def set_virtual_line_config(camera_id: str, config: VirtualLineConfig):
    """Set virtual line configuration for camera"""
    try:
        analytics_service.set_virtual_line(
            camera_id,
            tuple(config.point1),
            tuple(config.point2),
            config.name
        )
        return {"status": "ok", "camera_id": camera_id}
    except Exception as e:
        logger.error(f"Error setting virtual line: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port)