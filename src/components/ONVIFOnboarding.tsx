import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, 
  Network, 
  Settings, 
  Navigation,
  CheckCircle,
  Loader2,
  PlayCircle,
  Video,
  Wifi,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';

interface ONVIFProfile {
  token: string;
  name: string;
  type: 'main' | 'sub' | 'snapshot';
  encoding: string;
  resolution: string;
  framerate?: number;
  bitrate?: number;
  rtsp_uri?: string;
}

interface PTZCapability {
  panTilt: boolean;
  zoom: boolean;
  presets: boolean;
  tours: boolean;
  homePosition: boolean;
}

interface DiscoveredCamera {
  ip: string;
  port: number;
  manufacturer?: string;
  model?: string;
  onvif_version?: string;
  capabilities?: string[];
  profiles?: ONVIFProfile[];
  ptz?: PTZCapability;
}

const ONVIFOnboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<DiscoveredCamera | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [networkRange, setNetworkRange] = useState('192.168.1.0/24');
  const [onboardingProgress, setOnboardingProgress] = useState(0);

  const handleNetworkScan = useCallback(async () => {
    setIsScanning(true);
    setOnboardingProgress(0);
    
    try {
      const response = await fetch('/api/onvif/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ network_range: networkRange })
      });
      
      if (!response.ok) throw new Error('Falha na descoberta');
      
      const data = await response.json();
      setDiscoveredCameras(data.cameras);
      setOnboardingProgress(33);
      toast.success(`Descobertas ${data.cameras.length} câmeras ONVIF`);
      
      if (data.cameras.length > 0) {
        setCurrentStep(2);
      }
    } catch (error) {
      toast.error('Erro na descoberta de câmeras');
    } finally {
      setIsScanning(false);
    }
  }, [networkRange]);

  const handleAuthentication = useCallback(async (camera: DiscoveredCamera) => {
    try {
      const response = await fetch('/api/onvif/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: camera.ip,
          port: camera.port,
          credentials
        })
      });
      
      if (!response.ok) throw new Error('Falha na autenticação');
      
      const data = await response.json();
      setSelectedCamera({
        ...camera,
        profiles: data.profiles,
        ptz: data.ptz_capabilities
      });
      setOnboardingProgress(66);
      setCurrentStep(3);
      toast.success('Autenticação realizada com sucesso');
    } catch (error) {
      toast.error('Erro na autenticação');
    }
  }, [credentials]);

  const handleProfileConfiguration = useCallback(async (profiles: ONVIFProfile[]) => {
    try {
      const response = await fetch('/api/camera/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_ip: selectedCamera?.ip,
          profiles,
          credentials,
          ptz_enabled: selectedCamera?.ptz?.panTilt || false
        })
      });
      
      if (!response.ok) throw new Error('Falha na configuração');
      
      setOnboardingProgress(100);
      setCurrentStep(4);
      toast.success('Câmera configurada com sucesso!');
    } catch (error) {
      toast.error('Erro na configuração da câmera');
    }
  }, [selectedCamera, credentials]);

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-5 w-5" />
          Descoberta de Rede
        </CardTitle>
        <CardDescription>
          Escaneie sua rede para descobrir câmeras ONVIF compatíveis
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="network-range">Faixa de Rede</Label>
          <Input
            id="network-range"
            value={networkRange}
            onChange={(e) => setNetworkRange(e.target.value)}
            placeholder="192.168.1.0/24"
          />
        </div>
        
        <Button 
          onClick={handleNetworkScan} 
          disabled={isScanning}
          className="w-full"
        >
          {isScanning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Escaneando rede...
            </>
          ) : (
            <>
              <Network className="mr-2 h-4 w-4" />
              Iniciar Descoberta
            </>
          )}
        </Button>

        {discoveredCameras.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold">Câmeras Descobertas:</h4>
            {discoveredCameras.map((camera, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{camera.ip}:{camera.port}</div>
                    <div className="text-sm text-muted-foreground">
                      {camera.manufacturer} {camera.model}
                    </div>
                  </div>
                  <Badge variant="outline">ONVIF {camera.onvif_version}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Autenticação
        </CardTitle>
        <CardDescription>
          Configure as credenciais para acessar a câmera
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={credentials.username}
              onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
              placeholder="admin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Selecionar Câmera</Label>
          {discoveredCameras.map((camera, index) => (
            <Card 
              key={index} 
              className={`p-3 cursor-pointer border-2 ${
                selectedCamera?.ip === camera.ip ? 'border-primary' : 'border-border'
              }`}
              onClick={() => setSelectedCamera(camera)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{camera.ip}:{camera.port}</div>
                  <div className="text-sm text-muted-foreground">
                    {camera.manufacturer} {camera.model}
                  </div>
                </div>
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAuthentication(camera);
                  }}
                  disabled={!credentials.username || !credentials.password}
                  size="sm"
                >
                  Autenticar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Perfis de Stream
        </CardTitle>
        <CardDescription>
          Configure os perfis de vídeo e recursos PTZ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedCamera?.profiles && (
          <div className="space-y-4">
            <h4 className="font-semibold">Perfis Disponíveis:</h4>
            {selectedCamera.profiles.map((profile, index) => (
              <Card key={index} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{profile.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {profile.resolution} • {profile.encoding} • {profile.framerate}fps
                    </div>
                  </div>
                  <Badge variant={profile.type === 'main' ? 'default' : 'secondary'}>
                    {profile.type}
                  </Badge>
                </div>
                {profile.rtsp_uri && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono">
                    {profile.rtsp_uri}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {selectedCamera?.ptz && (
          <div className="space-y-2">
            <h4 className="font-semibold">Recursos PTZ:</h4>
            <div className="grid grid-cols-2 gap-2">
              {selectedCamera.ptz.panTilt && (
                <Badge variant="outline" className="justify-center">
                  <Navigation className="w-3 h-3 mr-1" />
                  Pan/Tilt
                </Badge>
              )}
              {selectedCamera.ptz.zoom && (
                <Badge variant="outline" className="justify-center">
                  <Eye className="w-3 h-3 mr-1" />
                  Zoom
                </Badge>
              )}
              {selectedCamera.ptz.presets && (
                <Badge variant="outline" className="justify-center">
                  <Camera className="w-3 h-3 mr-1" />
                  Presets
                </Badge>
              )}
              {selectedCamera.ptz.tours && (
                <Badge variant="outline" className="justify-center">
                  <PlayCircle className="w-3 h-3 mr-1" />
                  Tours
                </Badge>
              )}
            </div>
          </div>
        )}

        <Button 
          onClick={() => selectedCamera?.profiles && handleProfileConfiguration(selectedCamera.profiles)}
          className="w-full"
          disabled={!selectedCamera?.profiles}
        >
          Configurar Câmera
        </Button>
      </CardContent>
    </Card>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Configuração Concluída
        </CardTitle>
        <CardDescription>
          Sua câmera ONVIF foi configurada com sucesso
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            A câmera {selectedCamera?.ip} foi adicionada ao sistema e está pronta para uso.
            Todos os perfis de stream foram configurados e os recursos PTZ estão disponíveis.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <h4 className="font-semibold">Próximos Passos:</h4>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Configurar zonas de detecção na página de Câmeras</li>
            <li>Ajustar parâmetros de análise no Sistema</li>
            <li>Testar recursos PTZ no painel de controle</li>
          </ul>
        </div>

        <Button 
          onClick={() => {
            setCurrentStep(1);
            setSelectedCamera(null);
            setDiscoveredCameras([]);
            setOnboardingProgress(0);
          }}
          className="w-full"
        >
          Configurar Outra Câmera
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Onboarding ONVIF</h2>
        <p className="text-muted-foreground">
          Assistente para descoberta e configuração automática de câmeras ONVIF
        </p>
      </div>

      <Progress value={onboardingProgress} className="w-full" />

      <Tabs value={currentStep.toString()} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="1">Descoberta</TabsTrigger>
          <TabsTrigger value="2">Autenticação</TabsTrigger>
          <TabsTrigger value="3">Perfis</TabsTrigger>
          <TabsTrigger value="4">Conclusão</TabsTrigger>
        </TabsList>

        <TabsContent value="1">
          {renderStep1()}
        </TabsContent>

        <TabsContent value="2">
          {renderStep2()}
        </TabsContent>

        <TabsContent value="3">
          {renderStep3()}
        </TabsContent>

        <TabsContent value="4">
          {renderStep4()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ONVIFOnboarding;