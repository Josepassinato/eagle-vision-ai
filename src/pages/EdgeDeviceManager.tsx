import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Monitor, QrCode, Download, CheckCircle, XCircle, Clock } from "lucide-react";
import QRCode from "qrcode";

export default function EdgeDeviceManager() {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [linkingCode, setLinkingCode] = useState("");
  
  // Device linking form
  const [deviceName, setDeviceName] = useState("");
  const [deviceLocation, setDeviceLocation] = useState("");
  const [orgId, setOrgId] = useState("");

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('edge_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateLinkingCode = async () => {
    if (!orgId) {
      alert("Please enter Organization ID first");
      return;
    }

    try {
      // Generate a unique device ID
      const deviceId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create linking payload
      const linkingData = {
        org_id: orgId,
        device_id: deviceId,
        device_name: deviceName || `Edge Device ${deviceId.slice(-8)}`,
        location: deviceLocation,
        timestamp: Date.now()
      };

      // Generate QR code with linking data
      const qrData = JSON.stringify(linkingData);
      const qrUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeUrl(qrUrl);
      setLinkingCode(qrData);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const linkDevice = async (deviceData: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('device-link', {
        body: deviceData
      });

      if (error) throw error;
      
      console.log('Device linked successfully:', data);
      fetchDevices(); // Refresh devices list
      return data;
    } catch (error: any) {
      console.error('Error linking device:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'linked':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Linked</Badge>;
      case 'online':
        return <Badge variant="outline" className="text-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Online</Badge>;
      case 'offline':
        return <Badge variant="outline" className="text-gray-600"><XCircle className="w-3 h-3 mr-1" />Offline</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Unknown</Badge>;
    }
  };

  const downloadDockerCompose = () => {
    const dockerCompose = `version: "3.8"

services:
  fusion:
    image: yourrepo/fusion:latest
    restart: unless-stopped
    environment:
      - SUPABASE_URL=${window.location.origin}
      - ORG_API_KEY=\${ORG_API_KEY}
      - DEVICE_ID=\${DEVICE_ID}
      - EDGE_MODE=true
      - METADATA_ONLY=true
    volumes:
      - fusion_data:/data
    ports:
      - "8080:8080"
    networks:
      - edge_network

  mediamtx:
    image: bluenviron/mediamtx:latest
    restart: unless-stopped
    ports:
      - "8554:8554"
      - "8889:8889"
    networks:
      - edge_network

  peoplevision:
    image: yourrepo/peoplevision:latest
    restart: unless-stopped
    environment:
      - EDGE_MODE=true
      - METADATA_ONLY=true
    volumes:
      - models_cache:/models
    networks:
      - edge_network

  vehiclevision:
    image: yourrepo/vehiclevision:latest
    restart: unless-stopped
    environment:
      - EDGE_MODE=true
      - METADATA_ONLY=true
    volumes:
      - models_cache:/models
    networks:
      - edge_network

  safetyvision:
    image: yourrepo/safetyvision:latest
    restart: unless-stopped
    environment:
      - EDGE_MODE=true
      - METADATA_ONLY=true
    volumes:
      - models_cache:/models
    networks:
      - edge_network

volumes:
  fusion_data:
  models_cache:

networks:
  edge_network:
    driver: bridge`;

    const blob = new Blob([dockerCompose], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.edge.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Edge Appliance Manager</h1>
        <p className="text-muted-foreground">
          Gerenciar dispositivos edge para processamento local de vídeo
        </p>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="devices">
            <Monitor className="w-4 h-4 mr-2" />
            Dispositivos
          </TabsTrigger>
          <TabsTrigger value="linking">
            <QrCode className="w-4 h-4 mr-2" />
            Vincular Novo
          </TabsTrigger>
          <TabsTrigger value="setup">
            <Download className="w-4 h-4 mr-2" />
            Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <Card>
            <CardHeader>
              <CardTitle>Dispositivos Edge</CardTitle>
              <CardDescription>
                Lista de todos os dispositivos edge vinculados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" />
                  Carregando dispositivos...
                </div>
              ) : devices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Última Conexão</TableHead>
                      <TableHead>Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.device_name}</TableCell>
                        <TableCell className="font-mono text-sm">{device.device_id}</TableCell>
                        <TableCell>{device.location || "—"}</TableCell>
                        <TableCell>{getStatusBadge(device.status)}</TableCell>
                        <TableCell>
                          {device.last_seen 
                            ? new Date(device.last_seen).toLocaleString()
                            : "Nunca"
                          }
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{device.device_type}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center p-8">
                  <Monitor className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum dispositivo edge vinculado ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linking">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Gerar QR Code</CardTitle>
                <CardDescription>
                  Criar código de vinculação para novo dispositivo edge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Organization ID</label>
                  <Input
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    placeholder="ID da organização"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nome do Dispositivo</label>
                  <Input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Edge Device Loja 1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Localização</label>
                  <Input
                    value={deviceLocation}
                    onChange={(e) => setDeviceLocation(e.target.value)}
                    placeholder="Loja Centro - São Paulo"
                  />
                </div>
                <Button 
                  onClick={generateLinkingCode} 
                  disabled={!orgId}
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Gerar QR Code
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Code de Vinculação</CardTitle>
                <CardDescription>
                  Escaneie este código no dispositivo edge
                </CardDescription>
              </CardHeader>
              <CardContent>
                {qrCodeUrl ? (
                  <div className="text-center space-y-4">
                    <img 
                      src={qrCodeUrl} 
                      alt="QR Code de Vinculação" 
                      className="mx-auto border rounded"
                    />
                    <Alert>
                      <AlertDescription>
                        <strong>Instruções:</strong>
                        <br />1. Configure o dispositivo edge com docker-compose
                        <br />2. Escaneie este QR code na interface local
                        <br />3. O dispositivo será automaticamente vinculado
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <div className="text-center p-8 border-2 border-dashed border-muted rounded">
                    <QrCode className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      QR Code será exibido aqui
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Setup do Edge Appliance</CardTitle>
              <CardDescription>
                Instruções para instalar e configurar dispositivo edge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertDescription>
                  <strong>Política de Privacidade:</strong> O vídeo nunca sai do local. 
                  Apenas metadados e clips sob demanda são enviados para a nuvem.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">1. Download do Docker Compose</h3>
                <p className="text-sm text-muted-foreground">
                  Baixe o arquivo de configuração do Docker Compose para o edge appliance:
                </p>
                <Button onClick={downloadDockerCompose} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download docker-compose.edge.yml
                </Button>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">2. Configuração de Ambiente</h3>
                <p className="text-sm text-muted-foreground">
                  Crie um arquivo .env com as variáveis necessárias:
                </p>
                <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`# .env file for edge appliance
ORG_API_KEY=your_org_api_key_here
DEVICE_ID=edge_device_unique_id
SUPABASE_URL=${window.location.origin}
EDGE_MODE=true
METADATA_ONLY=true`}
                </pre>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">3. Inicialização</h3>
                <p className="text-sm text-muted-foreground">
                  Execute os comandos para iniciar o edge appliance:
                </p>
                <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
{`# Iniciar todos os serviços
docker-compose -f docker-compose.edge.yml up -d

# Verificar status
docker-compose -f docker-compose.edge.yml ps

# Ver logs
docker-compose -f docker-compose.edge.yml logs -f`}
                </pre>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">4. Especificações Técnicas</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">Requisitos Mínimos:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 8GB RAM</li>
                      <li>• 4 CPU cores</li>
                      <li>• 100GB SSD</li>
                      <li>• Docker 20.10+</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Recomendado:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 16GB RAM</li>
                      <li>• 8 CPU cores</li>
                      <li>• 500GB SSD</li>
                      <li>• GPU (opcional para ALPR)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">5. Recursos</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Processamento Local</h4>
                      <p className="text-sm text-muted-foreground">
                        Todo o processamento de vídeo acontece localmente
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Metadados Apenas</h4>
                      <p className="text-sm text-muted-foreground">
                        Apenas dados de detecção são enviados à nuvem
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Clips sob Demanda</h4>
                      <p className="text-sm text-muted-foreground">
                        Vídeos enviados apenas quando solicitado
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}