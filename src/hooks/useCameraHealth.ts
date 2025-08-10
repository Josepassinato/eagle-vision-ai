import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CameraHealth {
  camera_id: string;
  online: boolean;
  last_seen: string | null;
  estimated_fps: number;
  health_score: number;
  status: 'healthy' | 'degraded' | 'offline' | 'error';
  error_count: number;
  latency_ms: number;
  circuit_breaker_state: 'closed' | 'open' | 'half_open';
}

interface UseCameraHealthReturn {
  cameraHealth: CameraHealth[];
  loading: boolean;
  error: string | null;
  refreshHealth: () => void;
  getCameraStatus: (cameraId: string) => CameraHealth | null;
}

export const useCameraHealth = (): UseCameraHealthReturn => {
  const [cameraHealth, setCameraHealth] = useState<CameraHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCameraHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch basic camera data
      const { data: cameras, error: camerasError } = await supabase
        .from('cameras')
        .select('id, name, online, last_seen');

      if (camerasError) {
        throw camerasError;
      }

      // Simulate health metrics (in real implementation, these would come from monitoring service)
      const healthData: CameraHealth[] = cameras.map(camera => {
        const lastSeen = camera.last_seen ? new Date(camera.last_seen) : null;
        const minutesSinceLastSeen = lastSeen ? 
          (Date.now() - lastSeen.getTime()) / (1000 * 60) : Infinity;

        // Calculate health score based on online status and last seen
        let healthScore = 0;
        let status: CameraHealth['status'] = 'offline';
        let estimatedFps = 0;
        let errorCount = 0;
        let latencyMs = 0;
        let circuitBreakerState: CameraHealth['circuit_breaker_state'] = 'open';

        if (camera.online && minutesSinceLastSeen < 5) {
          healthScore = 100;
          status = 'healthy';
          estimatedFps = 25; // Simulated
          circuitBreakerState = 'closed';
          latencyMs = 150;
        } else if (camera.online && minutesSinceLastSeen < 15) {
          healthScore = 70;
          status = 'degraded';
          estimatedFps = 15;
          circuitBreakerState = 'half_open';
          errorCount = 2;
          latencyMs = 300;
        } else if (camera.online) {
          healthScore = 30;
          status = 'error';
          estimatedFps = 5;
          circuitBreakerState = 'open';
          errorCount = 5;
          latencyMs = 1000;
        }

        return {
          camera_id: camera.id,
          online: camera.online,
          last_seen: camera.last_seen,
          estimated_fps: estimatedFps,
          health_score: healthScore,
          status,
          error_count: errorCount,
          latency_ms: latencyMs,
          circuit_breaker_state: circuitBreakerState
        };
      });

      setCameraHealth(healthData);
    } catch (err) {
      console.error('Error fetching camera health:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch camera health');
    } finally {
      setLoading(false);
    }
  };

  const getCameraStatus = (cameraId: string): CameraHealth | null => {
    return cameraHealth.find(health => health.camera_id === cameraId) || null;
  };

  const refreshHealth = () => {
    fetchCameraHealth();
  };

  useEffect(() => {
    fetchCameraHealth();

    // Set up real-time subscription for camera updates
    const subscription = supabase
      .channel('camera_health')
      .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'cameras' }, 
          () => {
            fetchCameraHealth();
          })
      .subscribe();

    // Refresh health data every 30 seconds
    const interval = setInterval(fetchCameraHealth, 30000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    cameraHealth,
    loading,
    error,
    refreshHealth,
    getCameraStatus
  };
};