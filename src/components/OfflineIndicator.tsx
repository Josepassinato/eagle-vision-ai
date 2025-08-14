import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { Card } from '@/components/ui/card';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOfflineStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <Card className={cn(
      "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2",
      "transition-all duration-300",
      isOnline ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
    )}>
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span className="text-sm font-medium">Conectado novamente</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span className="text-sm font-medium">Modo offline</span>
          </>
        )}
      </div>
    </Card>
  );
}