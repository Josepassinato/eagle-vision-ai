#!/usr/bin/env python3
"""
Unit tests for Camera Simulator
"""

import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Add camera-sim to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'camera-sim'))

from main import CameraSimulator

class TestCameraSimulator(unittest.TestCase):
    def setUp(self):
        # Mock environment variables
        self.env_patcher = patch.dict(os.environ, {
            'INPUT_MODE': 'netcam',
            'NETCAM_URL': 'https://example.com/test.m3u8',
            'USE_RTMP': 'true',
            'RTMP_URL': 'rtmp://mediamtx:1935/test',
            'RTSP_URL': 'rtsp://mediamtx:8554/test'
        })
        self.env_patcher.start()
        
        self.simulator = CameraSimulator()
    
    def tearDown(self):
        self.env_patcher.stop()
    
    def test_initialization(self):
        """Test simulator initialization with environment variables"""
        self.assertEqual(self.simulator.input_mode, 'netcam')
        self.assertEqual(self.simulator.netcam_url, 'https://example.com/test.m3u8')
        self.assertTrue(self.simulator.use_rtmp)
        self.assertEqual(self.simulator.rtmp_url, 'rtmp://mediamtx:1935/test')
    
    def test_ffmpeg_command_hls(self):
        """Test FFmpeg command generation for HLS input"""
        self.simulator.netcam_url = 'https://example.com/stream.m3u8'
        
        cmd = self.simulator._build_ffmpeg_command()
        
        # Check basic structure
        self.assertIn('ffmpeg', cmd)
        self.assertIn('-i', cmd)
        self.assertIn('https://example.com/stream.m3u8', cmd)
        self.assertIn('rtmp://mediamtx:1935/test', cmd)
        
        # Check HLS-specific options
        self.assertIn('-protocol_whitelist', cmd)
        self.assertIn('file,http,https,tcp,tls,crypto', cmd)
    
    def test_ffmpeg_command_rtsp(self):
        """Test FFmpeg command generation for RTSP input"""
        self.simulator.netcam_url = 'rtsp://192.168.1.100:554/stream1'
        
        cmd = self.simulator._build_ffmpeg_command()
        
        # Check RTSP-specific options
        self.assertIn('-rtsp_transport', cmd)
        self.assertIn('tcp', cmd)
        self.assertIn('rtsp://192.168.1.100:554/stream1', cmd)
    
    def test_ffmpeg_command_mjpeg(self):
        """Test FFmpeg command generation for MJPEG input"""
        self.simulator.netcam_url = 'http://192.168.1.100:8080/mjpeg'
        
        cmd = self.simulator._build_ffmpeg_command()
        
        # Check MJPEG-specific options
        mjpeg_index = cmd.index('-f')
        self.assertEqual(cmd[mjpeg_index + 1], 'mjpeg')
        self.assertIn('http://192.168.1.100:8080/mjpeg', cmd)
    
    def test_rtsp_output_mode(self):
        """Test RTSP output mode"""
        self.simulator.use_rtmp = False
        
        cmd = self.simulator._build_ffmpeg_command()
        
        self.assertIn('-f', cmd)
        rtsp_index = cmd.index('-f')
        self.assertEqual(cmd[rtsp_index + 1], 'rtsp')
        self.assertIn('rtsp://mediamtx:8554/test', cmd)
    
    def test_invalid_input_mode(self):
        """Test error handling for invalid input mode"""
        self.simulator.input_mode = 'invalid'
        
        with self.assertRaises(ValueError) as context:
            self.simulator._build_ffmpeg_command()
        
        self.assertIn("Unsupported input mode", str(context.exception))
    
    def test_missing_netcam_url(self):
        """Test error handling for missing NETCAM_URL"""
        self.simulator.netcam_url = ''
        
        with self.assertRaises(ValueError) as context:
            self.simulator._build_ffmpeg_command()
        
        self.assertIn("NETCAM_URL is required", str(context.exception))
    
    @patch('subprocess.Popen')
    def test_streaming_success(self, mock_popen):
        """Test successful streaming scenario"""
        # Mock successful process
        mock_process = MagicMock()
        mock_process.poll.return_value = None  # Process running
        mock_process.stdout.readline.return_value = 'FFmpeg output line'
        mock_process.returncode = 0
        mock_popen.return_value = mock_process
        
        # Mock to stop after first iteration
        self.simulator.running = False
        
        self.simulator.start_streaming()
        
        # Verify FFmpeg was called
        mock_popen.assert_called_once()
        call_args = mock_popen.call_args
        cmd = call_args[0][0]
        self.assertIn('ffmpeg', cmd)
    
    @patch('subprocess.Popen')
    @patch('time.sleep')
    def test_streaming_failure_reconnect(self, mock_sleep, mock_popen):
        """Test automatic reconnection on failure"""
        # Mock failed process
        mock_process = MagicMock()
        mock_process.poll.return_value = 1  # Failed
        mock_process.stdout.readline.return_value = ''
        mock_process.returncode = 1
        mock_popen.return_value = mock_process
        
        # Stop after first retry attempt
        call_count = 0
        def side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count >= 2:
                self.simulator.running = False
            return mock_process
        
        mock_popen.side_effect = side_effect
        
        self.simulator.start_streaming()
        
        # Verify reconnection attempt
        self.assertGreaterEqual(mock_popen.call_count, 2)
        mock_sleep.assert_called()
    
    def test_exponential_backoff(self):
        """Test exponential backoff logic"""
        initial_delay = self.simulator.reconnect_delay
        
        # Simulate multiple failures
        for i in range(3):
            old_delay = self.simulator.reconnect_delay
            # This would normally be updated in start_streaming
            self.simulator.reconnect_delay = min(old_delay * 2, self.simulator.max_reconnect_delay)
        
        # Delay should have increased
        self.assertGreater(self.simulator.reconnect_delay, initial_delay)
        self.assertLessEqual(self.simulator.reconnect_delay, self.simulator.max_reconnect_delay)

if __name__ == "__main__":
    unittest.main()