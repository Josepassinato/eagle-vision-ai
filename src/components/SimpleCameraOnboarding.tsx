import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Wifi, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DiscoveredCamera {
  ip: string;
  port: number;
  manufacturer?: string;
  model?: string;
}

export const SimpleCameraOnboarding = () => {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);
  
  // Manual mode state
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [brand, setBrand] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [testResult, setTestResult] = useState<any>(null);

  const cameraBrands = [
    { value: 'hikvision', label: 'Hikvision' },
    { value: 'dahua', label: 'Dahua' },
    { value: 'intelbras', label: 'Intelbras' },
    { value: 'axis', label: 'Axis' },
    { value: 'uniview', label: 'Uniview' },
    { value: 'generic', label: 'Genérica/Outra' }
  ];

  const handleAutoDiscover = async () => {
    setScanning(true);
    setDiscoveredCameras([]);
    
    try {
      const response = await fetch('/api/onvif/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network_range: '192.168.1.0/24' })
      });
      
      if (response.ok) {
        const data = await response.json();
        setDiscoveredCameras(data.cameras || []);
        toast.success(`${data.cameras?.length || 0} câmeras descobertas`);
      } else {
        toast.error('Nenhuma câmera encontrada na rede');
      }
    } catch (error) {
      toast.error('Erro ao escanear rede');
    } finally {
      setScanning(false);
    }
  };

  const handleTestConnection = async () => {
    if (!ip) {
      toast.error('Digite o endereço IP da câmera');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'test-connection',
          ip_address: ip,
          username,
          password,
          brand,
          port: 554,
          http_port: 80
        }
      });

      if (error) throw error;

      setTestResult(data);
      
      if (data.success) {
        toast.success('Conexão bem-sucedida!');
      } else {
        toast.error('Não foi possível conectar');
      }
    } catch (error) {
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveCamera = async () => {
    if (!name || !ip) {
      toast.error('Preencha nome e IP da câmera');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'save-config',
          name,
          ip_address: ip,
          brand,
          username,
          password,
          port: 554,
          http_port: 80
        }
      });

      if (error) throw error;

      toast.success('Câmera configurada com sucesso! 🎉');
      
      // Reset form
      setName('');
      setIp('');
      setBrand('');
      setPassword('');
      setTestResult(null);
    } catch (error) {
      toast.error('Erro ao salvar câmera');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Conectar Câmera</h1>
        <p className="text-muted-foreground">
          Adicione sua câmera em apenas 3 passos simples
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as 'auto' | 'manual')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="auto" className="gap-2">
            <Zap className="h-4 w-4" />
            Automático (Recomendado)
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <Camera className="h-4 w-4" />
            Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Descoberta Automática</CardTitle>
              <CardDescription>
                Escaneie sua rede local para encontrar câmeras ONVIF compatíveis automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Funciona com Hikvision, Dahua, Intelbras, Axis e outras marcas com suporte ONVIF
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleAutoDiscover} 
                disabled={scanning}
                className="w-full"
                size="lg"
              >
                {scanning ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Procurando câmeras...
                  </>
                ) : (
                  <>
                    <Wifi className="mr-2 h-5 w-5" />
                    Iniciar Busca Automática
                  </>
                )}
              </Button>

              {discoveredCameras.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold">Câmeras Encontradas:</h4>
                  {discoveredCameras.map((camera, index) => (
                    <Card key={index} className="p-4 hover:border-primary transition-colors cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-medium text-lg">{camera.ip}</div>
                          <div className="text-sm text-muted-foreground">
                            {camera.manufacturer} {camera.model}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Porta {camera.port}</Badge>
                          <Button size="sm">
                            Configurar
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {!scanning && discoveredCameras.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma câmera encontrada. Certifique-se de que sua câmera está conectada à mesma rede.
                    Você pode tentar o modo manual.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração Manual</CardTitle>
              <CardDescription>
                Insira os dados da sua câmera manualmente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Câmera *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Câmera Entrada Principal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ip">Endereço IP *</Label>
                    <Input
                      id="ip"
                      placeholder="192.168.1.100"
                      value={ip}
                      onChange={(e) => setIp(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Select value={brand} onValueChange={setBrand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {cameraBrands.map((b) => (
                          <SelectItem key={b.value} value={b.value}>
                            {b.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {testResult.success 
                      ? '✅ Conexão bem-sucedida! Câmera acessível.'
                      : `❌ Falha: ${testResult.error || 'Não foi possível conectar'}`
                    }
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button 
                  onClick={handleTestConnection}
                  disabled={testing || !ip}
                  variant="outline"
                  className="flex-1"
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="mr-2 h-4 w-4" />
                  )}
                  Testar
                </Button>

                <Button 
                  onClick={handleSaveCamera}
                  disabled={saving || !name || !ip || (testResult && !testResult.success)}
                  className="flex-1"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  Salvar Câmera
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Dica:</strong> Certifique-se de que a câmera está na mesma rede e que as credenciais estão corretas.
              A porta RTSP padrão é 554.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
};
