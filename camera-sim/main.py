#!/usr/bin/env python3
"""
Camera Simulator with netcam mode support
Supports pulling from HLS/RTSP/MJPEG and republishing to MediaMTX
"""

import os
import time
import logging
import subprocess
import signal
import sys
from typing import Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CameraSimulator:
    def __init__(self):
        self.input_mode = os.getenv('INPUT_MODE', 'netcam')
        self.netcam_url = os.getenv('NETCAM_URL', '')
        self.use_rtmp = os.getenv('USE_RTMP', 'true').lower() == 'true'
        self.rtmp_url = os.getenv('RTMP_URL', 'rtmp://mediamtx:1935/simulador?user=pub&pass=pub123')
        self.rtsp_url = os.getenv('RTSP_URL', 'rtsp://mediamtx:8554/simulador')
        self.reconnect_delay = 5
        self.max_reconnect_delay = 300
        self.process: Optional[subprocess.Popen] = None
        self.running = True
        
        # Signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
    def _signal_handler(self, signum, frame):
        logger.info(f"Received signal {signum}, shutting down...")
        self.running = False
        if self.process:
            self.process.terminate()
        sys.exit(0)
        
    def _build_ffmpeg_command(self) -> list[str]:
        """Build FFmpeg command based on input mode and settings"""
        if self.input_mode != 'netcam':
            raise ValueError(f"Unsupported input mode: {self.input_mode}")
            
        if not self.netcam_url:
            raise ValueError("NETCAM_URL is required for netcam mode")
            
        # Base command
        cmd = [
            'ffmpeg',
            '-re',  # Read input at native frame rate
            '-i', self.netcam_url,
            '-c:v', 'libx264',  # Video codec
            '-preset', 'ultrafast',  # Encoding speed
            '-tune', 'zerolatency',  # Low latency
            '-g', '30',  # GOP size
            '-keyint_min', '30',  # Minimum GOP size
            '-sc_threshold', '0',  # Disable scene change detection
            '-b:v', '2M',  # Video bitrate
            '-maxrate', '2M',
            '-bufsize', '4M',
            '-pix_fmt', 'yuv420p',
            '-f', 'flv' if self.use_rtmp else 'rtsp',
            '-y'  # Overwrite output
        ]
        
        # Add input-specific options
        if self.netcam_url.endswith('.m3u8'):
            # HLS specific options
            cmd.insert(3, '-protocol_whitelist')
            cmd.insert(4, 'file,http,https,tcp,tls,crypto')
        elif self.netcam_url.startswith('rtsp://'):
            # RTSP specific options
            cmd.insert(3, '-rtsp_transport')
            cmd.insert(4, 'tcp')
        elif 'mjpeg' in self.netcam_url.lower():
            # MJPEG specific options
            cmd.insert(3, '-f')
            cmd.insert(4, 'mjpeg')
            
        # Output URL
        output_url = self.rtmp_url if self.use_rtmp else self.rtsp_url
        cmd.append(output_url)
        
        return cmd
        
    def start_streaming(self):
        """Start streaming with automatic reconnection"""
        logger.info(f"Starting camera simulator in {self.input_mode} mode")
        logger.info(f"Input: {self.netcam_url}")
        logger.info(f"Output: {'RTMP' if self.use_rtmp else 'RTSP'}")
        
        while self.running:
            try:
                cmd = self._build_ffmpeg_command()
                logger.info(f"Starting FFmpeg: {' '.join(cmd)}")
                
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    universal_newlines=True,
                    bufsize=1
                )
                
                # Monitor process output
                while self.running and self.process.poll() is None:
                    line = self.process.stdout.readline()
                    if line:
                        logger.debug(f"FFmpeg: {line.strip()}")
                        
                if self.process.returncode == 0:
                    logger.info("FFmpeg finished successfully")
                    break
                else:
                    logger.error(f"FFmpeg failed with code {self.process.returncode}")
                    
            except Exception as e:
                logger.error(f"Error starting stream: {e}")
                
            if self.running:
                logger.info(f"Reconnecting in {self.reconnect_delay} seconds...")
                time.sleep(self.reconnect_delay)
                
                # Exponential backoff
                self.reconnect_delay = min(self.reconnect_delay * 2, self.max_reconnect_delay)
            
def main():
    simulator = CameraSimulator()
    simulator.start_streaming()

if __name__ == "__main__":
    main()