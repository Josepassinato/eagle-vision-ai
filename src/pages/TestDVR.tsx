import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Wifi, Search } from "lucide-react";

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

const TestDVR = () => {
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [configs, setConfigs] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  
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
      name: "IPVM Demo Camera (Live)",
      host: "ipvmdemo.dyndns.org",
      port: 5541,
      username: "demo",
      password: "demo",
      protocol: "generic",
      description: "Câmera real com placa de teste e relógio ao vivo",
      url: "rtsp://demo:demo@ipvmdemo.dyndns.org:5541/onvif-media/media.amp?profile=profile_1_h264&sessiontimeout=60&streamtype=unicast"
    },
    {
      name: "Wowza Test Stream",
      host: "www.wowza.com",
      port: 1935,
      username: "",
      password: "",
      protocol: "generic", 
      description: "Stream de teste estático da Wowza",
      url: "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov"
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

  // Carregar configurações ao montar o componente
  useState(() => {
    loadConfigs();
  });

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Teste de Configuração DVR</h1>
          <p className="text-muted-foreground">Teste e configure DVRs/NVRs na sua rede</p>
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
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Streams públicos disponíveis para teste:
            </p>
            {demoStreams.map((demo, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{demo.name}</div>
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
            ))}
            
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

          {/* Configurações Salvas */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações Salvas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingConfigs ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </div>
              ) : configs.length > 0 ? (
                configs.map((config: any, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <div className="font-medium">{config.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {config.protocol} - {config.host}:{config.port}
                      </div>
                    </div>
                    <Badge variant={config.status === 'connected' ? 'default' : 'destructive'}>
                      {config.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma configuração salva
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TestDVR;