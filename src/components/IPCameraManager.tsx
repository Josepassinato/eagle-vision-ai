import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Wifi, WifiOff, Camera, Network, TestTube, Save } from "lucide-react";
import { toast } from "sonner";

interface IPCamera {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  ip_address: string;
  port: number;
  username?: string;
  password?: string;
  rtsp_path?: string;
  http_port: number;
  onvif_port: number;
  network_mask?: string;
  gateway?: string;
  dns_server?: string;
  status: string;
  last_tested_at?: string;
  stream_urls?: any;
  error_message?: string;
  is_permanent?: boolean;
  created_at: string;
}

interface IPCameraConfig {
  name: string;
  brand: string;
  model: string;
  ip_address: string;
  port: number;
  username: string;
  password: string;
  rtsp_path: string;
  http_port: number;
  onvif_port: number;
}

interface ScannedDevice {
  ip_address: string;
  brand: string;
  model: string;
  ports_open: number[];
  http_accessible: boolean;
  estimated_type: string;
}

export default function IPCameraManager() {
  const [config, setConfig] = useState<IPCameraConfig>({
    name: "",
    brand: "",
    model: "",
    ip_address: "",
    port: 554,
    username: "admin",
    password: "",
    rtsp_path: "",
    http_port: 80,
    onvif_port: 80
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [networkRange, setNetworkRange] = useState("192.168.1.0/24");
  const [cameras, setCameras] = useState<IPCamera[]>([]);
  const [loading, setLoading] = useState(false);

  const brands = [
    { value: "hikvision", label: "Hikvision", rtsp_path: "/ISAPI/Streaming/Channels/101" },
    { value: "dahua", label: "Dahua", rtsp_path: "/cam/realmonitor?channel=1&subtype=0" },
    { value: "axis", label: "Axis", rtsp_path: "/axis-media/media.amp" },
    { value: "uniview", label: "Uniview", rtsp_path: "/live/ch1" },
    { value: "bosch", label: "Bosch", rtsp_path: "/rtsp_tunnel" },
    { value: "sony", label: "Sony", rtsp_path: "/video1" },
    { value: "panasonic", label: "Panasonic", rtsp_path: "/video.pro1" },
    { value: "vivotek", label: "Vivotek", rtsp_path: "/live1.sdp" },
    { value: "foscam", label: "Foscam", rtsp_path: "/videoMain" },
    { value: "tp-link", label: "TP-Link", rtsp_path: "/stream1" },
    { value: "generic", label: "Generic/Other", rtsp_path: "" }
  ];

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      if (error) throw error;
      
      if (data.success) {
        setCameras(data.data || []);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast.error('Erro ao carregar câmeras');
    }
  };

  const handleBrandChange = (brand: string) => {
    const brandInfo = brands.find(b => b.value === brand);
    setConfig(prev => ({
      ...prev,
      brand,
      rtsp_path: brandInfo?.rtsp_path || ""
    }));
  };

  const testConnection = async () => {
    if (!config.ip_address) {
      toast.error('IP da câmera é obrigatório');
      return;
    }

    setTestStatus('testing');
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'test-connection',
          ...config
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });

      if (error) throw error;

      setTestResult(data);
      setTestStatus(data.success ? 'success' : 'error');

      if (data.success) {
        toast.success('Conexão bem-sucedida!');
      } else {
        toast.error(`Falha na conexão: ${data.error}`);
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setTestStatus('error');
      toast.error('Erro ao testar conexão');
    }
  };

  const saveCamera = async () => {
    if (!config.name || !config.ip_address) {
      toast.error('Nome e IP são obrigatórios');
      return;
    }

    if (testStatus !== 'success') {
      toast.error('Teste a conexão antes de salvar');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'save-config',
          ...config
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        setConfig({
          name: "",
          brand: "",
          model: "",
          ip_address: "",
          port: 554,
          username: "admin",
          password: "",
          rtsp_path: "",
          http_port: 80,
          onvif_port: 80
        });
        setTestStatus('idle');
        setTestResult(null);
        loadCameras();
      }
    } catch (error) {
      console.error('Save camera error:', error);
      toast.error('Erro ao salvar câmera');
    } finally {
      setLoading(false);
    }
  };

  const scanNetwork = async () => {
    setScanning(true);
    setScannedDevices([]);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: { 
          action: 'scan-network',
          network_range: networkRange,
          ports: [80, 554, 8080]
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });

      if (error) throw error;

      if (data.success) {
        setScannedDevices(data.data || []);
        toast.success(data.message);
      }
    } catch (error) {
      console.error('Network scan error:', error);
      toast.error('Erro ao escanear rede');
    } finally {
      setScanning(false);
    }
  };

  const useScannedDevice = (device: ScannedDevice) => {
    setConfig(prev => ({
      ...prev,
      ip_address: device.ip_address,
      brand: device.brand.toLowerCase(),
      model: device.model,
      name: `${device.brand} ${device.model}`
    }));
    
    // Auto-set RTSP path based on brand
    const brandInfo = brands.find(b => b.label.toLowerCase() === device.brand.toLowerCase());
    if (brandInfo) {
      setConfig(prev => ({ ...prev, rtsp_path: brandInfo.rtsp_path }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Camera className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Gerenciador de Câmeras IP</h2>
      </div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="scan" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Descoberta
          </TabsTrigger>
          <TabsTrigger value="test" className="flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Teste
          </TabsTrigger>
          <TabsTrigger value="cameras" className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Câmeras Salvas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuração da Câmera IP</CardTitle>
              <CardDescription>
                Configure os parâmetros de conexão da sua câmera IP
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome da Câmera</Label>
                  <Input
                    id="name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: Entrada Principal"
                  />
                </div>
                <div>
                  <Label htmlFor="ip">Endereço IP</Label>
                  <Input
                    id="ip"
                    value={config.ip_address}
                    onChange={(e) => setConfig(prev => ({ ...prev, ip_address: e.target.value }))}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div>
                  <Label htmlFor="brand">Marca</Label>
                  <Select value={config.brand} onValueChange={handleBrandChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a marca" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(brand => (
                        <SelectItem key={brand.value} value={brand.value}>
                          {brand.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={config.model}
                    onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="Ex: DS-2CD2xxx"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    value={config.username}
                    onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="admin"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Senha da câmera"
                  />
                </div>
                <div>
                  <Label htmlFor="rtsp_path">Caminho RTSP</Label>
                  <Input
                    id="rtsp_path"
                    value={config.rtsp_path}
                    onChange={(e) => setConfig(prev => ({ ...prev, rtsp_path: e.target.value }))}
                    placeholder="/stream1"
                  />
                </div>
                <div>
                  <Label htmlFor="port">Porta RTSP</Label>
                  <Input
                    id="port"
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 554 }))}
                    placeholder="554"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Descoberta de Câmeras na Rede</CardTitle>
              <CardDescription>
                Escaneie sua rede local para encontrar câmeras IP automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={networkRange}
                  onChange={(e) => setNetworkRange(e.target.value)}
                  placeholder="192.168.1.0/24"
                  className="flex-1"
                />
                <Button 
                  onClick={scanNetwork} 
                  disabled={scanning}
                  className="flex items-center gap-2"
                >
                  {scanning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                  {scanning ? 'Escaneando...' : 'Escanear Rede'}
                </Button>
              </div>

              {scannedDevices.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Dispositivos Encontrados:</h4>
                  {scannedDevices.map((device, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{device.ip_address}</span>
                            {device.http_accessible ? (
                              <Wifi className="h-4 w-4 text-green-500" />
                            ) : (
                              <WifiOff className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {device.brand} {device.model} • Portas: {device.ports_open.join(', ')}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => useScannedDevice(device)}
                          variant="outline"
                        >
                          Usar
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Teste de Conexão</CardTitle>
              <CardDescription>
                Teste a conectividade com a câmera antes de salvar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={testConnection} 
                disabled={testStatus === 'testing' || !config.ip_address}
                className="w-full"
              >
                {testStatus === 'testing' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {testStatus === 'testing' ? 'Testando Conexão...' : 'Testar Conexão'}
              </Button>

              {testResult && (
                <Alert className={testStatus === 'success' ? 'border-green-500' : 'border-red-500'}>
                  <AlertDescription>
                    {testStatus === 'success' ? (
                      <div className="space-y-2">
                        <p className="text-green-600 font-medium">✓ Conexão bem-sucedida!</p>
                        <p><strong>URL do Stream:</strong> {testResult.stream_url}</p>
                        <p><strong>HTTP Acessível:</strong> {testResult.http_accessible ? 'Sim' : 'Não'}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-red-600 font-medium">✗ Falha na conexão</p>
                        <p><strong>Erro:</strong> {testResult.error}</p>
                        <p><strong>URLs testadas:</strong> {testResult.tested_urls?.length || 0}</p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {testStatus === 'success' && (
                <Button 
                  onClick={saveCamera} 
                  disabled={loading}
                  className="w-full"
                  variant="default"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar Câmera
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cameras" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Câmeras Configuradas</CardTitle>
              <CardDescription>
                Lista de câmeras IP salvas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cameras.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma câmera configurada ainda
                </div>
               ) : (
                 <div className="space-y-4">
                   {cameras.map((camera) => (
                     <Card key={camera.id} className="p-4">
                       <div className="flex items-center justify-between">
                         <div className="space-y-1">
                           <div className="flex items-center gap-2">
                             <span className="font-medium">{camera.name}</span>
                             <Badge variant={camera.status === 'online' ? 'default' : camera.status === 'configured' ? 'secondary' : 'destructive'}>
                               {camera.status === 'online' ? 'Online' : camera.status === 'configured' ? 'Configurada' : 'Offline'}
                             </Badge>
                             {camera.is_permanent && (
                               <Badge variant="outline" className="text-blue-600 border-blue-600">
                                 Permanente
                               </Badge>
                             )}
                           </div>
                           <div className="text-sm text-muted-foreground">
                             {camera.ip_address}:{camera.port} • {camera.brand} {camera.model}
                           </div>
                           {camera.network_mask && (
                             <div className="text-sm text-muted-foreground">
                               Máscara: {camera.network_mask} • Gateway: {camera.gateway} • DNS: {camera.dns_server}
                             </div>
                           )}
                           {camera.error_message && (
                             <div className="text-sm text-red-500">
                               Erro: {camera.error_message}
                             </div>
                           )}
                         </div>
                         <div className="flex items-center gap-2">
                           {camera.status === 'online' ? (
                             <Wifi className="h-4 w-4 text-green-500" />
                           ) : camera.status === 'configured' ? (
                             <Wifi className="h-4 w-4 text-blue-500" />
                           ) : (
                             <WifiOff className="h-4 w-4 text-red-500" />
                           )}
                         </div>
                       </div>
                     </Card>
                   ))}
                 </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}