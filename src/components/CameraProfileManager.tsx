import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Settings, BarChart3, Zap, Target, Filter } from 'lucide-react';

interface CameraProfile {
  id: string;
  camera_id: string;
  profile_name: string;
  conf_threshold: number;
  nms_threshold: number;
  brightness_gamma: number;
  contrast_gamma: number;
  exposure_compensation: number;
  interest_zones: any;
  exclusion_zones: any;
  hysteresis_enter_threshold: number;
  hysteresis_exit_threshold: number;
  smoothing_window_frames: number;
  min_event_duration_ms: number;
  motion_gate_enabled: boolean;
  motion_threshold: number;
  class_mappings: any;
  suppression_rules: any;
  scene_type: string;
  tracker_iou_threshold: number;
  tracker_max_age: number;
  tracker_min_hits: number;
  is_active: boolean;
}

interface Camera {
  id: string;
  name: string;
  stream_url: string;
  online: boolean;
}

export function CameraProfileManager() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [profiles, setProfiles] = useState<CameraProfile[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<CameraProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCameras();
    loadProfiles();
  }, []);

  const loadCameras = async () => {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCameras(data || []);
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast.error('Failed to load cameras');
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('camera_ai_profiles')
        .select('*')
        .order('camera_id, profile_name');
      
      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast.error('Failed to load profiles');
    }
  };

  const createDefaultProfile = async (cameraId: string) => {
    try {
      setIsLoading(true);
      
      const defaultProfile = {
        camera_id: cameraId,
        profile_name: 'default',
        conf_threshold: 0.5,
        nms_threshold: 0.4,
        brightness_gamma: 1.0,
        contrast_gamma: 1.0,
        exposure_compensation: 0.0,
        interest_zones: [],
        exclusion_zones: [],
        hysteresis_enter_threshold: 0.7,
        hysteresis_exit_threshold: 0.5,
        smoothing_window_frames: 5,
        min_event_duration_ms: 1000,
        motion_gate_enabled: true,
        motion_threshold: 0.02,
        class_mappings: {},
        suppression_rules: [],
        scene_type: 'general',
        tracker_iou_threshold: 0.3,
        tracker_max_age: 30,
        tracker_min_hits: 3,
        is_active: true
      };

      const { data, error } = await supabase
        .from('camera_ai_profiles')
        .insert({
          ...defaultProfile,
          org_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Default profile created');
      setSelectedProfile(data);
      loadProfiles();
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<CameraProfile>) => {
    if (!selectedProfile) return;

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('camera_ai_profiles')
        .update(updates)
        .eq('id', selectedProfile.id)
        .select()
        .single();

      if (error) throw error;
      
      setSelectedProfile(data);
      loadProfiles();
      toast.success('Profile updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const cameraProfiles = profiles.filter(p => p.camera_id === selectedCamera);
  const selectedCameraData = cameras.find(c => c.id === selectedCamera);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Camera AI Profiles</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Camera Selection
          </CardTitle>
          <CardDescription>
            Configure AI processing parameters per camera for optimal quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="camera-select">Select Camera</Label>
              <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a camera..." />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.id} value={camera.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${camera.online ? 'bg-green-500' : 'bg-red-500'}`} />
                        {camera.name || camera.id}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCamera && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {selectedCameraData?.name || selectedCamera}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {cameraProfiles.length} profile(s) configured
                    </p>
                  </div>
                  <Badge variant={selectedCameraData?.online ? 'default' : 'destructive'}>
                    {selectedCameraData?.online ? 'Online' : 'Offline'}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  {cameraProfiles.map((profile) => (
                    <Button
                      key={profile.id}
                      variant={selectedProfile?.id === profile.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedProfile(profile)}
                    >
                      {profile.profile_name}
                      {profile.is_active && <Badge className="ml-2">Active</Badge>}
                    </Button>
                  ))}
                  {cameraProfiles.length === 0 && (
                    <Button 
                      onClick={() => createDefaultProfile(selectedCamera)}
                      disabled={isLoading}
                    >
                      Create Default Profile
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedProfile && (
        <Tabs defaultValue="detection" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detection">Detection</TabsTrigger>
            <TabsTrigger value="temporal">Temporal</TabsTrigger>
            <TabsTrigger value="zones">Zones & Motion</TabsTrigger>
            <TabsTrigger value="tracking">Tracking</TabsTrigger>
          </TabsList>

          <TabsContent value="detection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Detection Thresholds
                </CardTitle>
                <CardDescription>
                  Adjust confidence and NMS thresholds per camera
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Confidence Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedProfile.conf_threshold}
                      onChange={(e) => updateProfile({ conf_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum confidence to consider a detection (0.0-1.0)
                    </p>
                  </div>
                  <div>
                    <Label>NMS Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedProfile.nms_threshold}
                      onChange={(e) => updateProfile({ nms_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Non-Maximum Suppression threshold
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Visual Normalization</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Brightness Gamma</Label>
                      <Input
                        type="number"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={selectedProfile.brightness_gamma}
                        onChange={(e) => updateProfile({ brightness_gamma: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Contrast Gamma</Label>
                      <Input
                        type="number"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={selectedProfile.contrast_gamma}
                        onChange={(e) => updateProfile({ contrast_gamma: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Exposure Compensation</Label>
                      <Input
                        type="number"
                        min="-2.0"
                        max="2.0"
                        step="0.1"
                        value={selectedProfile.exposure_compensation}
                        onChange={(e) => updateProfile({ exposure_compensation: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Scene Type</h4>
                  <Select 
                    value={selectedProfile.scene_type} 
                    onValueChange={(value) => updateProfile({ scene_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="retail">Retail Store</SelectItem>
                      <SelectItem value="parking">Parking Lot</SelectItem>
                      <SelectItem value="office">Office Environment</SelectItem>
                      <SelectItem value="industrial">Industrial Site</SelectItem>
                      <SelectItem value="education">Educational Facility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="temporal" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Temporal Smoothing & Hysteresis
                </CardTitle>
                <CardDescription>
                  Reduce false positives with temporal filtering
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Enter Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedProfile.hysteresis_enter_threshold}
                      onChange={(e) => updateProfile({ hysteresis_enter_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Confidence to enter detection state
                    </p>
                  </div>
                  <div>
                    <Label>Exit Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={selectedProfile.hysteresis_exit_threshold}
                      onChange={(e) => updateProfile({ hysteresis_exit_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Confidence to exit detection state
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Smoothing Window (frames)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={selectedProfile.smoothing_window_frames}
                      onChange={(e) => updateProfile({ smoothing_window_frames: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Frames for exponential moving average
                    </p>
                  </div>
                  <div>
                    <Label>Min Event Duration (ms)</Label>
                    <Input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={selectedProfile.min_event_duration_ms}
                      onChange={(e) => updateProfile({ min_event_duration_ms: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum duration to emit event
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="zones" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Zone Gating & Motion Detection
                </CardTitle>
                <CardDescription>
                  Define areas of interest and motion-based triggering
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Motion Gate Enabled</Label>
                      <p className="text-sm text-muted-foreground">
                        Only process when motion is detected
                      </p>
                    </div>
                    <Switch
                      checked={selectedProfile.motion_gate_enabled}
                      onCheckedChange={(checked) => updateProfile({ motion_gate_enabled: checked })}
                    />
                  </div>

                  {selectedProfile.motion_gate_enabled && (
                    <div>
                      <Label>Motion Threshold</Label>
                      <Input
                        type="number"
                        min="0.001"
                        max="0.1"
                        step="0.001"
                        value={selectedProfile.motion_threshold}
                        onChange={(e) => updateProfile({ motion_threshold: parseFloat(e.target.value) })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimum motion magnitude to trigger processing
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Interest Zones</h4>
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                    <p>Interest zones: {selectedProfile.interest_zones.length} defined</p>
                    <p>Exclusion zones: {selectedProfile.exclusion_zones.length} defined</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Configure Zones (Coming Soon)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tracking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Tracker Configuration
                </CardTitle>
                <CardDescription>
                  Fine-tune tracking parameters for scene type
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>IoU Threshold</Label>
                    <Input
                      type="number"
                      min="0.1"
                      max="0.9"
                      step="0.01"
                      value={selectedProfile.tracker_iou_threshold}
                      onChange={(e) => updateProfile({ tracker_iou_threshold: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Intersection over Union for matching
                    </p>
                  </div>
                  <div>
                    <Label>Max Age (frames)</Label>
                    <Input
                      type="number"
                      min="5"
                      max="100"
                      value={selectedProfile.tracker_max_age}
                      onChange={(e) => updateProfile({ tracker_max_age: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Frames before track deletion
                    </p>
                  </div>
                  <div>
                    <Label>Min Hits</Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={selectedProfile.tracker_min_hits}
                      onChange={(e) => updateProfile({ tracker_min_hits: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Detections before track confirmation
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Class Remapping</h4>
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                    <p>Active mappings: {Object.keys(selectedProfile.class_mappings).length}</p>
                    <p>Suppression rules: {selectedProfile.suppression_rules.length}</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Configure Mappings (Coming Soon)
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Profile Active</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable this profile for AI processing
                    </p>
                  </div>
                  <Switch
                    checked={selectedProfile.is_active}
                    onCheckedChange={(checked) => updateProfile({ is_active: checked })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}