import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Camera, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  Wifi,
  Lock,
  Smartphone
} from 'lucide-react';

interface TAPOStatus {
  isChecking: boolean;
  cameraOnline: boolean;
  rtspEnabled: boolean;
  authWorking: boolean;
  tapoAppConfig: any;
  lastError: string;
}

export default function TAPOCameraChecker() {
  const [status, setStatus] = useState<TAPOStatus>({
    isChecking: false,
    cameraOnline: false,
    rtspEnabled: false,
    authWorking: false,
    tapoAppConfig: null,
    lastError: ''
  });

  const checkTAPOCamera = async () => {
    setStatus(prev => ({ ...prev, isChecking: true, lastError: '' }));
    
    try {
      // 1. Verificar se a câmera responde na rede
      const { data: cameraData, error: cameraError } = await supabase.functions.invoke('ip-camera-manager', {
        body: { 
          action: 'test-connection',
          ip_address: '172.16.100.22',
          port: 554,
          username: 'admin',
          password: 'admin',
          rtsp_path: '/stream1'
        },
        headers: { 'x-org-id': 'demo-org-id' }
      });

      if (cameraError) {
        throw new Error(`Erro ao testar câmera: ${cameraError.message}`);
      }

      console.log('Teste de câmera TAPO:', cameraData);

      const isOnline = cameraData?.success && cameraData?.tests?.http?.success;
      const rtspWorking = cameraData?.tests?.rtsp?.success;
      
      setStatus(prev => ({
        ...prev,
        cameraOnline: isOnline,
        rtspEnabled: rtspWorking,
        authWorking: rtspWorking, // Se RTSP funciona, auth está OK
        tapoAppConfig: cameraData?.tests || {}
      }));

      if (isOnline && rtspWorking) {
        toast.success('Câmera TAPO configurada corretamente!');
      } else if (isOnline && !rtspWorking) {
        toast.warning('Câmera online mas RTSP não habilitado');
      } else {
        toast.error('Câmera não acessível pela rede');
      }

    } catch (error) {
      console.error('Erro ao verificar TAPO:', error);
      setStatus(prev => ({
        ...prev,
        lastError: error.message
      }));
      toast.error(`Erro: ${error.message}`);
    } finally {
      setStatus(prev => ({ ...prev, isChecking: false }));
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Verificação TAPO TP-Link TC73
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Botão de Teste */}
        <Button 
          onClick={checkTAPOCamera}
          disabled={status.isChecking}
          className="w-full"
        >
          {status.isChecking ? 'Verificando...' : 'Testar Configuração TAPO'}
        </Button>

        {/* Status da Câmera */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Wifi className="h-4 w-4" />
            <div>
              <div className="text-sm font-medium">Conectividade</div>
              <Badge variant={status.cameraOnline ? "default" : "destructive"}>
                {status.cameraOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Camera className="h-4 w-4" />
            <div>
              <div className="text-sm font-medium">RTSP Stream</div>
              <Badge variant={status.rtspEnabled ? "default" : "destructive"}>
                {status.rtspEnabled ? 'Habilitado' : 'Desabilitado'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 border rounded-lg">
            <Lock className="h-4 w-4" />
            <div>
              <div className="text-sm font-medium">Autenticação</div>
              <Badge variant={status.authWorking ? "default" : "destructive"}>
                {status.authWorking ? 'OK' : 'Falha'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Instruções TAPO */}
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <div className="font-semibold">Configurações necessárias no App TAPO:</div>
            <div className="text-sm space-y-1">
              <div>• <strong>Câmera</strong> → <strong>Configurações</strong> → <strong>Avançado</strong></div>
              <div>• Ativar <strong>"RTSP"</strong> ou <strong>"Protocolo ONVIF"</strong></div>
              <div>• Configurar usuário: <code>admin</code> senha: <code>admin</code></div>
              <div>• Verificar que <strong>modo Privacy</strong> está desabilitado</div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Informações Técnicas */}
        {status.tapoAppConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Detalhes Técnicos</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              <div className="space-y-2">
                <div><strong>IP:</strong> 172.16.100.22:554</div>
                <div><strong>RTSP:</strong> rtsp://admin:admin@172.16.100.22:554/stream1</div>
                {status.tapoAppConfig.http && (
                  <div><strong>HTTP:</strong> {status.tapoAppConfig.http.success ? '✅' : '❌'}</div>
                )}
                {status.tapoAppConfig.rtsp && (
                  <div><strong>RTSP Test:</strong> {status.tapoAppConfig.rtsp.success ? '✅' : '❌'}</div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Erro */}
        {status.lastError && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{status.lastError}</AlertDescription>
          </Alert>
        )}

      </CardContent>
    </Card>
  );
}