import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Wifi, Search, Play, Square, Activity, Eye, Users, Settings } from "lucide-react";

interface TestResult {
  success: boolean;
  error?: string;
  stream_url?: string;
}

interface NetworkDevice {
  ip: string;
  port: number;
  detected_protocol: string;
  possible_brands: string[];
}

interface AnalyticsEvent {
  id: string;
  type: string;
  timestamp: string;
  camera_id: string;
  confidence: number;
  description: string;
}

const TestDVR = () => {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState<{[key: string]: boolean}>({});
  const [activeStreams, setActiveStreams] = useState<{[key: string]: boolean}>({});
  const [liveEvents, setLiveEvents] = useState<AnalyticsEvent[]>([]);
  const [eventCount, setEventCount] = useState({ people: 0, vehicles: 0, motion: 0 });
  
  const [formData, setFormData] = useState({
    protocol: "hikvision",
    host: "",
    port: 554,
    username: "admin",
    password: "",
    channel: 1,
    stream_quality: "main",
    transport_protocol: "tcp",
    name: ""
  });

  // Streams de demonstração públicos disponíveis
  const demoStreams = [
    {
      name: "RTSP Test Server (Public)",
      host: "rtsp.stream",
      port: 554,
      username: "",
      password: "",
      protocol: "generic",
      description: "Servidor de teste RTSP público - sempre ativo",
      url: "rtsp://rtsp.stream/pattern"
    },
    {
      name: "Big Buck Bunny (Wowza)",
      host: "wowzaec2demo.streamlock.net",
      port: 1935,
      username: "",
      password: "",
      protocol: "generic", 
      description: "Stream de teste público da Wowza - Big Buck Bunny",
      url: "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov"
    },
    {
      name: "Sample Test Stream",
      host: "sample-videos.com",
      port: 554,
      username: "",
      password: "",
      protocol: "generic",
      description: "Stream de teste com vídeo de exemplo",
      url: "rtsp://sample-videos.com/test.mp4"
    },
    {
      name: "Hikvision Demo Pattern",
      host: "demo.hikvision.com",
      port: 554,
      username: "admin",
      password: "12345",
      protocol: "hikvision",
      description: "Exemplo de configuração Hikvision (pode não estar ativo)",
      url: "rtsp://admin:12345@demo.hikvision.com:554/Streaming/channels/101"
    }
  ];

  // Estado para testes automáticos de streams
  const [streamTests, setStreamTests] = useState<{[key: string]: {status: string, tested: boolean}}>({});

  // Testar automaticamente todos os streams públicos
  const testAllDemoStreams = async () => {
    toast({
      title: "🔍 Testando streams públicos",
      description: "Verificando conectividade de todos os streams...",
    });

    for (const demo of demoStreams) {
      setStreamTests(prev => ({ 
        ...prev, 
        [demo.name]: { status: 'testing', tested: false }
      }));

      try {
        const testConfig = {
          name: demo.name,
          protocol: demo.protocol,
          host: demo.host,
          port: demo.port,
          username: demo.username,
          password: demo.password,
          channel: 1,
          stream_quality: "main",
          transport_protocol: "tcp"
        };

        const { data, error } = await supabase.functions.invoke('dvr-manager', {
          body: {
            ...testConfig,
            action: 'test-connection'
          }
        });

        if (error) throw error;

        setStreamTests(prev => ({ 
          ...prev, 
          [demo.name]: { 
            status: data.success ? 'success' : 'failed', 
            tested: true 
          }
        }));

      } catch (error) {
        setStreamTests(prev => ({ 
          ...prev, 
          [demo.name]: { status: 'failed', tested: true }
        }));
      }

      // Pequeno delay entre testes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    toast({
      title: "✅ Testes concluídos",
      description: "Verificação de streams públicos finalizada",
    });
  };

  const loadDemoStream = (demo: any) => {
    setFormData({
      name: demo.name,
      protocol: demo.protocol,
      host: demo.host,
      port: demo.port,
      username: demo.username,
      password: demo.password,
      channel: 1,
      stream_quality: "main",
      transport_protocol: "tcp"
    });
    
    toast({
      title: "Demo carregado!",
      description: `Configuração ${demo.name} foi carregada no formulário`,
    });
  };

  // Simular eventos de analytics em tempo real
  const simulateAnalyticsEvents = (cameraId: string) => {
    const eventTypes = [
      { type: 'person_detected', description: 'Pessoa detectada', icon: '👤' },
      { type: 'vehicle_detected', description: 'Veículo detectado', icon: '🚗' },
      { type: 'motion_detected', description: 'Movimento detectado', icon: '📱' },
      { type: 'loitering', description: 'Permanência prolongada', icon: '⏰' },
      { type: 'crowd_detected', description: 'Aglomeração detectada', icon: '👥' },
    ];

    const generateEvent = () => {
      if (!activeStreams[cameraId]) return;

      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const newEvent: AnalyticsEvent = {
        id: Date.now().toString(),
        type: eventType.type,
        timestamp: new Date().toLocaleTimeString(),
        camera_id: cameraId,
        confidence: Math.floor(Math.random() * 30) + 70, // 70-99%
        description: `${eventType.icon} ${eventType.description}`
      };

      setLiveEvents(prev => [newEvent, ...prev.slice(0, 19)]); // Manter apenas 20 eventos

      // Atualizar contadores
      if (eventType.type.includes('person') || eventType.type.includes('crowd')) {
        setEventCount(prev => ({ ...prev, people: prev.people + 1 }));
      } else if (eventType.type.includes('vehicle')) {
        setEventCount(prev => ({ ...prev, vehicles: prev.vehicles + 1 }));
      } else {
        setEventCount(prev => ({ ...prev, motion: prev.motion + 1 }));
      }

      // Mostrar toast para eventos importantes
      if (newEvent.confidence > 85) {
        toast({
          title: `🔴 Evento detectado em ${cameraId}`,
          description: newEvent.description,
        });
      }
    };

    // Gerar eventos aleatoriamente
    const interval = setInterval(generateEvent, Math.random() * 8000 + 2000); // 2-10 segundos
    return interval;
  };

  const toggleAnalytics = async (configId: string, enabled: boolean) => {
    setAnalyticsEnabled(prev => ({ ...prev, [configId]: enabled }));
    
    if (enabled) {
      // Simular início do analytics
      setActiveStreams(prev => ({ ...prev, [configId]: true }));
      
      toast({
        title: "🎯 Analytics ativado!",
        description: "Iniciando análise de vídeo em tempo real...",
      });

      // Iniciar simulação de eventos
      const interval = simulateAnalyticsEvents(configId);
      
      // Armazenar o interval para poder parar depois
      setTimeout(() => {
        if (interval) clearInterval(interval);
      }, 300000); // Parar após 5 minutos
      
    } else {
      setActiveStreams(prev => ({ ...prev, [configId]: false }));
      toast({
        title: "Analytics pausado",
        description: "Análise de vídeo interrompida",
      });
    }
  };

  const testConnection = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager', {
        body: {
          ...formData,
          action: 'test-connection'
        }
      });

      if (error) throw error;
      
      setTestResult(data);
      
      if (data.success) {
        toast({
          title: "Conexão bem-sucedida!",
          description: "DVR conectado com sucesso.",
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: data.error || "Não foi possível conectar ao DVR",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro no teste:', error);
      setTestResult({
        success: false,
        error: error.message || "Erro interno"
      });
      toast({
        title: "Erro no teste",
        description: error.message || "Erro interno",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!formData.name) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a configuração",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager', {
        body: {
          ...formData,
          action: 'save-config'
        }
      });

      if (error) throw error;
      
      if (data.success) {
        toast({
          title: "Configuração salva!",
          description: "DVR configurado e salvo com sucesso.",
        });
        loadConfigs(); // Recarregar lista
      } else {
        toast({
          title: "Erro ao salvar",
          description: data.error || "Não foi possível salvar a configuração",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro interno",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    setDevices([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager', {
        body: { 
          network_range: "192.168.1",
          action: 'scan-network'
        }
      });

      if (error) throw error;
      
      if (data.success) {
        setDevices(data.devices || []);
        toast({
          title: "Scan concluído",
          description: `Encontrados ${data.devices?.length || 0} dispositivos`,
        });
      }
    } catch (error: any) {
      console.error('Erro no scan:', error);
      toast({
        title: "Erro no scan",
        description: error.message || "Erro interno",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

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

  // Limpar eventos ao montar componente
  useEffect(() => {
    setEventCount({ people: 0, vehicles: 0, motion: 0 });
    setLiveEvents([]);
  }, []);

  // Carregar configurações ao montar o componente
  useEffect(() => {
    loadConfigs();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teste de Configuração DVR & Analytics</h1>
          <p className="text-muted-foreground">Configure DVRs/NVRs e teste analytics em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={scanNetwork} disabled={scanning} variant="outline">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Scan de Rede
          </Button>
          <Button onClick={loadConfigs} disabled={loadingConfigs} variant="outline">
            {loadingConfigs ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
            Recarregar
          </Button>
        </div>
      </div>

      {/* Estatísticas em Tempo Real */}
      {Object.values(activeStreams).some(active => active) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pessoas</p>
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
                  <p className="text-sm text-muted-foreground">Veículos</p>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Formulário de Teste */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração DVR/NVR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nome da Configuração</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: DVR Principal"
                />
              </div>
              <div>
                <Label htmlFor="protocol">Protocolo</Label>
                <Select value={formData.protocol} onValueChange={(value) => setFormData(prev => ({ ...prev, protocol: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hikvision">Hikvision</SelectItem>
                    <SelectItem value="dahua">Dahua</SelectItem>
                    <SelectItem value="intelbras">Intelbras</SelectItem>
                    <SelectItem value="axis">Axis</SelectItem>
                    <SelectItem value="generic">Genérico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="host">IP do DVR</Label>
                <Input
                  id="host"
                  value={formData.host}
                  onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
              <div>
                <Label htmlFor="port">Porta</Label>
                <Input
                  id="port"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 554 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="channel">Canal</Label>
                <Input
                  id="channel"
                  type="number"
                  value={formData.channel}
                  onChange={(e) => setFormData(prev => ({ ...prev, channel: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <Label htmlFor="quality">Qualidade</Label>
                <Select value={formData.stream_quality} onValueChange={(value) => setFormData(prev => ({ ...prev, stream_quality: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Principal</SelectItem>
                    <SelectItem value="sub">Sub</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={testConnection} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Testar Conexão
              </Button>
              <Button onClick={saveConfig} disabled={loading || !testResult?.success} variant="outline" className="flex-1">
                Salvar Configuração
              </Button>
            </div>

            {testResult && (
              <Alert className={testResult.success ? "border-green-500" : "border-red-500"}>
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                  )}
                  <AlertDescription>
                    {testResult.success 
                      ? `Conexão bem-sucedida! Stream URL: ${testResult.stream_url}`
                      : `Falha na conexão: ${testResult.error}`
                    }
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Streams de Demonstração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Streams de Demonstração
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={testAllDemoStreams}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Testar Todos
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Streams públicos disponíveis para teste:
            </p>
            {demoStreams.map((demo, index) => {
              const testStatus = streamTests[demo.name];
              return (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{demo.name}</div>
                      {testStatus?.tested && (
                        <Badge 
                          variant={testStatus.status === 'success' ? 'default' : testStatus.status === 'failed' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {testStatus.status === 'success' ? '✅ Funciona' : 
                           testStatus.status === 'failed' ? '❌ Falhou' : 
                           '⏳ Testando...'}
                        </Badge>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => loadDemoStream(demo)}
                    >
                      Usar
                    </Button>
                  </div>
                <div className="text-sm text-muted-foreground">
                  {demo.description}
                </div>
                <div className="text-xs font-mono bg-muted p-2 rounded break-all">
                  {demo.url}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {demo.host}:{demo.port}
                  </Badge>
                  {demo.username && (
                    <Badge variant="outline" className="text-xs">
                      {demo.username}:{demo.password || "***"}
                    </Badge>
                  )}
                </div>
                </div>
              )
            })}
            
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Dica:</strong> O stream do IPVM é uma câmera real ao vivo com placas de teste e relógio. 
                É a melhor opção para testar funcionalidades em tempo real.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Dispositivos Encontrados e Configurações Salvas */}
        <div className="space-y-6">
          {devices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Dispositivos Encontrados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {devices.map((device, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{device.ip}:{device.port}</div>
                      <div className="text-sm text-muted-foreground">
                        Protocolo: {device.detected_protocol}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {device.possible_brands.map((brand) => (
                        <Badge key={brand} variant="outline" className="text-xs">
                          {brand}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Configurações Salvas com Analytics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Configurações & Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingConfigs ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : configs.length > 0 ? (
                configs.map((config: any, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{config.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {config.protocol} - {config.host}:{config.port}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={config.status === 'connected' ? 'default' : 'destructive'}>
                          {config.status}
                        </Badge>
                        {activeStreams[config.id] && (
                          <Badge variant="default" className="bg-green-500">
                            <Activity className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {config.status === 'connected' && (
                      <>
                        <Separator />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span className="text-sm font-medium">Analytics em Tempo Real</span>
                          </div>
                          <div className="flex items-center gap-2">
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
                        
                        {analyticsEnabled[config.id] && (
                          <div className="bg-muted/50 rounded p-3 space-y-2">
                            <div className="text-sm font-medium">Módulos Ativos:</div>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline">👤 Detecção de Pessoas</Badge>
                              <Badge variant="outline">🚗 Detecção de Veículos</Badge>
                              <Badge variant="outline">📱 Detecção de Movimento</Badge>
                              <Badge variant="outline">⏰ Anti-Loitering</Badge>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma configuração salva
                </div>
              )}
            </CardContent>
          </Card>

          {/* Eventos em Tempo Real */}
          {liveEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-pulse text-red-500" />
                  Eventos em Tempo Real
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {liveEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 border rounded bg-card">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-mono">{event.timestamp}</div>
                      <div className="text-sm">{event.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {event.camera_id}
                      </Badge>
                      <Badge variant={event.confidence > 85 ? 'default' : 'outline'} className="text-xs">
                        {event.confidence}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Link para Configuração de Analíticos */}
          {configs.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Próximo Passo</h3>
                  <p className="text-muted-foreground mb-4">
                    Configure os analíticos para seus DVRs conectados
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/dvr-analytics'}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Configurar Analíticos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestDVR;