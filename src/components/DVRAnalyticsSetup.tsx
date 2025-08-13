import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Play, 
  Square, 
  Settings, 
  Eye, 
  Shield, 
  GraduationCap,
  Activity,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface DVRConfig {
  id: string;
  name: string;
  stream_url: string;
  status: string;
  protocol: string;
  host: string;
  port: number;
}

interface AnalyticsService {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
  status: 'running' | 'stopped' | 'error';
}

const DVRAnalyticsSetup: React.FC = () => {
  const [configs, setConfigs] = useState<DVRConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<DVRConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsService[]>([
    {
      id: 'safetyvision',
      name: 'SafetyVision',
      description: 'Detecção de EPI e situações de risco',
      icon: <Shield className="h-4 w-4" />,
      enabled: false,
      status: 'stopped'
    },
    {
      id: 'edubehavior',
      name: 'EduBehavior',
      description: 'Análise comportamental educacional',
      icon: <GraduationCap className="h-4 w-4" />,
      enabled: false,
      status: 'stopped'
    },
    {
      id: 'antitheft',
      name: 'AntiTheft',
      description: 'Detecção de furtos e objetos perdidos',
      icon: <Eye className="h-4 w-4" />,
      enabled: false,
      status: 'stopped'
    }
  ]);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      console.log('Carregando configurações DVR...');
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        throw new Error('Usuário não autenticado');
      }

      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/dvr-manager`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTI3ODQsImV4cCI6MjA3MDMyODc4NH0.fmpP6MWxsz-GYT44mAvBfR5rXIFdR-PoUbswzkeClo4',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Resultado da requisição:', result);
      
      if (result.success) {
        const connectedConfigs = result.configs.filter((config: any) => config.status === 'connected');
        console.log('Configurações conectadas:', connectedConfigs);
        setConfigs(connectedConfigs);
        if (connectedConfigs.length > 0) {
          setSelectedConfig(connectedConfigs[0]);
        }
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error: any) {
      console.error('Erro ao carregar configurações:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações do DVR",
        variant: "destructive",
      });
    }
  };

  const toggleAnalytics = async (serviceId: string, enabled: boolean) => {
    if (!selectedConfig) {
      toast({
        title: "Erro",
        description: "Selecione um DVR primeiro",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Simular ativação/desativação do serviço
      const response = await supabase.functions.invoke('stream-start', {
        body: {
          camera_id: selectedConfig.id,
          stream_url: selectedConfig.stream_url,
          analytics_enabled: enabled ? [serviceId] : []
        }
      });

      if (response.error) throw response.error;

      // Atualizar estado local
      setAnalytics(prev => prev.map(service => 
        service.id === serviceId 
          ? { 
              ...service, 
              enabled, 
              status: enabled ? 'running' : 'stopped' 
            }
          : service
      ));

      toast({
        title: enabled ? "Analítico Ativado" : "Analítico Desativado",
        description: `${serviceId} ${enabled ? 'iniciado' : 'parado'} com sucesso`,
      });

    } catch (error: any) {
      console.error('Erro ao alterar analítico:', error);
      toast({
        title: "Erro",
        description: `Erro ao ${enabled ? 'ativar' : 'desativar'} o analítico`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startStreamWithAnalytics = async () => {
    if (!selectedConfig) return;

    const enabledServices = analytics.filter(a => a.enabled).map(a => a.id);
    
    if (enabledServices.length === 0) {
      toast({
        title: "Atenção",
        description: "Selecione pelo menos um analítico para iniciar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('stream-start', {
        body: {
          camera_id: selectedConfig.id,
          stream_url: selectedConfig.stream_url,
          analytics_enabled: enabledServices
        }
      });

      if (error) throw error;

      toast({
        title: "Stream Iniciado",
        description: `Stream com ${enabledServices.length} analíticos em execução`,
      });

    } catch (error: any) {
      console.error('Erro ao iniciar stream:', error);
      toast({
        title: "Erro",
        description: "Erro ao iniciar o stream com analíticos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Seleção de DVR */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Configurações DVR Conectadas
          </CardTitle>
          <CardDescription>
            Selecione um DVR para configurar os analíticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum DVR conectado encontrado. Conecte um DVR primeiro na página de testes.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-3">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedConfig?.id === config.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedConfig(config)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{config.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {config.protocol.toUpperCase()} - {config.host}:{config.port}
                      </p>
                    </div>
                    <Badge variant="default">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Conectado
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração de Analíticos */}
      {selectedConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Analíticos
            </CardTitle>
            <CardDescription>
              Ative/desative os serviços de análise para o DVR selecionado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.map((service) => (
              <div 
                key={service.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {service.icon}
                    <div>
                      <h4 className="font-medium">{service.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Badge 
                    variant={
                      service.status === 'running' ? 'default' : 
                      service.status === 'error' ? 'destructive' : 'secondary'
                    }
                  >
                    {service.status === 'running' ? 'Ativo' : 
                     service.status === 'error' ? 'Erro' : 'Parado'}
                  </Badge>
                  
                  <Switch
                    checked={service.enabled}
                    onCheckedChange={(checked) => 
                      toggleAnalytics(service.id, checked)
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-4">
              <Button 
                onClick={startStreamWithAnalytics}
                disabled={loading || !analytics.some(a => a.enabled)}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Iniciar Stream com Analíticos
              </Button>
              
              <Button 
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Square className="h-4 w-4" />
                Parar Todos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status do Stream */}
      {selectedConfig && analytics.some(a => a.enabled) && (
        <Card>
          <CardHeader>
            <CardTitle>Status do Stream</CardTitle>
            <CardDescription>
              Informações em tempo real do stream e analíticos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">URL do Stream:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {selectedConfig.stream_url.replace(/:[^:]*@/, ':***@')}
                </code>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Analíticos Ativos:</span>
                <span className="text-sm font-medium">
                  {analytics.filter(a => a.enabled).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Status Geral:</span>
                <Badge variant="default">Processando</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedConfig && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-blue-900">📺 Visualizar Análise em Tempo Real</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Assista ao vídeo sendo processado com overlays das detecções da IA em tempo real
            </p>
            <Button 
              onClick={() => window.open('/live', '_blank')} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              🔴 Abrir Visualização ao Vivo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DVRAnalyticsSetup;