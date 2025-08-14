#!/usr/bin/env python3
"""
ONVIF Bridge Service - Eagle Vision
Provides ONVIF camera discovery, profiles, streaming, and PTZ control
"""

import asyncio
import ipaddress
import json
import logging
import socket
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
import xml.etree.ElementTree as ET

import netifaces
import nmap
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from onvif import ONVIFCamera
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import uvicorn

# Import resilient HTTP components
import sys
import os
sys.path.append('/common_schemas')
from http_resilient import get_http_client, ResilientHTTPClient
from correlation_logger import set_correlation_context, with_correlation, generate_correlation_id
from resilience import ResilienceManager, CircuitBreakerConfig, QueueConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ONVIF Bridge Service",
    description="ONVIF camera discovery, profiles, streaming, and PTZ control for Eagle Vision",
    version="1.0.0"
)

# CORS configuration
ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://panel.inigrai.com").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
discovery_duration = Histogram('onvif_discovery_duration_seconds', 'ONVIF discovery duration')
camera_connections = Counter('onvif_camera_connections_total', 'Total camera connections attempted')
camera_connection_failures = Counter('onvif_camera_connection_failures_total', 'Failed camera connections')
active_cameras = Gauge('onvif_active_cameras', 'Currently active ONVIF cameras')
ptz_commands = Counter('onvif_ptz_commands_total', 'PTZ commands executed', ['command'])

# Environment configuration
DISCOVERY_TIMEOUT = int(os.getenv("ONVIF_DISCOVERY_TIMEOUT", "10"))
CONNECTION_TIMEOUT = int(os.getenv("ONVIF_CONNECTION_TIMEOUT", "5"))
DEFAULT_ONVIF_PORT = int(os.getenv("DEFAULT_ONVIF_PORT", "80"))
NETWORK_SCAN_RANGE = os.getenv("NETWORK_SCAN_RANGE", "auto")  # auto or CIDR

# Global components
http_client: ResilientHTTPClient = get_http_client(service_name="onvif-bridge")
resilience_manager = ResilienceManager()
discovered_cameras: Dict[str, Dict] = {}  # IP -> camera info cache
authenticated_cameras: Dict[str, ONVIFCamera] = {}  # IP -> ONVIFCamera instance

class ONVIFCredentials(BaseModel):
    username: str
    password: str

class CameraInfo(BaseModel):
    ip: str = Field(..., description="Camera IP address")
    port: int = Field(default=80, description="ONVIF port")
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    firmware: Optional[str] = None
    serial: Optional[str] = None
    onvif_version: Optional[str] = None
    
    @validator('ip')
    def validate_ip(cls, v):
        try:
            ipaddress.ip_address(v)
            return v
        except ValueError:
            raise ValueError("Invalid IP address")

class StreamProfile(BaseModel):
    token: str
    name: str
    encoding: str  # H264, MJPEG, etc
    resolution: str  # e.g., "1920x1080"
    framerate: Optional[float] = None
    bitrate: Optional[int] = None
    rtsp_uri: Optional[str] = None

class PTZPreset(BaseModel):
    token: str
    name: str

class CameraProfile(BaseModel):
    camera_info: CameraInfo
    stream_profiles: List[StreamProfile] = []
    ptz_presets: List[PTZPreset] = []
    has_ptz: bool = False
    capabilities: Dict[str, Any] = {}

class DiscoveryRequest(BaseModel):
    network_range: Optional[str] = None
    timeout: Optional[int] = 10
    include_profiles: bool = False

class ConnectionTestRequest(BaseModel):
    ip: str
    port: int = 80
    credentials: ONVIFCredentials

class PTZControlRequest(BaseModel):
    ip: str
    credentials: ONVIFCredentials
    command: str  # "move_up", "move_down", "move_left", "move_right", "zoom_in", "zoom_out", "stop"
    speed: Optional[float] = 0.5  # 0.0 to 1.0
    duration: Optional[float] = 1.0  # seconds

class PTZPresetRequest(BaseModel):
    ip: str
    credentials: ONVIFCredentials
    action: str  # "goto", "set", "remove"
    preset_token: Optional[str] = None
    preset_name: Optional[str] = None

def get_network_ranges() -> List[str]:
    """Get local network ranges for scanning"""
    ranges = []
    
    if NETWORK_SCAN_RANGE != "auto":
        return [NETWORK_SCAN_RANGE]
    
    try:
        # Get all network interfaces
        for interface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(interface)
            if netifaces.AF_INET in addrs:
                for addr in addrs[netifaces.AF_INET]:
                    ip = addr.get('addr')
                    netmask = addr.get('netmask')
                    
                    if ip and netmask and not ip.startswith('127.'):
                        # Calculate network range
                        network = ipaddress.IPv4Network(f"{ip}/{netmask}", strict=False)
                        ranges.append(str(network))
        
        # Default fallback ranges if none found
        if not ranges:
            ranges = ["192.168.1.0/24", "192.168.0.0/24", "10.0.0.0/24"]
            
    except Exception as e:
        logger.error(f"Error detecting network ranges: {e}")
        ranges = ["192.168.1.0/24", "192.168.0.0/24"]
    
    logger.info(f"Scanning network ranges: {ranges}")
    return ranges

@with_correlation
async def discover_cameras_nmap(network_range: str, timeout: int = 10) -> List[str]:
    """Discover potential cameras using nmap port scanning"""
    try:
        nm = nmap.PortScanner()
        
        # Scan for common ONVIF/camera ports
        ports = "80,8080,8000,554,443,8443"
        logger.info(f"Scanning {network_range} for ports {ports}")
        
        scan_result = nm.scan(hosts=network_range, ports=ports, arguments='-T4 --max-rtt-timeout 2s')
        
        potential_cameras = []
        for host in scan_result['scan']:
            if scan_result['scan'][host]['status']['state'] == 'up':
                open_ports = []
                for port in scan_result['scan'][host]['tcp']:
                    if scan_result['scan'][host]['tcp'][port]['state'] == 'open':
                        open_ports.append(port)
                
                # Prioritize hosts with typical camera ports
                if 80 in open_ports or 8080 in open_ports:
                    potential_cameras.append(host)
                elif any(p in open_ports for p in [554, 8000]):  # RTSP or other camera ports
                    potential_cameras.append(host)
        
        logger.info(f"Found {len(potential_cameras)} potential cameras in {network_range}")
        return potential_cameras
        
    except Exception as e:
        logger.error(f"Error in nmap discovery for {network_range}: {e}")
        return []

@with_correlation
async def test_onvif_connection(ip: str, port: int = 80, timeout: int = 5) -> Dict[str, Any]:
    """Test ONVIF connection and get basic device info"""
    try:
        # Create ONVIF camera instance
        camera = ONVIFCamera(ip, port, timeout=timeout)
        
        # Try to get device information (doesn't require authentication)
        device_service = camera.create_devicemgmt_service()
        device_info = device_service.GetDeviceInformation()
        
        # Get capabilities
        capabilities = device_service.GetCapabilities()
        
        camera_info = {
            'ip': ip,
            'port': port,
            'manufacturer': getattr(device_info, 'Manufacturer', 'Unknown'),
            'model': getattr(device_info, 'Model', 'Unknown'),
            'firmware': getattr(device_info, 'FirmwareVersion', 'Unknown'),
            'serial': getattr(device_info, 'SerialNumber', 'Unknown'),
            'onvif_version': 'Detected',
            'capabilities': {
                'device': bool(capabilities.Device),
                'events': bool(capabilities.Events),
                'imaging': bool(capabilities.Imaging),
                'media': bool(capabilities.Media),
                'ptz': bool(capabilities.PTZ) if capabilities.PTZ else False
            }
        }
        
        logger.info(f"ONVIF camera detected at {ip}:{port} - {camera_info['manufacturer']} {camera_info['model']}")
        return camera_info
        
    except Exception as e:
        logger.debug(f"ONVIF test failed for {ip}:{port}: {e}")
        return None

@with_correlation
async def authenticate_and_get_profiles(ip: str, port: int, credentials: ONVIFCredentials) -> Optional[CameraProfile]:
    """Authenticate with camera and get detailed profiles"""
    try:
        # Create authenticated ONVIF camera
        camera = ONVIFCamera(ip, port, credentials.username, credentials.password, timeout=CONNECTION_TIMEOUT)
        
        # Test authentication by getting device info
        device_service = camera.create_devicemgmt_service()
        device_info = device_service.GetDeviceInformation()
        capabilities = device_service.GetCapabilities()
        
        camera_info = CameraInfo(
            ip=ip,
            port=port,
            manufacturer=getattr(device_info, 'Manufacturer', 'Unknown'),
            model=getattr(device_info, 'Model', 'Unknown'),
            firmware=getattr(device_info, 'FirmwareVersion', 'Unknown'),
            serial=getattr(device_info, 'SerialNumber', 'Unknown'),
            onvif_version='Authenticated'
        )
        
        # Get media profiles
        stream_profiles = []
        ptz_presets = []
        has_ptz = False
        
        try:
            media_service = camera.create_media_service()
            profiles = media_service.GetProfiles()
            
            for profile in profiles:
                # Get stream URI for each profile
                stream_setup = media_service.create_type('GetStreamUri')
                stream_setup.ProfileToken = profile.token
                stream_setup.StreamSetup = {
                    'Stream': 'RTP-Unicast',
                    'Transport': {'Protocol': 'RTSP'}
                }
                
                try:
                    stream_uri_response = media_service.GetStreamUri(stream_setup)
                    rtsp_uri = stream_uri_response.Uri
                except:
                    rtsp_uri = None
                
                # Extract profile information
                encoding = "Unknown"
                resolution = "Unknown"
                framerate = None
                bitrate = None
                
                if hasattr(profile, 'VideoEncoderConfiguration') and profile.VideoEncoderConfiguration:
                    video_config = profile.VideoEncoderConfiguration
                    encoding = getattr(video_config, 'Encoding', 'Unknown')
                    
                    if hasattr(video_config, 'Resolution'):
                        res = video_config.Resolution
                        resolution = f"{res.Width}x{res.Height}"
                    
                    if hasattr(video_config, 'RateControl'):
                        rate_control = video_config.RateControl
                        framerate = getattr(rate_control, 'FrameRateLimit', None)
                        bitrate = getattr(rate_control, 'BitrateLimit', None)
                
                stream_profile = StreamProfile(
                    token=profile.token,
                    name=getattr(profile, 'Name', f"Profile_{profile.token}"),
                    encoding=encoding,
                    resolution=resolution,
                    framerate=framerate,
                    bitrate=bitrate,
                    rtsp_uri=rtsp_uri
                )
                stream_profiles.append(stream_profile)
                
        except Exception as e:
            logger.warning(f"Error getting media profiles for {ip}: {e}")
        
        # Get PTZ capabilities and presets
        try:
            if capabilities.PTZ:
                ptz_service = camera.create_ptz_service()
                has_ptz = True
                
                # Get PTZ presets
                try:
                    presets = ptz_service.GetPresets({'ProfileToken': stream_profiles[0].token if stream_profiles else None})
                    for preset in presets:
                        ptz_preset = PTZPreset(
                            token=getattr(preset, 'token', str(preset.Token)) if hasattr(preset, 'Token') else str(preset),
                            name=getattr(preset, 'Name', f"Preset_{preset.Token if hasattr(preset, 'Token') else preset}")
                        )
                        ptz_presets.append(ptz_preset)
                except Exception as e:
                    logger.warning(f"Error getting PTZ presets for {ip}: {e}")
                    
        except Exception as e:
            logger.warning(f"Error getting PTZ info for {ip}: {e}")
        
        # Store authenticated camera for future use
        authenticated_cameras[ip] = camera
        
        profile = CameraProfile(
            camera_info=camera_info,
            stream_profiles=stream_profiles,
            ptz_presets=ptz_presets,
            has_ptz=has_ptz,
            capabilities={
                'device': bool(capabilities.Device),
                'events': bool(capabilities.Events),
                'imaging': bool(capabilities.Imaging),
                'media': bool(capabilities.Media),
                'ptz': bool(capabilities.PTZ) if capabilities.PTZ else False
            }
        )
        
        logger.info(f"Successfully authenticated and profiled camera {ip} - {len(stream_profiles)} profiles, PTZ: {has_ptz}")
        return profile
        
    except Exception as e:
        logger.error(f"Authentication failed for {ip}: {e}")
        camera_connection_failures.inc()
        return None

@app.post("/discover", response_model=List[CameraInfo])
@with_correlation
async def discover_onvif_cameras(request: DiscoveryRequest, background_tasks: BackgroundTasks):
    """Discover ONVIF cameras on the network"""
    start_time = time.time()
    set_correlation_context(service_name="onvif-discovery")
    
    try:
        network_ranges = get_network_ranges()
        if request.network_range:
            network_ranges = [request.network_range]
        
        timeout = request.timeout or DISCOVERY_TIMEOUT
        all_cameras = []
        
        # Discover potential cameras using nmap
        potential_hosts = []
        for network_range in network_ranges:
            hosts = await discover_cameras_nmap(network_range, timeout)
            potential_hosts.extend(hosts)
        
        logger.info(f"Testing ONVIF connectivity for {len(potential_hosts)} potential cameras")
        
        # Test ONVIF connectivity for each potential host
        for host in potential_hosts:
            camera_info = await test_onvif_connection(host, DEFAULT_ONVIF_PORT, timeout)
            if camera_info:
                # Cache discovery result
                discovered_cameras[host] = camera_info
                all_cameras.append(CameraInfo(**camera_info))
                camera_connections.inc()
        
        discovery_duration.observe(time.time() - start_time)
        active_cameras.set(len(all_cameras))
        
        logger.info(f"Discovered {len(all_cameras)} ONVIF cameras in {time.time() - start_time:.2f}s")
        return all_cameras
        
    except Exception as e:
        logger.error(f"Error in camera discovery: {e}")
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}")

@app.post("/test_connection")
@with_correlation
async def test_camera_connection(request: ConnectionTestRequest):
    """Test connection and authentication with a specific camera"""
    set_correlation_context(camera_ip=request.ip)
    
    try:
        profile = await authenticate_and_get_profiles(request.ip, request.port, request.credentials)
        
        if profile:
            return {
                "status": "success",
                "authenticated": True,
                "camera_info": profile.camera_info.dict(),
                "capabilities": profile.capabilities,
                "stream_profiles_count": len(profile.stream_profiles),
                "has_ptz": profile.has_ptz,
                "ptz_presets_count": len(profile.ptz_presets)
            }
        else:
            return {
                "status": "failed",
                "authenticated": False,
                "error": "Authentication failed or ONVIF not supported"
            }
            
    except Exception as e:
        logger.error(f"Connection test failed for {request.ip}: {e}")
        return {
            "status": "error",
            "authenticated": False,
            "error": str(e)
        }

@app.post("/get_profiles", response_model=CameraProfile)
@with_correlation
async def get_camera_profiles(request: ConnectionTestRequest):
    """Get detailed camera profiles including streams and PTZ"""
    set_correlation_context(camera_ip=request.ip)
    
    try:
        profile = await authenticate_and_get_profiles(request.ip, request.port, request.credentials)
        
        if profile:
            return profile
        else:
            raise HTTPException(status_code=401, detail="Authentication failed")
            
    except Exception as e:
        logger.error(f"Failed to get profiles for {request.ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ptz_control")
@with_correlation
async def control_ptz(request: PTZControlRequest):
    """Control PTZ camera movement"""
    set_correlation_context(camera_ip=request.ip)
    
    try:
        # Get or create authenticated camera
        camera = authenticated_cameras.get(request.ip)
        if not camera:
            camera = ONVIFCamera(request.ip, 80, request.credentials.username, request.credentials.password)
            authenticated_cameras[request.ip] = camera
        
        ptz_service = camera.create_ptz_service()
        
        # Get a profile token (use first available)
        media_service = camera.create_media_service()
        profiles = media_service.GetProfiles()
        if not profiles:
            raise HTTPException(status_code=400, detail="No media profiles available")
        
        profile_token = profiles[0].token
        
        # Execute PTZ command
        ptz_commands.labels(command=request.command).inc()
        
        if request.command == "stop":
            ptz_service.Stop({'ProfileToken': profile_token})
            
        elif request.command in ["move_up", "move_down", "move_left", "move_right"]:
            # Continuous move
            velocity = ptz_service.create_type('PTZSpeed')
            
            if request.command == "move_up":
                velocity.PanTilt.y = request.speed
                velocity.PanTilt.x = 0
            elif request.command == "move_down":
                velocity.PanTilt.y = -request.speed
                velocity.PanTilt.x = 0
            elif request.command == "move_left":
                velocity.PanTilt.x = -request.speed
                velocity.PanTilt.y = 0
            elif request.command == "move_right":
                velocity.PanTilt.x = request.speed
                velocity.PanTilt.y = 0
            
            velocity.Zoom.x = 0
            
            ptz_service.ContinuousMove({
                'ProfileToken': profile_token,
                'Velocity': velocity
            })
            
            # Auto-stop after duration
            if request.duration:
                await asyncio.sleep(request.duration)
                ptz_service.Stop({'ProfileToken': profile_token})
                
        elif request.command in ["zoom_in", "zoom_out"]:
            velocity = ptz_service.create_type('PTZSpeed')
            velocity.PanTilt.x = 0
            velocity.PanTilt.y = 0
            velocity.Zoom.x = request.speed if request.command == "zoom_in" else -request.speed
            
            ptz_service.ContinuousMove({
                'ProfileToken': profile_token,
                'Velocity': velocity
            })
            
            if request.duration:
                await asyncio.sleep(request.duration)
                ptz_service.Stop({'ProfileToken': profile_token})
        
        return {
            "status": "success",
            "command": request.command,
            "duration": request.duration
        }
        
    except Exception as e:
        logger.error(f"PTZ control failed for {request.ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ptz_preset")
@with_correlation
async def control_ptz_preset(request: PTZPresetRequest):
    """Control PTZ presets (goto, set, remove)"""
    set_correlation_context(camera_ip=request.ip)
    
    try:
        # Get or create authenticated camera
        camera = authenticated_cameras.get(request.ip)
        if not camera:
            camera = ONVIFCamera(request.ip, 80, request.credentials.username, request.credentials.password)
            authenticated_cameras[request.ip] = camera
        
        ptz_service = camera.create_ptz_service()
        
        # Get a profile token
        media_service = camera.create_media_service()
        profiles = media_service.GetProfiles()
        if not profiles:
            raise HTTPException(status_code=400, detail="No media profiles available")
        
        profile_token = profiles[0].token
        
        ptz_commands.labels(command=f"preset_{request.action}").inc()
        
        if request.action == "goto" and request.preset_token:
            ptz_service.GotoPreset({
                'ProfileToken': profile_token,
                'PresetToken': request.preset_token
            })
            
        elif request.action == "set" and request.preset_name:
            ptz_service.SetPreset({
                'ProfileToken': profile_token,
                'PresetName': request.preset_name
            })
            
        elif request.action == "remove" and request.preset_token:
            ptz_service.RemovePreset({
                'ProfileToken': profile_token,
                'PresetToken': request.preset_token
            })
        else:
            raise HTTPException(status_code=400, detail="Invalid preset action or missing parameters")
        
        return {
            "status": "success",
            "action": request.action,
            "preset_token": request.preset_token,
            "preset_name": request.preset_name
        }
        
    except Exception as e:
        logger.error(f"PTZ preset control failed for {request.ip}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/discovered_cache")
async def get_discovered_cache():
    """Get cached discovery results"""
    return {
        "total_discovered": len(discovered_cameras),
        "cameras": list(discovered_cameras.values())
    }

@app.delete("/clear_cache")
async def clear_discovery_cache():
    """Clear discovery and authentication cache"""
    global discovered_cameras, authenticated_cameras
    
    discovered_cameras.clear()
    authenticated_cameras.clear()
    
    return {"status": "cache_cleared"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    circuit_stats = http_client.get_circuit_stats() if hasattr(http_client, 'get_circuit_stats') else {}
    
    return {
        "status": "ok",
        "service": "onvif-bridge",
        "discovered_cameras": len(discovered_cameras),
        "authenticated_cameras": len(authenticated_cameras),
        "network_ranges": get_network_ranges(),
        "circuit_breakers": circuit_stats,
        "uptime": time.time()
    }

@app.get("/metrics")
async def get_metrics():
    """Prometheus metrics endpoint"""
    from fastapi import Response
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.on_event("startup")
async def startup_event():
    """Initialize resilience components"""
    logger.info("Starting ONVIF Bridge Service")
    
    # Initialize resilience manager
    circuit_config = CircuitBreakerConfig(
        failure_threshold=5,
        recovery_timeout=30,
        success_threshold=3
    )
    
    resilience_manager.get_circuit_breaker("onvif-connection", circuit_config)
    logger.info("ONVIF Bridge Service started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down ONVIF Bridge Service")
    
    # Close HTTP client
    if hasattr(http_client, 'close'):
        await http_client.close()
    
    # Stop resilience manager
    if hasattr(resilience_manager, 'stop_all'):
        await resilience_manager.stop_all()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8097,
        reload=False
    )