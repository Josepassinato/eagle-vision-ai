import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Search, 
  Camera, 
  Settings, 
  Wifi, 
  Lock, 
  Play, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Square,
  Navigation,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface CameraInfo {
  ip: string;
  port: number;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serial?: string;
  onvif_version?: string;
}

interface StreamProfile {
  token: string;
  name: string;
  encoding: string;
  resolution: string;
  framerate?: number;
  bitrate?: number;
  rtsp_uri?: string;
}

interface PTZPreset {
  token: string;
  name: string;
}

interface CameraProfile {
  camera_info: CameraInfo;
  stream_profiles: StreamProfile[];
  ptz_presets: PTZPreset[];
  has_ptz: boolean;
  capabilities: Record<string, boolean>;
}

interface ONVIFCredentials {
  username: string;
  password: string;
}

export const ONVIFBridge: React.FC = () => {
  const [discoveredCameras, setDiscoveredCameras] = useState<CameraInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraInfo | null>(null);
  const [cameraProfile, setCameraProfile] = useState<CameraProfile | null>(null);
  const [credentials, setCredentials] = useState<ONVIFCredentials>({ username: '', password: '' });
  const [networkRange, setNetworkRange] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPTZControlling, setIsPTZControlling] = useState(false);
  const [discoveryProgress, setDiscoveryProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const handleDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveryProgress(0);
    
    try {
      const response = await fetch('/api/onvif/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          network_range: networkRange || undefined,
          timeout: 15
        })
      });

      if (!response.ok) {
        throw new Error('Discovery failed');
      }

      const cameras = await response.json();
      setDiscoveredCameras(cameras);
      toast.success(`Discovered ${cameras.length} ONVIF cameras`);
      
      setDiscoveryProgress(100);
    } catch (error) {
      console.error('Discovery error:', error);
      toast.error('Failed to discover cameras');
    } finally {
      setIsDiscovering(false);
      setTimeout(() => setDiscoveryProgress(0), 2000);
    }
  };

  const handleTestConnection = async (camera: CameraInfo) => {
    if (!credentials.username || !credentials.password) {
      toast.error('Please enter credentials');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('idle');
    
    try {
      const response = await fetch('/api/onvif/test_connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: camera.ip,
          port: camera.port,
          credentials
        })
      });

      const result = await response.json();
      
      if (result.authenticated) {
        setConnectionStatus('success');
        toast.success('Authentication successful');
        setSelectedCamera(camera);
        
        // Get detailed profiles
        await handleGetProfiles(camera);
      } else {
        setConnectionStatus('failed');
        toast.error('Authentication failed');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('failed');
      toast.error('Connection test failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGetProfiles = async (camera: CameraInfo) => {
    try {
      const response = await fetch('/api/onvif/get_profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: camera.ip,
          port: camera.port,
          credentials
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get profiles');
      }

      const profile = await response.json();
      setCameraProfile(profile);
    } catch (error) {
      console.error('Get profiles error:', error);
      toast.error('Failed to get camera profiles');
    }
  };

  const handlePTZControl = async (command: string, speed: number = 0.5, duration: number = 1.0) => {
    if (!selectedCamera) return;

    setIsPTZControlling(true);
    
    try {
      const response = await fetch('/api/onvif/ptz_control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: selectedCamera.ip,
          credentials,
          command,
          speed,
          duration
        })
      });

      if (!response.ok) {
        throw new Error('PTZ control failed');
      }

      toast.success(`PTZ ${command} executed`);
    } catch (error) {
      console.error('PTZ control error:', error);
      toast.error('PTZ control failed');
    } finally {
      setIsPTZControlling(false);
    }
  };

  const handlePTZPreset = async (action: string, presetToken?: string, presetName?: string) => {
    if (!selectedCamera) return;

    try {
      const response = await fetch('/api/onvif/ptz_preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: selectedCamera.ip,
          credentials,
          action,
          preset_token: presetToken,
          preset_name: presetName
        })
      });

      if (!response.ok) {
        throw new Error('PTZ preset failed');
      }

      toast.success(`PTZ preset ${action} executed`);
      
      // Refresh profiles to update preset list
      if (action === 'set' || action === 'remove') {
        await handleGetProfiles(selectedCamera);
      }
    } catch (error) {
      console.error('PTZ preset error:', error);
      toast.error('PTZ preset failed');
    }
  };

  const getStatusIcon = (status: 'idle' | 'success' | 'failed') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            ONVIF Camera Bridge
          </CardTitle>
          <CardDescription>
            Discover, configure, and control ONVIF cameras on your network
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="discovery" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="ptz">PTZ Control</TabsTrigger>
        </TabsList>

        {/* Discovery Tab */}
        <TabsContent value="discovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Network Discovery
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="networkRange">Network Range (optional)</Label>
                  <Input
                    id="networkRange"
                    placeholder="192.168.1.0/24 (auto-detect if empty)"
                    value={networkRange}
                    onChange={(e) => setNetworkRange(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={handleDiscovery} 
                    disabled={isDiscovering}
                    className="flex items-center gap-2"
                  >
                    {isDiscovering ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {isDiscovering ? 'Discovering...' : 'Discover Cameras'}
                  </Button>
                </div>
              </div>

              {isDiscovering && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Scanning network...</span>
                    <span>{discoveryProgress}%</span>
                  </div>
                  <Progress value={discoveryProgress} className="w-full" />
                </div>
              )}

              {discoveredCameras.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Discovered Cameras ({discoveredCameras.length})</h3>
                  <div className="grid gap-3">
                    {discoveredCameras.map((camera, index) => (
                      <Card key={index} className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Camera className="h-4 w-4" />
                                <span className="font-medium">{camera.ip}:{camera.port}</span>
                                <Badge variant="outline">ONVIF</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {camera.manufacturer} {camera.model} - {camera.firmware}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => setSelectedCamera(camera)}
                              variant={selectedCamera?.ip === camera.ip ? "default" : "outline"}
                            >
                              Select
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Camera Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedCamera ? (
                <Alert>
                  <Camera className="h-4 w-4" />
                  <AlertDescription>
                    Selected Camera: {selectedCamera.ip}:{selectedCamera.port} - {selectedCamera.manufacturer} {selectedCamera.model}
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a camera from the Discovery tab first
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Button
                  onClick={() => selectedCamera && handleTestConnection(selectedCamera)}
                  disabled={!selectedCamera || isConnecting || !credentials.username || !credentials.password}
                  className="flex items-center gap-2"
                >
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  Test Connection
                </Button>
                
                <div className="flex items-center gap-2">
                  {getStatusIcon(connectionStatus)}
                  <span className="text-sm">
                    {connectionStatus === 'success' && 'Connected'}
                    {connectionStatus === 'failed' && 'Authentication Failed'}
                    {connectionStatus === 'idle' && 'Not tested'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Camera Profiles & Streams
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cameraProfile ? (
                <div className="space-y-6">
                  {/* Camera Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Camera Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><strong>IP:</strong> {cameraProfile.camera_info.ip}</div>
                      <div><strong>Port:</strong> {cameraProfile.camera_info.port}</div>
                      <div><strong>Manufacturer:</strong> {cameraProfile.camera_info.manufacturer}</div>
                      <div><strong>Model:</strong> {cameraProfile.camera_info.model}</div>
                      <div><strong>Firmware:</strong> {cameraProfile.camera_info.firmware}</div>
                      <div><strong>Serial:</strong> {cameraProfile.camera_info.serial}</div>
                    </div>
                  </div>

                  <Separator />

                  {/* Capabilities */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Capabilities</h3>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(cameraProfile.capabilities).map(([capability, supported]) => (
                        <Badge key={capability} variant={supported ? "default" : "secondary"}>
                          {capability.toUpperCase()}: {supported ? "Yes" : "No"}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Stream Profiles */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Stream Profiles ({cameraProfile.stream_profiles.length})</h3>
                    <div className="grid gap-3">
                      {cameraProfile.stream_profiles.map((profile, index) => (
                        <Card key={index}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Play className="h-4 w-4" />
                                  <span className="font-medium">{profile.name}</span>
                                  <Badge>{profile.encoding}</Badge>
                                  <Badge variant="outline">{profile.resolution}</Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {profile.framerate && `${profile.framerate} FPS`}
                                  {profile.bitrate && ` • ${Math.round(profile.bitrate / 1000)} kbps`}
                                </div>
                                {profile.rtsp_uri && (
                                  <div className="text-xs font-mono bg-accent p-1 rounded">
                                    {profile.rtsp_uri}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* PTZ Presets */}
                  {cameraProfile.has_ptz && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-lg font-semibold mb-3">PTZ Presets ({cameraProfile.ptz_presets.length})</h3>
                        <div className="grid gap-2">
                          {cameraProfile.ptz_presets.map((preset, index) => (
                            <div key={index} className="flex items-center justify-between p-2 border rounded">
                              <div className="flex items-center gap-2">
                                <Navigation className="h-4 w-4" />
                                <span>{preset.name}</span>
                                <Badge variant="outline">{preset.token}</Badge>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handlePTZPreset('goto', preset.token)}
                              >
                                Go To
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Please authenticate with a camera first to view profiles
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PTZ Control Tab */}
        <TabsContent value="ptz" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                PTZ Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cameraProfile?.has_ptz ? (
                <div className="space-y-6">
                  {/* Movement Controls */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Movement Controls</h3>
                    <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                      <div></div>
                      <Button
                        onClick={() => handlePTZControl('move_up')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <div></div>
                      
                      <Button
                        onClick={() => handlePTZControl('move_left')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handlePTZControl('stop')}
                        disabled={isPTZControlling}
                        size="sm"
                        variant="destructive"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handlePTZControl('move_right')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      
                      <div></div>
                      <Button
                        onClick={() => handlePTZControl('move_down')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <div></div>
                    </div>
                  </div>

                  {/* Zoom Controls */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Zoom Controls</h3>
                    <div className="flex gap-2 justify-center">
                      <Button
                        onClick={() => handlePTZControl('zoom_in')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ZoomIn className="h-4 w-4 mr-2" />
                        Zoom In
                      </Button>
                      <Button
                        onClick={() => handlePTZControl('zoom_out')}
                        disabled={isPTZControlling}
                        size="sm"
                      >
                        <ZoomOut className="h-4 w-4 mr-2" />
                        Zoom Out
                      </Button>
                    </div>
                  </div>

                  {/* Preset Management */}
                  {cameraProfile.ptz_presets.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Quick Presets</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {cameraProfile.ptz_presets.map((preset, index) => (
                          <Button
                            key={index}
                            onClick={() => handlePTZPreset('goto', preset.token)}
                            variant="outline"
                            size="sm"
                          >
                            {preset.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {cameraProfile ? 
                      'This camera does not support PTZ control' : 
                      'Please authenticate with a PTZ camera first'
                    }
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};