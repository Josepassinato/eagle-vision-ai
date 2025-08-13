import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Monitor, Eye, Shield, TestTube } from 'lucide-react';

interface DVRConfig {
  protocol: string;
  host: string;
  port: string;
  username: string;
  password: string;
  channel: string;
  stream: string;
}

const DVRProtocolInput: React.FC = () => {
  const [config, setConfig] = useState<DVRConfig>({
    protocol: '',
    host: '',
    port: '554',
    username: 'admin',
    password: '',
    channel: '1',
    stream: 'main'
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [streamUrl, setStreamUrl] = useState('');

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

  const buildStreamUrl = () => {
    const protocol = protocols.find(p => p.value === config.protocol);
    if (!protocol || !config.host) return '';

    let url = protocol.format;
    url = url.replace('{username}', config.username);
    url = url.replace('{password}', config.password);
    url = url.replace('{host}', config.host);
    url = url.replace('{port}', config.port);
    url = url.replace('{channel}', config.channel);
    url = url.replace('{stream}', config.stream === 'sub' ? '1' : '0');

    return url;
  };

  const testConnection = async () => {
    setTestStatus('testing');
    
    // Simulate connection test
    setTimeout(() => {
      const url = buildStreamUrl();
      if (url && config.host && config.username && config.password) {
        setStreamUrl(url);
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    }, 2000);
  };

  const handleSubmit = () => {
    const url = buildStreamUrl();
    console.log('DVR Configuration:', { ...config, streamUrl: url });
    // Here you would save the configuration
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Configuração Básica</TabsTrigger>
          <TabsTrigger value="advanced">Configurações Avançadas</TabsTrigger>
          <TabsTrigger value="test">Teste & Validação</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
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
                  disabled={testStatus !== 'success'}
                >
                  Salvar Configuração
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DVRProtocolInput;