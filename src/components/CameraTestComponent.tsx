import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Wifi, TestTube } from "lucide-react";
import { toast } from "sonner";
import TestCameraIPUpdater from "@/components/TestCameraIPUpdater";

interface IPCamera {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  ip_address: string;
  port: number;
  network_mask?: string;
  gateway?: string;
  dns_server?: string;
  is_permanent?: boolean;
  status: string;
}

export default function CameraTestComponent() {
  const [cameras, setCameras] = useState<IPCamera[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState<string | null>(null);

  const loadCameras = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) {
        console.error('Error loading cameras:', error);
        toast.error('Erro ao carregar câmeras');
        return;
      }
      
      if (data.success) {
        setCameras(data.data || []);
        toast.success(`${data.data?.length || 0} câmeras carregadas`);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast.error('Erro ao carregar câmeras');
    } finally {
      setLoading(false);
    }
  };

  const testCamera = async (camera: IPCamera) => {
    try {
      setTesting(camera.id);
      
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'test-connection',
          name: camera.name,
          brand: camera.brand,
          model: camera.model,
          ip_address: camera.ip_address,
          port: camera.port,
          username: 'admin',
          password: 'admin',
          rtsp_path: '/stream1'
        },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) {
        console.error('Test error:', error);
        toast.error('Erro no teste de conexão');
        return;
      }
      
      if (data.success) {
        toast.success(`Conexão com ${camera.name} bem-sucedida!`);
      } else {
        toast.error(`Falha na conexão: ${data.error}`);
      }
    } catch (error) {
      console.error('Test camera error:', error);
      toast.error('Erro ao testar câmera');
    } finally {
      setTesting(null);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  return (
    <div className="space-y-6">
      <TestCameraIPUpdater />
      
      <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Teste de Câmeras IP ({cameras.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Button onClick={loadCameras} disabled={loading}>
            {loading ? 'Carregando...' : 'Recarregar Câmeras'}
          </Button>
          
          {cameras.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? 'Carregando câmeras...' : 'Nenhuma câmera encontrada'}
            </div>
          ) : (
            <div className="space-y-3">
              {cameras.map((camera) => (
                <Card key={camera.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-medium">{camera.name}</h4>
                        {camera.is_permanent && (
                          <Badge variant="secondary">Permanente</Badge>
                        )}
                        <Badge variant={camera.status === 'configured' ? 'default' : 'destructive'}>
                          <Wifi className="h-3 w-3 mr-1" />
                          {camera.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><strong>IP:</strong> {camera.ip_address}:{camera.port}</p>
                        <p><strong>Marca/Modelo:</strong> {camera.brand} {camera.model}</p>
                        {camera.network_mask && (
                          <p><strong>Rede:</strong> {camera.network_mask}</p>
                        )}
                        {camera.gateway && (
                          <p><strong>Gateway:</strong> {camera.gateway}</p>
                        )}
                        {camera.dns_server && (
                          <p><strong>DNS:</strong> {camera.dns_server}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      onClick={() => testCamera(camera)}
                      disabled={testing === camera.id}
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <TestTube className="h-4 w-4" />
                      {testing === camera.id ? 'Testando...' : 'Testar'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}