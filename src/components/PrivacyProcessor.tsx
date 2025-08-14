import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, Shield, Eye, EyeOff, Download, CheckCircle } from 'lucide-react';
import { removeBackground, loadImage, blurImage, detectFaces, detectLicensePlates } from '@/utils/privacyUtils';
import { toast } from 'sonner';

interface PrivacyProcessorProps {
  className?: string;
}

interface ProcessingResult {
  originalImage: string;
  processedImage: string;
  facesDetected: number;
  platesDetected: number;
  processingTime: number;
}

const PrivacyProcessor: React.FC<PrivacyProcessorProps> = ({ className = '' }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessingResult | null>(null);
  
  // Privacy settings
  const [blurFaces, setBlurFaces] = useState(true);
  const [blurPlates, setBlurPlates] = useState(true);
  const [removeBackgroundEnabled, setRemoveBackgroundEnabled] = useState(false);
  const [blurStrength, setBlurStrength] = useState([10]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setResult(null);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setProgress(0);

    try {
      const startTime = Date.now();
      
      // Load image
      setProgress(10);
      const imageElement = await loadImage(selectedFile);
      
      let processedBlob: Blob = selectedFile;
      let facesDetected = 0;
      let platesDetected = 0;

      // Background removal (if enabled)
      if (removeBackgroundEnabled) {
        setProgress(30);
        processedBlob = await removeBackground(imageElement);
        toast.success('Background removed successfully');
      }

      // Privacy blur processing
      if (blurFaces || blurPlates) {
        setProgress(50);
        const regions: Array<{x: number, y: number, width: number, height: number}> = [];
        
        if (blurFaces) {
          const faces = await detectFaces(imageElement);
          facesDetected = faces.length;
          regions.push(...faces);
        }
        
        if (blurPlates) {
          const plates = await detectLicensePlates(imageElement);
          platesDetected = plates.length;
          regions.push(...plates);
        }
        
        if (regions.length > 0) {
          setProgress(70);
          // Reload image element if background was removed
          const imageToBlur = removeBackgroundEnabled ? await loadImage(processedBlob) : imageElement;
          processedBlob = await blurImage(imageToBlur, regions, blurStrength[0]);
        }
      }

      setProgress(90);
      
      // Create result
      const processedUrl = URL.createObjectURL(processedBlob);
      const processingTime = Date.now() - startTime;
      
      setResult({
        originalImage: previewUrl!,
        processedImage: processedUrl,
        facesDetected,
        platesDetected,
        processingTime
      });

      setProgress(100);
      toast.success(`Privacy processing completed in ${processingTime}ms`);
      
    } catch (error) {
      console.error('Privacy processing failed:', error);
      toast.error('Privacy processing failed. Please try again.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const downloadResult = () => {
    if (result) {
      const link = document.createElement('a');
      link.href = result.processedImage;
      link.download = `privacy-processed-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Privacy-processed image downloaded');
    }
  };

  const resetProcessor = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy Processor
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Apply privacy-by-default processing: blur faces, license plates, and remove backgrounds
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium mb-2">Upload Image for Privacy Processing</p>
              <p className="text-sm text-muted-foreground mb-4">
                Supports JPEG, PNG, and other image formats
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                Select Image
              </Button>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Privacy Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="blur-faces" className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Blur Faces
                </Label>
                <Switch
                  id="blur-faces"
                  checked={blurFaces}
                  onCheckedChange={setBlurFaces}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="blur-plates" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Blur License Plates
                </Label>
                <Switch
                  id="blur-plates"
                  checked={blurPlates}
                  onCheckedChange={setBlurPlates}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="remove-bg" className="flex items-center gap-2">
                  <EyeOff className="w-4 h-4" />
                  Remove Background
                </Label>
                <Switch
                  id="remove-bg"
                  checked={removeBackgroundEnabled}
                  onCheckedChange={setRemoveBackgroundEnabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blur-strength">Blur Strength: {blurStrength[0]}px</Label>
              <Slider
                id="blur-strength"
                min={1}
                max={30}
                step={1}
                value={blurStrength}
                onValueChange={setBlurStrength}
                disabled={!blurFaces && !blurPlates}
              />
            </div>
          </div>

          {/* Image Preview */}
          {previewUrl && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Original Image</h4>
                  <img
                    src={previewUrl}
                    alt="Original"
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                </div>
                
                {result && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Privacy Processed</h4>
                    <img
                      src={result.processedImage}
                      alt="Processed"
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>

              {/* Processing Controls */}
              <div className="flex gap-3">
                <Button
                  onClick={processImage}
                  disabled={processing || (!blurFaces && !blurPlates && !removeBackgroundEnabled)}
                  className="flex-1"
                >
                  {processing ? 'Processing...' : 'Apply Privacy Processing'}
                </Button>
                
                {result && (
                  <Button onClick={downloadResult} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
                
                <Button onClick={resetProcessor} variant="outline">
                  Reset
                </Button>
              </div>

              {/* Progress */}
              {processing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* Results */}
              {result && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="font-medium">Privacy Processing Completed</span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Faces Detected</p>
                      <Badge variant="secondary">{result.facesDetected}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plates Detected</p>
                      <Badge variant="secondary">{result.platesDetected}</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Processing Time</p>
                      <Badge variant="outline">{result.processingTime}ms</Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Privacy Applied</p>
                      <Badge variant="default">
                        {blurFaces || blurPlates || removeBackgroundEnabled ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PrivacyProcessor;