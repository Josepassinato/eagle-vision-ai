import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, X } from 'lucide-react';

export function PWAInstallBanner() {
  const { isInstallable, installApp } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isInstallable || isDismissed) return null;

  const handleInstall = async () => {
    const installed = await installApp();
    if (installed) {
      setIsDismissed(true);
    }
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-card border-border md:left-auto md:right-4 md:w-80">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-primary mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground">Instalar App</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Instale o Visão de Águia em seu dispositivo para acesso rápido e experiência melhorada.
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsDismissed(true)}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button onClick={handleInstall} size="sm" className="flex-1">
          Instalar
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setIsDismissed(true)}
        >
          Agora não
        </Button>
      </div>
    </Card>
  );
}