import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Wifi, TestTube, Save } from "lucide-react";
import { toast } from "sonner";

interface TestCamera {
  id: string;
  name: string;
  ip_address: string;
  brand?: string;
  model?: string;
  network_mask?: string;
  gateway?: string;
  dns_server?: string;
  is_permanent?: boolean;
  status: string;
}

export default function TestCameraIPUpdater() {
  const [testCamera, setTestCamera] = useState<TestCamera | null>(null);
  const [newIP, setNewIP] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadTestCamera = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        // Find the TP-Link TC73 test camera
        const camera = data.data?.find((cam: TestCamera) => 
          cam.is_permanent && cam.model === 'TC73'
        );
        
        if (camera) {
          setTestCamera(camera);
          setNewIP(camera.ip_address);
        }
      }
    } catch (error) {
      console.error('Error loading test camera:', error);
      toast.error('Erro ao carregar câmera de teste');
    } finally {
      setLoading(false);
    }
  };

  const updateCameraIP = async () => {
    if (!testCamera || !newIP) return;

    try {
      setUpdating(true);
      
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'update-ip',
          camera_id: testCamera.id,
          new_ip: newIP
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(data.message);
        setTestCamera({ ...testCamera, ip_address: newIP, status: 'configured' });
      } else {
        toast.error(data.error || 'Erro ao atualizar IP');
      }
    } catch (error) {
      console.error('Error updating IP:', error);
      toast.error('Erro ao atualizar IP da câmera');
    } finally {
      setUpdating(false);
    }
  };

  const testConnection = async () => {
    if (!testCamera || !newIP) return;

    try {
      setTesting(true);
      
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'test-connection',
          name: testCamera.name,
          brand: testCamera.brand,
          model: testCamera.model,
          ip_address: newIP,
          port: 554,
          username: 'admin',
          password: 'admin',
          rtsp_path: '/stream1'
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Conexão com ${newIP} bem-sucedida!`);
      } else {
        toast.error(`Falha na conexão: ${data.error}`);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    loadTestCamera();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando câmera de teste...</div>
        </CardContent>
      </Card>
    );
  }

  if (!testCamera) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert>
            <AlertDescription>
              Câmera de teste TP-Link TC73 não encontrada
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Alterar IP da Câmera de Teste
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{testCamera.name}</h4>
            <Badge variant="secondary">Permanente</Badge>
            <Badge variant={testCamera.status === 'configured' ? 'default' : 'destructive'}>
              <Wifi className="h-3 w-3 mr-1" />
              {testCamera.status}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <p><strong>Marca/Modelo:</strong> {testCamera.brand} {testCamera.model}</p>
            <p><strong>IP Atual:</strong> {testCamera.ip_address}</p>
            {testCamera.network_mask && (
              <p><strong>Máscara:</strong> {testCamera.network_mask}</p>
            )}
            {testCamera.gateway && (
              <p><strong>Gateway:</strong> {testCamera.gateway}</p>
            )}
            {testCamera.dns_server && (
              <p><strong>DNS:</strong> {testCamera.dns_server}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-ip">Novo Endereço IP</Label>
          <Input
            id="new-ip"
            value={newIP}
            onChange={(e) => setNewIP(e.target.value)}
            placeholder="192.168.1.100"
            pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testConnection}
            disabled={testing || !newIP || newIP === testCamera.ip_address}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            {testing ? 'Testando...' : 'Testar Conexão'}
          </Button>
          
          <Button
            onClick={updateCameraIP}
            disabled={updating || !newIP || newIP === testCamera.ip_address}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {updating ? 'Atualizando...' : 'Atualizar IP'}
          </Button>
        </div>

        <Alert>
          <AlertDescription>
            Esta é a câmera de teste permanente do sistema. Altere apenas o IP quando ela estiver conectada em uma rede diferente.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}