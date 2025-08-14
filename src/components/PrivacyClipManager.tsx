import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Download, 
  Clock, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  FileVideo,
  Settings
} from 'lucide-react';
import { removeBackground, loadImage, blurImage, detectFaces, detectLicensePlates } from '@/utils/privacyUtils';

interface PrivacyConfig {
  blur_faces_by_default: boolean;
  blur_plates_by_default: boolean;
  auto_apply_privacy: boolean;
  retention_days: number;
}

interface ClipProcessingJob {
  id: string;
  clip_id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_params: any;
  output_results: any;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export const PrivacyClipManager: React.FC = () => {
  const { toast } = useToast();
  const [privacyConfig, setPrivacyConfig] = useState<PrivacyConfig>({
    blur_faces_by_default: true,
    blur_plates_by_default: true,
    auto_apply_privacy: true,
    retention_days: 30
  });
  const [isLoading, setIsLoading] = useState(false);
  const [processingJobs, setProcessingJobs] = useState<ClipProcessingJob[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);

  const loadPrivacyConfig = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('privacy-processor', {
        body: { action: 'get_config' }
      });

      if (error) throw error;
      if (data?.config) {
        setPrivacyConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to load privacy config:', error);
      toast({
        title: "Error",
        description: "Failed to load privacy configuration",
        variant: "destructive"
      });
    }
  }, [toast]);

  const updatePrivacyConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('privacy-processor', {
        body: {
          action: 'update_config',
          config: privacyConfig
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Privacy configuration updated successfully"
      });
    } catch (error) {
      console.error('Failed to update privacy config:', error);
      toast({
        title: "Error",
        description: "Failed to update privacy configuration",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [privacyConfig, toast]);

  const processImagePreview = useCallback(async (file: File) => {
    if (!file) return;

    setIsLoading(true);
    setProcessingProgress(0);

    try {
      setProcessingProgress(25);
      
      // Load image
      const imageElement = await loadImage(file);
      setProcessingProgress(40);

      let processedBlob: Blob = file;
      let facesDetected = 0;
      let platesDetected = 0;

      // Process with privacy settings
      if (privacyConfig.blur_faces_by_default || privacyConfig.blur_plates_by_default) {
        const regions: Array<{x: number, y: number, width: number, height: number}> = [];
        
        if (privacyConfig.blur_faces_by_default) {
          const faces = await detectFaces(imageElement);
          facesDetected = faces.length;
          regions.push(...faces);
        }
        
        if (privacyConfig.blur_plates_by_default) {
          const plates = await detectLicensePlates(imageElement);
          platesDetected = plates.length;
          regions.push(...plates);
        }
        
        if (regions.length > 0) {
          setProcessingProgress(70);
          processedBlob = await blurImage(imageElement, regions, 15);
        }
      }

      setProcessingProgress(90);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(processedBlob);
      setProcessedPreview(previewUrl);
      setProcessingProgress(100);

      toast({
        title: "Privacy Processing Complete",
        description: `Detected ${facesDetected} faces and ${platesDetected} license plates`
      });
    } catch (error) {
      console.error('Privacy processing failed:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to apply privacy filters to image",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => setProcessingProgress(0), 1000);
    }
  }, [privacyConfig, toast]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      processImagePreview(file);
    }
  }, [processImagePreview]);

  const cleanupExpiredClips = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('privacy-processor', {
        body: { action: 'cleanup_expired' }
      });

      if (error) throw error;

      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.deleted_clips} expired clips`
      });
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast({
        title: "Cleanup Failed",
        description: "Failed to cleanup expired clips",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadPrivacyConfig();
  }, [loadPrivacyConfig]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Privacy & Clip Management</h1>
          <p className="text-muted-foreground">
            Configure privacy-by-default settings and manage clip retention
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Privacy Enabled
        </Badge>
      </div>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="clips">
            <FileVideo className="h-4 w-4 mr-2" />
            Clips
          </TabsTrigger>
          <TabsTrigger value="retention">
            <Clock className="h-4 w-4 mr-2" />
            Retention
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy Configuration
              </CardTitle>
              <CardDescription>
                Configure default privacy settings for clip processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="blur-faces">Blur Faces by Default</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically blur detected faces in clips
                    </p>
                  </div>
                  <Switch
                    id="blur-faces"
                    checked={privacyConfig.blur_faces_by_default}
                    onCheckedChange={(checked) =>
                      setPrivacyConfig(prev => ({ ...prev, blur_faces_by_default: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="blur-plates">Blur License Plates by Default</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically blur detected license plates in clips
                    </p>
                  </div>
                  <Switch
                    id="blur-plates"
                    checked={privacyConfig.blur_plates_by_default}
                    onCheckedChange={(checked) =>
                      setPrivacyConfig(prev => ({ ...prev, blur_plates_by_default: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-privacy">Auto-Apply Privacy</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically apply privacy filters to new clips
                    </p>
                  </div>
                  <Switch
                    id="auto-privacy"
                    checked={privacyConfig.auto_apply_privacy}
                    onCheckedChange={(checked) =>
                      setPrivacyConfig(prev => ({ ...prev, auto_apply_privacy: checked }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Default Retention Period (days)</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    min="1"
                    max="365"
                    value={privacyConfig.retention_days}
                    onChange={(e) =>
                      setPrivacyConfig(prev => ({ 
                        ...prev, 
                        retention_days: parseInt(e.target.value) || 30 
                      }))
                    }
                    className="w-32"
                  />
                  <p className="text-sm text-muted-foreground">
                    Clips will be automatically deleted after this period
                  </p>
                </div>
              </div>

              <Button 
                onClick={updatePrivacyConfig} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Updating..." : "Update Privacy Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Privacy Preview
              </CardTitle>
              <CardDescription>
                Test privacy filters on sample images
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <div className="space-y-2">
                    <FileVideo className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div className="text-lg font-medium">Upload Image for Preview</div>
                    <p className="text-muted-foreground">
                      Click to select an image to test privacy filters
                    </p>
                  </div>
                </label>
              </div>

              {processingProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing privacy filters...</span>
                    <span>{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} />
                </div>
              )}

              {selectedFile && processedPreview && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Original Image</Label>
                    <img
                      src={URL.createObjectURL(selectedFile)}
                      alt="Original"
                      className="w-full rounded-lg border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Privacy Processed</Label>
                    <img
                      src={processedPreview}
                      alt="Privacy processed"
                      className="w-full rounded-lg border"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clips" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileVideo className="h-5 w-5" />
                Clip Processing Status
              </CardTitle>
              <CardDescription>
                Monitor privacy processing jobs and clip status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {processingJobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No processing jobs found
                  </div>
                ) : (
                  processingJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {job.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                        {job.status === 'processing' && <Clock className="h-5 w-5 text-blue-500 animate-spin" />}
                        {job.status === 'failed' && <AlertCircle className="h-5 w-5 text-red-500" />}
                        <div>
                          <div className="font-medium">Clip {job.clip_id.slice(0, 8)}...</div>
                          <div className="text-sm text-muted-foreground">{job.job_type}</div>
                        </div>
                      </div>
                      <Badge variant={job.status === 'completed' ? 'default' : 'secondary'}>
                        {job.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Retention Management
              </CardTitle>
              <CardDescription>
                Manage clip storage and automatic cleanup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Automatic Cleanup</div>
                    <p className="text-sm text-muted-foreground">
                      Remove clips older than {privacyConfig.retention_days} days
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={cleanupExpiredClips}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isLoading ? "Cleaning..." : "Run Cleanup"}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Storage Optimization</div>
                    <p className="text-sm text-muted-foreground">
                      Compress and optimize existing clips
                    </p>
                  </div>
                  <Button variant="outline" disabled>
                    <Download className="h-4 w-4 mr-2" />
                    Coming Soon
                  </Button>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Retention Policy</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Clips are automatically deleted after {privacyConfig.retention_days} days</li>
                  <li>• Privacy processing is applied before storage</li>
                  <li>• Checksums are calculated for integrity verification</li>
                  <li>• Audit logs are maintained for compliance</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};