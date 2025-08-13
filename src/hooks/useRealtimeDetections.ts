import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RealtimeDetection {
  id: string;
  frame_id: string;
  camera_id: string;
  service: string;
  detection_type: string;
  confidence: number;
  bbox: number[];
  metadata: Record<string, any>;
  created_at: string;
}

export function useRealtimeDetections(cameraId?: string) {
  const [detections, setDetections] = useState<RealtimeDetection[]>([]);
  const [latestDetection, setLatestDetection] = useState<RealtimeDetection | null>(null);
  const buffersRef = useRef<Map<string, RealtimeDetection[]>>(new Map());

  useEffect(() => {
    const channel = supabase
      .channel('detections_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'detections',
          ...(cameraId && { filter: `camera_id=eq.${cameraId}` })
        },
        (payload) => {
          const detection = payload.new as RealtimeDetection;
          
          // Update buffer for this camera
          const currentBuffer = buffersRef.current.get(detection.camera_id) || [];
          const updatedBuffer = [...currentBuffer, detection].slice(-10); // Keep last 10
          buffersRef.current.set(detection.camera_id, updatedBuffer);
          
          // Update state
          setDetections(prev => [...prev, detection].slice(-50)); // Keep last 50 total
          setLatestDetection(detection);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [cameraId]);

  const getDetectionsForCamera = (camId: string) => {
    return buffersRef.current.get(camId) || [];
  };

  return {
    detections,
    latestDetection,
    getDetectionsForCamera
  };
}