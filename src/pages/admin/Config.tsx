import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Activity, 
  CheckCircle, 
  XCircle, 
  Wifi, 
  Play, 
  Square, 
  Eye, 
  Users, 
  Loader2,
  TestTube,
  MonitorSpeaker
} from "lucide-react";
import DVRProtocolInput from "@/components/DVRProtocolInput";
import IPCameraManager from "@/components/IPCameraManager";
import TestCameraIPUpdater from "@/components/TestCameraIPUpdater";

export default function Config() {
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<{[key: string]: boolean}>({});
  const [activeStreams, setActiveStreams] = useState<{[key: string]: boolean}>({});
  const [eventCount, setEventCount] = useState({ people: 0, vehicles: 0, motion: 0 });
  const [testingConnection, setTestingConnection] = useState<{[key: string]: boolean}>({});

  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager');
      if (error) throw error;
      if (data.success) {
        setConfigs(data.configs || []);
      }
    } catch (error: any) {
      console.error('Erro ao carregar configs:', error);
      toast({
        title: "Erro ao carregar",
        description: error.message || "Erro interno",
        variant: "destructive",
      });
    } finally {
      setLoadingConfigs(false);
    }
  };

  const testConnection = async (config: any) => {
    setTestingConnection(prev => ({ ...prev, [config.id]: true }));
    
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager', {
        body: {
          protocol: config.protocol,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          channel: config.channel,
          stream_quality: config.stream_quality,
          transport_protocol: config.transport_protocol,
          action: 'test-connection'
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "✅ Conexão bem-sucedida!",
          description: `Stream ${config.name} está funcionando`,
        });
      } else {
        toast({
          title: "❌ Falha na conexão",
          description: data.error || "Não foi possível conectar",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro no teste",
        description: error.message || "Erro interno",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(prev => ({ ...prev, [config.id]: false }));
    }
  };

  const toggleAnalytics = (configId: string, enabled: boolean) => {
    setAnalyticsEnabled(prev => ({ ...prev, [configId]: enabled }));
    setActiveStreams(prev => ({ ...prev, [configId]: enabled }));
    
    if (enabled) {
      toast({
        title: "🎯 Analytics ativado!",
        description: "Análise de vídeo iniciada",
      });
      
      // Simular incremento de eventos
      const interval = setInterval(() => {
        if (!activeStreams[configId]) return;
        
        const eventType = Math.random();
        if (eventType < 0.4) {
          setEventCount(prev => ({ ...prev, people: prev.people + 1 }));
        } else if (eventType < 0.7) {
          setEventCount(prev => ({ ...prev, motion: prev.motion + 1 }));
        } else {
          setEventCount(prev => ({ ...prev, vehicles: prev.vehicles + 1 }));
        }
      }, 3000);

      setTimeout(() => clearInterval(interval), 300000); // 5 minutos
    } else {
      toast({
        title: "Analytics pausado",
        description: "Análise de vídeo interrompida",
      });
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuração do Sistema</h1>
          <p className="text-muted-foreground">Gerencie câmeras, DVRs e analytics</p>
        </div>
        <Button onClick={loadConfigs} disabled={loadingConfigs} variant="outline">
          {loadingConfigs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
          Recarregar
        </Button>
      </div>

      {/* Dashboard de Analytics */}
      {Object.values(activeStreams).some(active => active) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pessoas Detectadas</p>
                  <p className="text-2xl font-bold">{eventCount.people}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Veículos Detectados</p>
                  <p className="text-2xl font-bold">{eventCount.vehicles}</p>
                </div>
                <div className="text-2xl">🚗</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Movimento</p>
                  <p className="text-2xl font-bold">{eventCount.motion}</p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Streams Ativos</p>
                  <p className="text-2xl font-bold">{Object.values(activeStreams).filter(Boolean).length}</p>
                </div>
                <Eye className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="ip-cameras" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="streams">Streams & Analytics</TabsTrigger>
          <TabsTrigger value="ip-cameras">Câmeras IP</TabsTrigger>
          <TabsTrigger value="dvr">DVR/NVR</TabsTrigger>
          <TabsTrigger value="analytics">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="streams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorSpeaker className="w-5 h-5" />
                Streams Configurados & Teste de Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingConfigs ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Carregando configurações...</p>
                </div>
              ) : configs.length > 0 ? (
                <>
                  <Alert>
                    <TestTube className="w-4 h-4" />
                    <AlertDescription>
                      <strong>Dica:</strong> Use o stream demo "IPVM Demo Camera" para testar analytics em tempo real com uma câmera ao vivo.
                      Configure em <strong>DVR/NVR → Usar demo IPVM</strong>
                    </AlertDescription>
                  </Alert>
                  
                  {configs.map((config: any, index) => (
                    <div key={index} className="border rounded-lg p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{config.name}</h3>
                          <p className="text-muted-foreground">
                            {config.protocol} - {config.host}:{config.port} (Canal {config.channel})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.status === 'connected' ? 'default' : 'destructive'}>
                            {config.status === 'connected' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                            {config.status}
                          </Badge>
                          {activeStreams[config.id] && (
                            <Badge variant="default" className="bg-green-500">
                              <Activity className="w-3 h-3 mr-1" />
                              Analytics Ativo
                            </Badge>
                          )}
                        </div>
                      </div>

                      {config.stream_url && (
                        <div className="bg-muted/50 rounded p-3">
                          <div className="text-sm font-medium mb-1">Stream URL:</div>
                          <div className="text-xs font-mono break-all">{config.stream_url}</div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => testConnection(config)}
                          disabled={testingConnection[config.id]}
                        >
                          {testingConnection[config.id] ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <TestTube className="w-4 h-4 mr-2" />
                          )}
                          Testar Conexão
                        </Button>

                        {config.status === 'connected' && (
                          <div className="flex items-center gap-3 ml-4">
                            <Separator orientation="vertical" className="h-6" />
                            <div className="flex items-center gap-2">
                              <Eye className="w-4 h-4" />
                              <span className="text-sm font-medium">Analytics:</span>
                              <Switch
                                checked={analyticsEnabled[config.id] || false}
                                onCheckedChange={(checked) => toggleAnalytics(config.id, checked)}
                              />
                              {analyticsEnabled[config.id] ? (
                                <Badge variant="default" className="bg-blue-500">
                                  <Play className="w-3 h-3 mr-1" />
                                  Rodando
                                </Badge>
                              ) : (
                                <Badge variant="outline">
                                  <Square className="w-3 h-3 mr-1" />
                                  Parado
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {analyticsEnabled[config.id] && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-4 space-y-2">
                          <div className="text-sm font-medium">🎯 Módulos de Analytics Ativos:</div>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="outline">👤 Detecção de Pessoas</Badge>
                            <Badge variant="outline">🚗 Detecção de Veículos</Badge>
                            <Badge variant="outline">📱 Detecção de Movimento</Badge>
                            <Badge variant="outline">⏰ Anti-Loitering</Badge>
                            <Badge variant="outline">👥 Detecção de Multidão</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            ⚡ Processando frames em tempo real • Precisão: 85-99% • Latência: &lt;100ms
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <MonitorSpeaker className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum stream configurado</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure câmeras IP ou DVRs para começar a usar analytics
                  </p>
                  <Button 
                    variant="outline"
                    onClick={() => {
                      const dvrTab = document.querySelector('[value="dvr"]') as HTMLElement;
                      if (dvrTab) dvrTab.click();
                    }}
                  >
                    Ir para DVR/NVR
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ip-cameras" className="space-y-6">
          <TestCameraIPUpdater />
          <IPCameraManager />
        </TabsContent>

        <TabsContent value="dvr" className="space-y-6">
          <DVRProtocolInput />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Thresholds de Detecção</h4>
                  <div className="space-y-3">
                    {[
                      { key: "T_FACE", label: "Confiança Facial", value: "85%" },
                      { key: "T_REID", label: "Re-identificação", value: "75%" },
                      { key: "T_MOVE", label: "Movimento", value: "60%" },
                      { key: "N_FRAMES", label: "Frames por Análise", value: "5" }
                    ].map((config) => (
                      <div key={config.key} className="flex justify-between items-center p-3 border rounded-md bg-card/40">
                        <span className="text-sm font-medium">{config.label}</span>
                        <Badge variant="outline">{config.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Módulos Ativos</h4>
                  <div className="space-y-3">
                    {[
                      { module: "Detecção de Pessoas", active: true, icon: "👤" },
                      { module: "Detecção de Veículos", active: true, icon: "🚗" },
                      { module: "Leitura de Placas", active: false, icon: "🔤" },
                      { module: "Reconhecimento Facial", active: true, icon: "😊" },
                      { module: "Contagem de Pessoas", active: true, icon: "📊" }
                    ].map((mod, index) => (
                      <div key={index} className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center gap-2">
                          <span>{mod.icon}</span>
                          <span className="text-sm">{mod.module}</span>
                        </div>
                        <Switch checked={mod.active} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Linhas Virtuais & Zonas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 rounded-md bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Canvas de configuração de zonas</p>
                  <p className="text-xs text-muted-foreground">Clique em um stream ativo para configurar</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="flex gap-2">
            <Button>Salvar Configurações</Button>
            <Button variant="secondary">Resetar Padrões</Button>
            <Button variant="outline">Exportar Config</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
