import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { IPCameraSetup } from "@/components/IPCameraSetup";
import { 
  Camera, 
  Wifi, 
  CheckCircle, 
  ArrowRight,
  Plus,
  Trash2,
  Monitor,
  Router
} from "lucide-react";

const Setup = () => {
  const [setupType, setSetupType] = useState<'ip' | 'dvr' | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [savedCameras, setSavedCameras] = useState<any[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const steps = [
    { id: "manual", title: "Configurar Câmeras", icon: <Camera className="h-6 w-6" /> },
    { id: "test", title: "Testar Conexão", icon: <Wifi className="h-6 w-6" /> },
    { id: "complete", title: "Finalizar", icon: <CheckCircle className="h-6 w-6" /> },
  ];

  useEffect(() => {
    loadSavedCameras();
  }, []);

  const loadSavedCameras = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) throw error;
      
      setSavedCameras(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar câmeras:', error);
    }
  };

  const handleCameraAdded = (camera: any) => {
    setSavedCameras(prev => [...prev, camera]);
    if (savedCameras.length === 0) {
      toast({
        title: "Primeira câmera adicionada! 🎉",
        description: "Agora você pode testar a conexão ou adicionar mais câmeras",
      });
    }
  };

  const deleteCamera = async (cameraId: string) => {
    try {
      const { error } = await supabase
        .from('ip_cameras')
        .delete()
        .eq('id', cameraId);
      
      if (error) throw error;
      
      setSavedCameras(prev => prev.filter(cam => cam.id !== cameraId));
      toast({
        title: "Câmera removida",
        description: "A câmera foi removida da configuração",
      });
    } catch (error) {
      console.error('Erro ao remover câmera:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a câmera",
        variant: "destructive"
      });
    }
  };

  const finishSetup = () => {
    if (savedCameras.length === 0) {
      toast({
        title: "Atenção",
        description: "Adicione pelo menos uma câmera antes de finalizar",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('setupCompleted', 'true');
    
    toast({
      title: "Configuração concluída! 🎉",
      description: "Redirecionando para seu painel...",
    });

    setTimeout(() => {
      navigate('/dashboard-simple');
    }, 1500);
  };

  const progress = savedCameras.length > 0 ? 100 : 50;

  // Se ainda não escolheu o tipo de setup, mostra opções
  if (!setupType) {
    return (
      <>
        <Helmet>
          <title>Escolha o Tipo de Configuração - Visão de Águia</title>
          <meta name="description" content="Escolha entre configurar câmeras IP ou sistemas DVR/NVR" />
        </Helmet>
        
        <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-3xl font-bold mb-2">Configuração Inicial</h1>
              <p className="text-muted-foreground text-lg">
                Escolha como você deseja configurar seus dispositivos de câmeras
              </p>
            </div>

            {/* Options */}
            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Câmeras IP */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSetupType('ip')}>
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Câmeras IP</h3>
                    <p className="text-muted-foreground text-sm">
                      Configure câmeras IP individuais conectadas diretamente à rede
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Configuração individual por câmera</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Suporte ONVIF e HTTP</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Detecção automática de capabilities</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* DVR/NVR */}
              <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSetupType('dvr')}>
                <CardContent className="p-8 text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Monitor className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">Sistema DVR/NVR</h3>
                    <p className="text-muted-foreground text-sm">
                      Configure sistemas DVR ou NVR com múltiplas câmeras conectadas
                    </p>
                  </div>
                  <div className="space-y-2 text-sm text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Suporte para marcas populares</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Configuração RTSP automática</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Teste de conectividade</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Back button */}
            <div className="text-center mt-8">
              <Button variant="ghost" onClick={() => navigate('/')}>
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Se escolheu DVR, redireciona para página específica
  if (setupType === 'dvr') {
    navigate('/test-dvr');
    return null;
  }

  return (
    <>
      <Helmet>
        <title>Configuração de Câmeras IP - Visão de Águia</title>
        <meta name="description" content="Configure suas câmeras IP manualmente com dados precisos" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={() => setSetupType(null)}>
                ← Voltar
              </Button>
            </div>
            <h1 className="text-3xl font-bold mb-2">Configuração de Câmeras IP</h1>
            <p className="text-muted-foreground text-lg">
              Configure suas câmeras IP manualmente com seus dados de rede
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-4">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                savedCameras.length > 0 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'border-gray-300 text-gray-400'
              }`}>
                <Camera className="h-5 w-5" />
              </div>
              <span className="ml-3 text-lg font-medium">
                {savedCameras.length > 0 ? `${savedCameras.length} câmera(s) configurada(s)` : 'Configure suas câmeras'}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Content */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Configuração */}
            <div>
              <IPCameraSetup onCameraAdded={handleCameraAdded} />
            </div>

            {/* Câmeras Salvas */}
            <div>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Câmeras Configuradas</h3>
                    <span className="text-sm text-muted-foreground">
                      {savedCameras.length} câmera(s)
                    </span>
                  </div>
                  
                  {savedCameras.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma câmera configurada ainda</p>
                      <p className="text-sm">Adicione uma câmera ao lado para começar</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {savedCameras.map((camera) => (
                        <div 
                          key={camera.id}
                          className="p-4 border rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${
                              camera.status === 'online' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              <Camera className={`h-4 w-4 ${
                                camera.status === 'online' ? 'text-green-600' : 'text-red-600'
                              }`} />
                            </div>
                            <div>
                              <h4 className="font-medium">{camera.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {camera.brand} • {camera.ip_address}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              camera.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCamera(camera.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {savedCameras.length > 0 && (
                    <div className="mt-6 pt-6 border-t">
                      <Button onClick={finishSetup} className="w-full" size="lg">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        Finalizar Configuração
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Setup;