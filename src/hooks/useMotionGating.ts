import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MotionFrame {
  timestamp: Date;
  pixels: Uint8ClampedArray;
}

interface MotionConfig {
  motion_gate_enabled: boolean;
  motion_threshold: number;
  interest_zones: Array<{
    name: string;
    polygon: Array<{ x: number; y: number }>;
  }>;
  exclusion_zones: Array<{
    name: string;
    polygon: Array<{ x: number; y: number }>;
  }>;
}

export function useMotionGating() {
  const [motionStates, setMotionStates] = useState<Map<string, MotionFrame>>(new Map());
  const configCache = useRef<Map<string, MotionConfig>>(new Map());

  const getCameraConfig = useCallback(async (cameraId: string): Promise<MotionConfig> => {
    if (configCache.current.has(cameraId)) {
      return configCache.current.get(cameraId)!;
    }

    try {
      const { data, error } = await supabase
        .from('camera_ai_profiles')
        .select(`
          motion_gate_enabled,
          motion_threshold,
          interest_zones,
          exclusion_zones
        `)
        .eq('camera_id', cameraId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        const defaultConfig: MotionConfig = {
          motion_gate_enabled: true,
          motion_threshold: 0.02,
          interest_zones: [],
          exclusion_zones: []
        };
        configCache.current.set(cameraId, defaultConfig);
        return defaultConfig;
      }

      const config: MotionConfig = {
        motion_gate_enabled: data.motion_gate_enabled,
        motion_threshold: data.motion_threshold,
        interest_zones: data.interest_zones || [],
        exclusion_zones: data.exclusion_zones || []
      };

      configCache.current.set(cameraId, config);
      return config;
    } catch (error) {
      console.error('Error loading motion config:', error);
      const defaultConfig: MotionConfig = {
        motion_gate_enabled: true,
        motion_threshold: 0.02,
        interest_zones: [],
        exclusion_zones: []
      };
      return defaultConfig;
    }
  }, []);

  const extractFramePixels = useCallback((
    videoElement: HTMLVideoElement,
    canvas?: HTMLCanvasElement
  ): Uint8ClampedArray | null => {
    try {
      const canvasEl = canvas || document.createElement('canvas');
      const ctx = canvasEl.getContext('2d');
      if (!ctx) return null;

      canvasEl.width = videoElement.videoWidth || 320;
      canvasEl.height = videoElement.videoHeight || 240;
      
      ctx.drawImage(videoElement, 0, 0, canvasEl.width, canvasEl.height);
      
      const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
      return imageData.data;
    } catch (error) {
      console.error('Error extracting frame pixels:', error);
      return null;
    }
  }, []);

  const calculateMotionDifference = useCallback((
    currentPixels: Uint8ClampedArray,
    previousPixels: Uint8ClampedArray
  ): number => {
    if (currentPixels.length !== previousPixels.length) {
      return 0;
    }

    let totalDifference = 0;
    let pixelCount = 0;

    // Compare luminance values (convert to grayscale and compare)
    for (let i = 0; i < currentPixels.length; i += 4) {
      const currentLuma = 0.299 * currentPixels[i] + 0.587 * currentPixels[i + 1] + 0.114 * currentPixels[i + 2];
      const previousLuma = 0.299 * previousPixels[i] + 0.587 * previousPixels[i + 1] + 0.114 * previousPixels[i + 2];
      
      totalDifference += Math.abs(currentLuma - previousLuma);
      pixelCount++;
    }

    // Normalize to 0-1 range
    return totalDifference / (pixelCount * 255);
  }, []);

  const isPointInPolygon = useCallback((
    point: { x: number; y: number },
    polygon: Array<{ x: number; y: number }>
  ): boolean => {
    if (polygon.length < 3) return false;

    let inside = false;
    const x = point.x;
    const y = point.y;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }, []);

  const isDetectionInZones = useCallback((
    bbox: number[], // [x1, y1, x2, y2] normalized 0-1
    config: MotionConfig,
    frameWidth: number,
    frameHeight: number
  ): { inInterestZone: boolean; inExclusionZone: boolean } => {
    const centerX = ((bbox[0] + bbox[2]) / 2) * frameWidth;
    const centerY = ((bbox[1] + bbox[3]) / 2) * frameHeight;
    const center = { x: centerX, y: centerY };

    let inInterestZone = config.interest_zones.length === 0; // Default to true if no zones defined
    let inExclusionZone = false;

    // Check interest zones
    for (const zone of config.interest_zones) {
      if (this.isPointInPolygon(center, zone.polygon)) {
        inInterestZone = true;
        break;
      }
    }

    // Check exclusion zones
    for (const zone of config.exclusion_zones) {
      if (this.isPointInPolygon(center, zone.polygon)) {
        inExclusionZone = true;
        break;
      }
    }

    return { inInterestZone, inExclusionZone };
  }, [isPointInPolygon]);

  const shouldProcessFrame = useCallback(async (
    cameraId: string,
    videoElement: HTMLVideoElement,
    canvas?: HTMLCanvasElement
  ): Promise<{ shouldProcess: boolean; motionMagnitude: number }> => {
    const config = await getCameraConfig(cameraId);
    
    if (!config.motion_gate_enabled) {
      return { shouldProcess: true, motionMagnitude: 0 };
    }

    const currentPixels = extractFramePixels(videoElement, canvas);
    if (!currentPixels) {
      return { shouldProcess: true, motionMagnitude: 0 };
    }

    const previousFrame = motionStates.get(cameraId);
    let motionMagnitude = 0;

    if (previousFrame) {
      motionMagnitude = calculateMotionDifference(currentPixels, previousFrame.pixels);
    }

    // Update motion state
    setMotionStates(prevStates => {
      const newStates = new Map(prevStates);
      newStates.set(cameraId, {
        timestamp: new Date(),
        pixels: currentPixels
      });
      return newStates;
    });

    const shouldProcess = !previousFrame || motionMagnitude >= config.motion_threshold;

    return { shouldProcess, motionMagnitude };
  }, [getCameraConfig, extractFramePixels, calculateMotionDifference, motionStates]);

  const filterDetectionsByZones = useCallback(async (
    cameraId: string,
    detections: Array<{
      bbox: number[];
      confidence: number;
      label: string;
    }>,
    frameWidth: number = 640,
    frameHeight: number = 480
  ) => {
    const config = await getCameraConfig(cameraId);
    
    return detections.filter(detection => {
      const { inInterestZone, inExclusionZone } = isDetectionInZones(
        detection.bbox,
        config,
        frameWidth,
        frameHeight
      );
      
      // Include detection if it's in an interest zone and not in an exclusion zone
      return inInterestZone && !inExclusionZone;
    });
  }, [getCameraConfig, isDetectionInZones]);

  const getMotionStateForCamera = useCallback((cameraId: string): MotionFrame | null => {
    return motionStates.get(cameraId) || null;
  }, [motionStates]);

  const cleanupOldMotionStates = useCallback((maxAgeMs: number = 60000) => {
    const now = Date.now();
    setMotionStates(prevStates => {
      const newStates = new Map(prevStates);
      
      for (const [cameraId, frame] of newStates.entries()) {
        if (now - frame.timestamp.getTime() > maxAgeMs) {
          newStates.delete(cameraId);
        }
      }
      
      return newStates;
    });
  }, []);

  return {
    shouldProcessFrame,
    filterDetectionsByZones,
    getMotionStateForCamera,
    cleanupOldMotionStates,
    motionStates: Array.from(motionStates.entries()).map(([cameraId, frame]) => ({
      cameraId,
      ...frame
    }))
  };
}