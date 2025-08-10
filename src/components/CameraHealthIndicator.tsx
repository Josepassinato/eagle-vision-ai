import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { useCameraHealth } from '@/hooks/useCameraHealth';

interface CameraHealthIndicatorProps {
  cameraId: string;
  showDetails?: boolean;
  className?: string;
}

export const CameraHealthIndicator: React.FC<CameraHealthIndicatorProps> = ({
  cameraId,
  showDetails = false,
  className = ""
}) => {
  const { getCameraStatus } = useCameraHealth();
  const health = getCameraStatus(cameraId);

  if (!health) {
    return (
      <Badge variant="secondary" className={className}>
        <WifiOff className="w-3 h-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  const getStatusBadge = () => {
    switch (health.status) {
      case 'healthy':
        return (
          <Badge variant="default" className={`bg-green-500 hover:bg-green-600 ${className}`}>
            <Wifi className="w-3 h-3 mr-1" />
            {showDetails ? `Online (${health.estimated_fps}fps)` : 'Online'}
          </Badge>
        );
      case 'degraded':
        return (
          <Badge variant="secondary" className={`bg-yellow-500 hover:bg-yellow-600 ${className}`}>
            <Activity className="w-3 h-3 mr-1" />
            {showDetails ? `Degraded (${health.estimated_fps}fps)` : 'Degraded'}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className={className}>
            <AlertTriangle className="w-3 h-3 mr-1" />
            {showDetails ? `Errors (${health.error_count})` : 'Error'}
          </Badge>
        );
      case 'offline':
      default:
        return (
          <Badge variant="outline" className={`border-gray-400 text-gray-600 ${className}`}>
            <WifiOff className="w-3 h-3 mr-1" />
            Offline
          </Badge>
        );
    }
  };

  const getTooltipContent = () => {
    const lastSeenDate = health.last_seen ? new Date(health.last_seen) : null;
    const lastSeenStr = lastSeenDate ? 
      `${lastSeenDate.toLocaleDateString()} ${lastSeenDate.toLocaleTimeString()}` : 
      'Never';

    return (
      <div className="space-y-1 text-sm">
        <div className="font-medium">Camera: {cameraId}</div>
        <div>Status: {health.status}</div>
        <div>Health Score: {health.health_score}%</div>
        <div>Estimated FPS: {health.estimated_fps}</div>
        <div>Last Seen: {lastSeenStr}</div>
        <div>Latency: {health.latency_ms}ms</div>
        <div>Circuit Breaker: {health.circuit_breaker_state}</div>
        {health.error_count > 0 && (
          <div className="text-red-400">Errors: {health.error_count}</div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {getStatusBadge()}
        </TooltipTrigger>
        <TooltipContent>
          {getTooltipContent()}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};