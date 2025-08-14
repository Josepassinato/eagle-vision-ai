import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, Clock, Hash, Download, Trash2, Settings, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PrivacyProcessor from '@/components/PrivacyProcessor';

interface ClipManagerProps {
  className?: string;
}

interface ClipData {
  id: string;
  camera_id: string;
  start_time: string;
  end_time: string;
  clip_path: string;
  checksum: string;
  pre_roll_seconds: number;
  post_roll_seconds: number;
  privacy_applied: boolean;
  faces_blurred: boolean;
  plates_blurred: boolean;
  retention_days: number;
  expires_at: string;
  upload_status: string;
  created_at: string;
  file_size_bytes?: number;
}

interface PrivacyConfig {
  blur_faces_by_default: boolean;
  blur_plates_by_default: boolean;
  auto_apply_privacy: boolean;
  retention_days: number;
}

const ClipManager: React.FC<ClipManagerProps> = ({ className = '' }) => {
  const [clips, setClips] = useState<ClipData[]>([]);
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>({
    blur_faces_by_default: true,
    blur_plates_by_default: true,
    auto_apply_privacy: true,
    retention_days: 30
  });
  const [loading, setLoading] = useState(true);
  const [showPrivacyProcessor, setShowPrivacyProcessor] = useState(false);

  // Export clip settings
  const [exportSettings, setExportSettings] = useState({
    camera_id: 'camera_001',
    pre_roll_seconds: 3,
    post_roll_seconds: 5,
    apply_privacy: true
  });

  useEffect(() => {
    fetchClips();
    fetchPrivacyConfig();
  }, []);

  const fetchClips = async () => {
    try {
      const { data, error } = await supabase
        .from('edge_clips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setClips(data || []);
    } catch (error) {
      console.error('Error fetching clips:', error);
      toast.error('Failed to fetch clips');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrivacyConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('privacy_configurations')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPrivacyConfig(data);
      }
    } catch (error) {
      console.error('Error fetching privacy config:', error);
    }
  };

  const updatePrivacyConfig = async () => {
    try {
      const { error } = await supabase
        .from('privacy_configurations')
        .upsert(privacyConfig);

      if (error) throw error;
      toast.success('Privacy configuration updated');
    } catch (error) {
      console.error('Error updating privacy config:', error);
      toast.error('Failed to update privacy configuration');
    }
  };

  const exportTestClip = async () => {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 30000); // 30 seconds ago
      
      const response = await supabase.functions.invoke('clip-exporter', {
        body: {
          camera_id: exportSettings.camera_id,
          start_time: startTime.toISOString(),
          end_time: now.toISOString(),
          pre_roll_seconds: exportSettings.pre_roll_seconds,
          post_roll_seconds: exportSettings.post_roll_seconds,
          apply_privacy: exportSettings.apply_privacy,
          blur_faces: privacyConfig.blur_faces_by_default,
          blur_plates: privacyConfig.blur_plates_by_default
        }
      });

      if (response.error) throw response.error;

      toast.success('Clip export initiated successfully');
      await fetchClips(); // Refresh clips list
    } catch (error) {
      console.error('Error exporting clip:', error);
      toast.error('Failed to export clip');
    }
  };

  const deleteClip = async (clipId: string) => {
    try {
      const { error } = await supabase
        .from('edge_clips')
        .delete()
        .eq('id', clipId);

      if (error) throw error;
      
      setClips(clips.filter(clip => clip.id !== clipId));
      toast.success('Clip deleted successfully');
    } catch (error) {
      console.error('Error deleting clip:', error);
      toast.error('Failed to delete clip');
    }
  };

  const cleanupExpiredClips = async () => {
    try {
      const { data, error } = await supabase
        .rpc('cleanup_expired_clips');

      if (error) throw error;
      
      toast.success(`Cleaned up ${data} expired clips`);
      await fetchClips(); // Refresh clips list
    } catch (error) {
      console.error('Error cleaning up clips:', error);
      toast.error('Failed to cleanup expired clips');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      pending: 'secondary',
      processing: 'outline',
      completed: 'default',
      failed: 'destructive'
    } as const;

    return (
      <Badge variant={statusColors[status as keyof typeof statusColors] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading clips...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Privacy Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-privacy">Auto Apply Privacy</Label>
              <Switch
                id="auto-privacy"
                checked={privacyConfig.auto_apply_privacy}
                onCheckedChange={(checked) => 
                  setPrivacyConfig({ ...privacyConfig, auto_apply_privacy: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="blur-faces">Blur Faces by Default</Label>
              <Switch
                id="blur-faces"
                checked={privacyConfig.blur_faces_by_default}
                onCheckedChange={(checked) => 
                  setPrivacyConfig({ ...privacyConfig, blur_faces_by_default: checked })
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="blur-plates">Blur Plates by Default</Label>
              <Switch
                id="blur-plates"
                checked={privacyConfig.blur_plates_by_default}
                onCheckedChange={(checked) => 
                  setPrivacyConfig({ ...privacyConfig, blur_plates_by_default: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retention-days">Retention Days</Label>
              <Input
                id="retention-days"
                type="number"
                min="1"
                max="365"
                value={privacyConfig.retention_days}
                onChange={(e) => 
                  setPrivacyConfig({ ...privacyConfig, retention_days: parseInt(e.target.value) || 30 })
                }
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={updatePrivacyConfig}>
              <Settings className="w-4 h-4 mr-2" />
              Update Configuration
            </Button>
            
            <Button 
              onClick={() => setShowPrivacyProcessor(!showPrivacyProcessor)}
              variant="outline"
            >
              <Eye className="w-4 h-4 mr-2" />
              {showPrivacyProcessor ? 'Hide' : 'Show'} Privacy Processor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Privacy Processor */}
      {showPrivacyProcessor && (
        <PrivacyProcessor />
      )}

      {/* Clip Export Test */}
      <Card>
        <CardHeader>
          <CardTitle>Test Clip Export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="camera-id">Camera ID</Label>
              <Input
                id="camera-id"
                value={exportSettings.camera_id}
                onChange={(e) => 
                  setExportSettings({ ...exportSettings, camera_id: e.target.value })
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pre-roll">Pre-roll (seconds)</Label>
              <Input
                id="pre-roll"
                type="number"
                min="0"
                max="30"
                value={exportSettings.pre_roll_seconds}
                onChange={(e) => 
                  setExportSettings({ ...exportSettings, pre_roll_seconds: parseInt(e.target.value) || 3 })
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="post-roll">Post-roll (seconds)</Label>
              <Input
                id="post-roll"
                type="number"
                min="0"
                max="60"
                value={exportSettings.post_roll_seconds}
                onChange={(e) => 
                  setExportSettings({ ...exportSettings, post_roll_seconds: parseInt(e.target.value) || 5 })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="apply-privacy">Apply Privacy</Label>
              <Switch
                id="apply-privacy"
                checked={exportSettings.apply_privacy}
                onCheckedChange={(checked) => 
                  setExportSettings({ ...exportSettings, apply_privacy: checked })
                }
              />
            </div>
          </div>

          <Button onClick={exportTestClip} className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Export Test Clip
          </Button>
        </CardContent>
      </Card>

      {/* Clips List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Clips Management</CardTitle>
          <div className="flex gap-2">
            <Button onClick={cleanupExpiredClips} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Cleanup Expired
            </Button>
            <Button onClick={fetchClips} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clips.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No clips found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clips.map((clip) => (
                <div key={clip.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{clip.camera_id}</h4>
                      {getStatusBadge(clip.upload_status)}
                    </div>
                    <Button
                      onClick={() => deleteClip(clip.id)}
                      variant="ghost"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p>{clip.pre_roll_seconds + clip.post_roll_seconds + 10}s</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">File Size</p>
                      <p>{formatFileSize(clip.file_size_bytes)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Retention</p>
                      <p>{clip.retention_days} days</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p>{formatDate(clip.expires_at)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {clip.privacy_applied && (
                      <Badge variant="secondary">
                        <Shield className="w-3 h-3 mr-1" />
                        Privacy Applied
                      </Badge>
                    )}
                    {clip.faces_blurred && (
                      <Badge variant="outline">Faces Blurred</Badge>
                    )}
                    {clip.plates_blurred && (
                      <Badge variant="outline">Plates Blurred</Badge>
                    )}
                    <Badge variant="secondary">
                      <Hash className="w-3 h-3 mr-1" />
                      {clip.checksum.substring(0, 8)}...
                    </Badge>
                    <Badge variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      Pre: {clip.pre_roll_seconds}s, Post: {clip.post_roll_seconds}s
                    </Badge>
                  </div>

                  <Separator />
                  
                  <div className="text-xs text-muted-foreground">
                    <p>Created: {formatDate(clip.created_at)}</p>
                    <p>Path: {clip.clip_path}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClipManager;