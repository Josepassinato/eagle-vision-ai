import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Wifi, 
  WifiOff, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Loader2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface StreamStatus {
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error' | 'timeout';
  response_time_ms?: number;
  error_message?: string;
  last_tested: string;
}

interface StreamTestStats {
  total: number;
  active: number;
  inactive: number;
  error: number;
  timeout: number;
}

const StreamDiagnostics: React.FC = () => {
  const [streams, setStreams] = useState<StreamStatus[]>([]);
  const [stats, setStats] = useState<StreamTestStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/stream-tester?action=test-all`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStreams(data.results);
        setStats(data.stats);
        setLastUpdate(new Date());
        
        const activeCount = data.stats.active;
        const totalCount = data.stats.total;
        
        if (activeCount === 0) {
          toast.error(`⚠️ Nenhum stream público está funcionando (0/${totalCount})`);
        } else if (activeCount < totalCount) {
          toast.error(`⚠️ Apenas ${activeCount}/${totalCount} streams estão ativos`);
        } else {
          toast.success(`✅ Todos os ${totalCount} streams estão funcionando!`);
        }
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro no diagnóstico:', error);
      toast.error(`Erro ao testar streams: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testSingleStream = async (url: string) => {
    try {
      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/stream-tester?action=test-single&url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const status = data.result.status;
        const icon = status === 'active' ? '✅' : status === 'timeout' ? '⏱️' : '❌';
        toast.success(`${icon} Stream ${status}: ${url}`);
        
        // Atualizar o stream específico na lista
        setStreams(prev => prev.map(stream => 
          stream.url === url ? { ...stream, ...data.result } : stream
        ));
      }
    } catch (error) {
      toast.error(`Erro ao testar ${url}: ${error.message}`);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'inactive': return 'text-gray-500';
      case 'timeout': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <WifiOff className="h-4 w-4" />;
      case 'timeout': return <Clock className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Wifi className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      inactive: 'secondary',
      timeout: 'outline',
      error: 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[status] || 'secondary'} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Diagnóstico de Streams</h3>
          <p className="text-sm text-muted-foreground">
            Status dos streams públicos configurados no sistema
          </p>
        </div>
        <Button 
          onClick={runDiagnostics} 
          disabled={isLoading}
          size="sm"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Testar Novamente
            </>
          )}
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Ativos</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-500">{stats.inactive}</div>
              <div className="text-xs text-muted-foreground">Inativos</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.timeout}</div>
              <div className="text-xs text-muted-foreground">Timeout</div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.error}</div>
              <div className="text-xs text-muted-foreground">Erros</div>
            </div>
          </Card>
        </div>
      )}

      {stats && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Taxa de Sucesso</span>
            <span className="font-medium">
              {((stats.active / stats.total) * 100).toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={(stats.active / stats.total) * 100} 
            className="h-2"
          />
        </div>
      )}

      <div className="space-y-3">
        {streams.map((stream, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className={getStatusColor(stream.status)}>
                  {getStatusIcon(stream.status)}
                </div>
                <div>
                  <div className="font-medium">{stream.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {stream.response_time_ms && `${stream.response_time_ms}ms • `}
                    Testado: {new Date(stream.last_tested).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(stream.status)}
                <Button
                  onClick={() => testSingleStream(stream.url)}
                  size="sm"
                  variant="outline"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded">
              {stream.url}
            </div>
            
            {stream.error_message && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {stream.error_message}
                </AlertDescription>
              </Alert>
            )}
          </Card>
        ))}
      </div>

      {lastUpdate && (
        <div className="text-xs text-muted-foreground text-center">
          Última atualização: {lastUpdate.toLocaleString()}
        </div>
      )}

      {streams.length > 0 && stats && stats.active === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Problema detectado:</strong> Nenhum stream público está funcionando. 
            Isso pode indicar problemas de conectividade de rede ou que os serviços externos estão offline.
            O problema não está no seu sistema analítico, mas sim na conectividade com os streams externos.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default StreamDiagnostics;