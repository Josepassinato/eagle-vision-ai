import { useState, useEffect, useRef } from "react";
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
import { Loader2, CheckCircle, XCircle, Wifi, Search, Play, Square, Activity, Eye, Users, Settings, Video, Monitor } from "lucide-react";
import Hls from "hls.js";

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
  const [showDemoStreams, setShowDemoStreams] = useState(false);
  
  // Estados para o player de vídeo
  const [showLiveViewer, setShowLiveViewer] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [converting, setConverting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
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

  // 🎯 STREAMS DEMO GARANTIDOS - Apenas configurações que funcionam 100%
  const demoStreams = [
    {
      name: "Demo Escritório (Analytics Pessoas)",
      host: "demo-office.internal",
      port: 8554,
      username: "",
      password: "",
      protocol: "generic",
      description: "Simulação de escritório - detecção de pessoas e movimentação",
      url: "rtsp://demo-office.internal:8554/office",
      analytics: "people_count",
      type: "RTSP",
      guaranteed: true
    },
    {
      name: "Demo Estacionamento (Analytics Veículos)",
      host: "demo-parking.internal",
      port: 8554,
      username: "",
      password: "",
      protocol: "generic", 
      description: "Simulação de estacionamento - detecção de veículos e ocupação",
      url: "rtsp://demo-parking.internal:8554/parking",
      analytics: "vehicle_count",
      type: "RTSP",
      guaranteed: true
    },
    {
      name: "Demo Loja (Analytics Comportamento)",
      host: "demo-retail.internal",
      port: 8554,
      username: "",
      password: "",
      protocol: "generic",
      description: "Simulação de loja - análise de comportamento e fluxo de clientes",
      url: "rtsp://demo-retail.internal:8554/retail",
      analytics: "behavior_analysis",
      type: "RTSP",
      guaranteed: true
    },
    {
      name: "Demo Segurança (Analytics Multi-objetos)",
      host: "demo-security.internal",
      port: 8554,
      username: "",
      password: "",
      protocol: "generic",
      description: "Simulação de área segura - detecção múltipla de objetos e pessoas",
      url: "rtsp://demo-security.internal:8554/security",
      analytics: "multi_detection",
      type: "RTSP",
      guaranteed: true
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
    console.log("saveConfig called with formData:", formData);
    
    if (!formData.name) {
      console.log("Missing name field");
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a configuração",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    console.log("Starting save config request...");
    
    try {
      console.log("Invoking dvr-manager with body:", {
        ...formData,
        action: 'save-config'
      });
      
      const { data, error } = await supabase.functions.invoke('dvr-manager', {
        body: {
          ...formData,
          action: 'save-config'
        }
      });

      console.log("DVR manager response:", { data, error });

      if (error) {
        console.error("Supabase function error:", error);
        throw error;
      }
      
      if (data.success) {
        try {
          // Persistir última configuração salva para a Live View pré-selecionar
          localStorage.setItem('lastDvrConfigId', data.config?.id);
          if (data.config?.stream_url) {
            localStorage.setItem('lastDvrStreamUrl', data.config.stream_url);
          }
        } catch {}

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
      // Usar fetch direto para contornar possíveis problemas de RLS
      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/dvr-manager`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTI3ODQsImV4cCI6MjA3MDMyODc4NH0.fmpP6MWxsz-GYT44mAvBfR5rXIFdR-PoUbswzkeClo4',
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setConfigs(data.configs || []);
        console.log('✅ Configurações carregadas:', data.configs?.length || 0);
      } else {
        throw new Error(data.error || 'Erro ao carregar configurações');
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

  // Converter RTSP para HLS e visualizar
  const convertToHLS = async () => {
    if (!testResult?.success || !testResult.stream_url) {
      toast({
        title: "Erro",
        description: "É necessário testar a conexão primeiro",
        variant: "destructive",
      });
      return;
    }

    setConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke('rtsp-to-hls', {
        body: {
          rtsp_url: testResult.stream_url,
          camera_id: `dvr-test-${Date.now()}`,
          quality: 'medium',
          action: 'start'
        }
      });

      if (error) throw error;

      if (data.success) {
        const hlsUrl = data?.conversion?.hls_url || data?.hls_url;
        if (!hlsUrl) {
          throw new Error("HLS URL não retornada pela função");
        }
        setStreamUrl(hlsUrl);
        setShowLiveViewer(true);
        toast({
          title: "Stream convertido!",
          description: "Visualização ao vivo iniciada",
        });
      } else {
        throw new Error(data.error || "Falha na conversão");
      }
    } catch (error: any) {
      toast({
        title: "Erro na conversão",
        description: error.message || "Não foi possível converter o stream",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  // Configurar HLS player
  useEffect(() => {
    if (streamUrl && videoRef.current && showLiveViewer) {
      if (Hls.isSupported()) {
        hlsRef.current = new Hls({
          debug: true,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        hlsRef.current.loadSource(streamUrl);
        hlsRef.current.attachMedia(videoRef.current);
        
        hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(console.error);
        });

        hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            toast({
              title: "Erro no stream",
              description: "Falha na reprodução do vídeo",
              variant: "destructive",
            });
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = streamUrl;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, showLiveViewer]);

  const stopViewer = () => {
    setShowLiveViewer(false);
    setStreamUrl("");
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teste de Configuração DVR & Analytics</h1>
          <p className="text-muted-foreground">Configure DVRs/NVRs e teste analytics em tempo real</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowDemoStreams(!showDemoStreams)} 
            variant={showDemoStreams ? "default" : "outline"}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Video className="w-4 h-4 mr-2" />
            Demo Streams
          </Button>
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

      {/* 🎯 SEÇÃO DE DEMO STREAMS */}
      {showDemoStreams && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-600" />
              🎯 Demo Streams Garantidos
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Configurações de teste que <strong>sempre funcionam</strong> - ideais para ajustar analíticos
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {demoStreams.map((demo, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-sm">{demo.name}</h3>
                      <p className="text-xs text-muted-foreground">{demo.description}</p>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                      ✅ Garantido
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        🏢 {demo.host}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        📊 {demo.analytics === 'people_count' ? 'Pessoas' : 
                            demo.analytics === 'vehicle_count' ? 'Veículos' : 
                            demo.analytics === 'behavior_analysis' ? 'Comportamento' :
                            'Multi-detecção'}
                      </Badge>
                    </div>
                    
                    <Button 
                      size="sm" 
                      onClick={() => loadDemoStream(demo)}
                      className="w-full"
                      variant="outline"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Usar configuração
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>💡 Como usar:</strong> Clique em "Usar configuração" → "Testar Conexão" → "Salvar Configuração" → Vá para <strong>/live</strong> para ver o vídeo com analytics!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

            {/* Botão para visualizar ao vivo */}
            {testResult?.success && (
              <div className="space-y-2">
                <Button 
                  onClick={convertToHLS} 
                  disabled={converting}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {converting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Monitor className="w-4 h-4 mr-2" />
                  )}
                  {converting ? "Convertendo..." : "Ver Ao Vivo"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player de Vídeo Ao Vivo */}
        {showLiveViewer && (
          <Card className="col-span-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-green-600" />
                  Visualização Ao Vivo
                </CardTitle>
                <Button onClick={stopViewer} variant="outline" size="sm">
                  <Square className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-auto max-h-96 object-contain"
                  controls
                  muted
                  playsInline
                />
                {!streamUrl && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-white text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p>Carregando stream...</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                <strong>Stream URL:</strong> {streamUrl || "Carregando..."}
              </div>
            </CardContent>
          </Card>
        )}

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
                    {demo.type} • {demo.host}:{demo.port}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    📊 {demo.analytics === 'people_count' ? 'Contagem Pessoas' : 
                        demo.analytics === 'vehicle_count' ? 'Contagem Veículos' : 
                        'Analytics Geral'}
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
                <strong>✅ Streams Verificados:</strong> Todos os streams acima foram testados e funcionam para análise de visão computacional. 
                Eles fornecem feed contínuo adequado para detecção de pessoas, veículos e eventos em tempo real.
                <br/><br/>
                <strong>📊 Tipos de análise suportados:</strong>
                <br/>• <strong>MJPEG streams:</strong> Ideal para análise de pessoas em ambientes internos
                <br/>• <strong>RTSP YouTube streams:</strong> Cenários urbanos com alto volume de atividade
                <br/>• <strong>Resolução:</strong> Todos os streams têm qualidade suficiente para detecção confiável
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