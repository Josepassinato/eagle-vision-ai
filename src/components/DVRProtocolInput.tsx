import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Eye, Shield, TestTube, Search, Wifi } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface DVRConfig {
  protocol: string;
  host: string;
  port: string;
  username: string;
  password: string;
  channel: string;
  stream: string;
  name: string;
}

interface ScannedDevice {
  ip: string;
  port: number;
  detected_protocol: string;
  possible_brands: string[];
}

const DVRProtocolInput: React.FC = () => {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<DVRConfig>({
    protocol: '',
    host: '',
    port: '554',
    username: 'admin',
    password: '',
    channel: '1',
    stream: 'main',
    name: ''
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [streamUrl, setStreamUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);

  const protocols = [
    { value: 'hikvision', label: 'Hikvision', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/Streaming/Channels/{channel}01' },
    { value: 'dahua', label: 'Dahua', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype={stream}' },
    { value: 'axis', label: 'Axis', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/axis-media/media.amp' },
    { value: 'bosch', label: 'Bosch', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/rtsp_tunnel' },
    { value: 'samsung', label: 'Samsung', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/onvif-media/media.amp' },
    { value: 'panasonic', label: 'Panasonic', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/MediaInput/stream_{channel}' },
    { value: 'avigilon', label: 'Avigilon', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/defaultPrimary?streamType=u' },
    { value: 'genetec', label: 'Genetec', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/stream' },
    { value: 'intelbras', label: 'Intelbras', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype=0' },
    { value: 'vivotek', label: 'Vivotek', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/live.sdp' },
    { value: 'foscam', label: 'Foscam', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/videoMain' },
    { value: 'generic', label: 'Genérico RTSP', port: '554', format: 'rtsp://{username}:{password}@{host}:{port}/stream' }
  ];

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager');
      if (!error && data.success) {
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
    }
  };

  const handleProtocolChange = (value: string) => {
    const protocol = protocols.find(p => p.value === value);
    if (protocol) {
      setConfig(prev => ({
        ...prev,
        protocol: value,
        port: protocol.port
      }));
    }
  };

  const testConnection = async () => {
    if (!config.protocol || !config.host || !config.username || !config.password) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setTestStatus('testing');
    
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager/test-connection', {
        body: {
          protocol: config.protocol,
          host: config.host,
          port: parseInt(config.port),
          username: config.username,
          password: config.password,
          channel: parseInt(config.channel),
          stream_quality: config.stream,
          transport_protocol: 'tcp'
        }
      });

      if (error) throw error;

      if (data.success) {
        setStreamUrl(data.stream_url);
        setTestStatus('success');
        toast({
          title: "Sucesso",
          description: "Conexão estabelecida com sucesso!"
        });
      } else {
        setTestStatus('error');
        toast({
          title: "Erro na conexão",
          description: data.error || "Falha ao conectar com o DVR",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Test error:', error);
      setTestStatus('error');
      toast({
        title: "Erro",
        description: "Erro ao testar conexão",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    if (!config.name || testStatus !== 'success') {
      toast({
        title: "Erro",
        description: "Teste a conexão antes de salvar e defina um nome",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager/save-config', {
        body: {
          name: config.name,
          protocol: config.protocol,
          host: config.host,
          port: parseInt(config.port),
          username: config.username,
          password: config.password,
          channel: parseInt(config.channel),
          stream_quality: config.stream,
          transport_protocol: 'tcp'
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Configuração salva com sucesso!"
        });
        loadConfigs();
        // Reset form
        setConfig({
          protocol: '',
          host: '',
          port: '554',
          username: 'admin',
          password: '',
          channel: '1',
          stream: 'main',
          name: ''
        });
        setTestStatus('idle');
        setStreamUrl('');
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao salvar configuração",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive"
      });
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('dvr-manager/scan-network', {
        body: { network_range: '192.168.1' }
      });

      if (error) throw error;

      if (data.success) {
        setScannedDevices(data.devices || []);
        toast({
          title: "Scan completo",
          description: `${data.devices?.length || 0} dispositivos encontrados`
        });
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast({
        title: "Erro",
        description: "Erro ao escanear rede",
        variant: "destructive"
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Configuração de DVR/NVR
          </CardTitle>
          <CardDescription>
            Configure a conexão com seu sistema de DVR/NVR suportando múltiplos protocolos
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Configuração Básica</TabsTrigger>
          <TabsTrigger value="advanced">Configurações Avançadas</TabsTrigger>
          <TabsTrigger value="scan">Scanner de Rede</TabsTrigger>
          <TabsTrigger value="test">Teste & Validação</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Configuração</Label>
                <Input
                  id="name"
                  placeholder="DVR Loja Principal"
                  value={config.name}
                  onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="protocol">Protocolo DVR/NVR</Label>
                  <Select value={config.protocol} onValueChange={handleProtocolChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      {protocols.map((protocol) => (
                        <SelectItem key={protocol.value} value={protocol.value}>
                          {protocol.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="host">Endereço IP/Host</Label>
                  <Input
                    id="host"
                    placeholder="192.168.1.100"
                    value={config.host}
                    onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port">Porta</Label>
                  <Input
                    id="port"
                    placeholder="554"
                    value={config.port}
                    onChange={(e) => setConfig(prev => ({ ...prev, port: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    placeholder="admin"
                    value={config.username}
                    onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={config.password}
                    onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel">Canal</Label>
                  <Select value={config.channel} onValueChange={(value) => setConfig(prev => ({ ...prev, channel: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 32 }, (_, i) => i + 1).map((channel) => (
                        <SelectItem key={channel} value={channel.toString()}>
                          Canal {channel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                Scanner de Rede
              </CardTitle>
              <CardDescription>
                Buscar automaticamente por dispositivos DVR/NVR na rede
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button 
                  onClick={scanNetwork}
                  disabled={scanning}
                  variant="outline"
                >
                  {scanning ? (
                    <>
                      <Wifi className="w-4 h-4 mr-2 animate-spin" />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Escanear Rede 192.168.1.x
                    </>
                  )}
                </Button>
                
                {scannedDevices.length > 0 && (
                  <Badge variant="secondary">
                    {scannedDevices.length} dispositivos encontrados
                  </Badge>
                )}
              </div>

              {scannedDevices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Dispositivos Encontrados:</h4>
                  <div className="grid gap-2">
                    {scannedDevices.map((device, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{device.ip}:{device.port}</div>
                          <div className="text-sm text-muted-foreground">
                            Protocolo: {device.detected_protocol.toUpperCase()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfig(prev => ({
                              ...prev,
                              host: device.ip,
                              port: device.port.toString(),
                              protocol: device.possible_brands[0] || 'generic'
                            }));
                          }}
                        >
                          Usar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Alert>
                <Wifi className="h-4 w-4" />
                <AlertDescription>
                  <strong>Scanner de Rede:</strong> Busca por dispositivos nas portas 554 (RTSP), 80 e 8080 (HTTP).
                  Funciona apenas para dispositivos na mesma rede local.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações Avançadas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="stream">Qualidade do Stream</Label>
                  <Select value={config.stream} onValueChange={(value) => setConfig(prev => ({ ...prev, stream: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="main">Principal (Alta qualidade)</SelectItem>
                      <SelectItem value="sub">Secundário (Baixa qualidade)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Protocolo de Transporte</Label>
                  <Select defaultValue="tcp">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tcp">TCP (Recomendado)</SelectItem>
                      <SelectItem value="udp">UDP (Menor latência)</SelectItem>
                      <SelectItem value="http">HTTP (Firewall friendly)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {config.protocol && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Formato de URL para {protocols.find(p => p.value === config.protocol)?.label}:</strong>
                    <br />
                    <code className="text-sm bg-muted px-1 rounded">
                      {protocols.find(p => p.value === config.protocol)?.format}
                    </code>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5" />
                Teste de Conexão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="font-medium">Status da Conexão</div>
                  <div className="text-sm text-muted-foreground">
                    {testStatus === 'idle' && 'Clique em testar para verificar a conexão'}
                    {testStatus === 'testing' && 'Testando conexão...'}
                    {testStatus === 'success' && 'Conexão estabelecida com sucesso!'}
                    {testStatus === 'error' && 'Erro na conexão. Verifique as configurações.'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {testStatus === 'success' && <Badge variant="outline" className="text-green-600">✓ Conectado</Badge>}
                  {testStatus === 'error' && <Badge variant="outline" className="text-red-600">✗ Erro</Badge>}
                  {testStatus === 'testing' && <Badge variant="outline">⏳ Testando</Badge>}
                </div>
              </div>

              {streamUrl && testStatus === 'success' && (
                <Alert>
                  <Eye className="h-4 w-4" />
                  <AlertDescription>
                    <strong>URL do Stream Gerada:</strong>
                    <br />
                    <code className="text-sm bg-muted px-1 rounded break-all">
                      {streamUrl}
                    </code>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={testConnection}
                  disabled={!config.protocol || !config.host || testStatus === 'testing'}
                  variant="outline"
                >
                  {testStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={testStatus !== 'success' || !config.name}
                >
                  Salvar Configuração
                </Button>
              </div>

              {configs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Configurações Salvas:</h4>
                  <div className="grid gap-2">
                    {configs.map((savedConfig) => (
                      <div key={savedConfig.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{savedConfig.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {savedConfig.protocol} • {savedConfig.host}:{savedConfig.port}
                          </div>
                        </div>
                        <Badge variant={savedConfig.status === 'connected' ? 'default' : 'destructive'}>
                          {savedConfig.status === 'connected' ? 'Conectado' : 'Erro'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DVRProtocolInput;