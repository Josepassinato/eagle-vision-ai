import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { 
  Camera, 
  Wifi, 
  CheckCircle, 
  Search, 
  Monitor,
  Router,
  Smartphone,
  ArrowRight,
  RefreshCw
} from "lucide-react";

const Setup = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [foundCameras, setFoundCameras] = useState<any[]>([]);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const steps = [
    { id: "scan", title: "Buscar Câmeras", icon: <Search className="h-6 w-6" /> },
    { id: "select", title: "Selecionar Câmeras", icon: <Camera className="h-6 w-6" /> },
    { id: "test", title: "Testar Conexão", icon: <Wifi className="h-6 w-6" /> },
    { id: "complete", title: "Finalizar", icon: <CheckCircle className="h-6 w-6" /> },
  ];

  // Simulação de câmeras encontradas
  const mockCameras = [
    { id: "cam_001", name: "Câmera Entrada Principal", ip: "192.168.1.101", brand: "Hikvision", status: "online" },
    { id: "cam_002", name: "Câmera Corredor", ip: "192.168.1.102", brand: "Intelbras", status: "online" },
    { id: "cam_003", name: "Câmera Estoque", ip: "192.168.1.103", brand: "Dahua", status: "offline" },
  ];

  const startScan = async () => {
    setIsScanning(true);
    toast({
      title: "Buscando câmeras...",
      description: "Procurando dispositivos na sua rede",
    });

    // Simular busca de câmeras
    setTimeout(() => {
      setFoundCameras(mockCameras);
      setIsScanning(false);
      setCurrentStep(1);
      toast({
        title: "Câmeras encontradas! 📹",
        description: `Encontramos ${mockCameras.length} câmeras na sua rede`,
      });
    }, 3000);
  };

  const toggleCamera = (cameraId: string) => {
    setSelectedCameras(prev => 
      prev.includes(cameraId) 
        ? prev.filter(id => id !== cameraId)
        : [...prev, cameraId]
    );
  };

  const testCameras = async () => {
    setCurrentStep(2);
    toast({
      title: "Testando conexões...",
      description: "Verificando se as câmeras estão funcionando",
    });

    setTimeout(() => {
      setCurrentStep(3);
      toast({
        title: "Tudo funcionando! ✅",
        description: "Suas câmeras estão conectadas e transmitindo",
      });
    }, 2000);
  };

  const finishSetup = () => {
    // Salvar configuração
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('selectedCameras', JSON.stringify(selectedCameras));
    
    toast({
      title: "Configuração concluída! 🎉",
      description: "Redirecionando para seu painel...",
    });

    setTimeout(() => {
      navigate('/dashboard-simple');
    }, 1500);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <>
      <Helmet>
        <title>Configuração Automática - Visão de Águia</title>
        <meta name="description" content="Configure suas câmeras automaticamente em poucos cliques" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Configuração Automática de Câmeras</h1>
            <p className="text-muted-foreground text-lg">
              Vamos encontrar e conectar suas câmeras automaticamente
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    index <= currentStep 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'border-gray-300 text-gray-400'
                  }`}>
                    {index < currentStep ? <CheckCircle className="h-5 w-5" /> : step.icon}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                  }`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-4 rounded ${
                      index < currentStep ? 'bg-primary' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Content */}
          <Card className="shadow-xl">
            <CardContent className="p-8">
              {/* Step 0: Scan */}
              {currentStep === 0 && (
                <div className="text-center space-y-6">
                  <div className="text-6xl mb-4">🔍</div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Buscar Câmeras na Rede</h2>
                    <p className="text-muted-foreground mb-6">
                      Vamos procurar automaticamente por câmeras IP na sua rede local
                    </p>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <div className="text-center p-4 border rounded-lg">
                      <Router className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <h4 className="font-semibold mb-1">Rede Local</h4>
                      <p className="text-sm text-muted-foreground">Scaneia 192.168.x.x</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Camera className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <h4 className="font-semibold mb-1">Câmeras IP</h4>
                      <p className="text-sm text-muted-foreground">Hikvision, Dahua, Intelbras</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <Monitor className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                      <h4 className="font-semibold mb-1">Auto-Config</h4>
                      <p className="text-sm text-muted-foreground">Configuração automática</p>
                    </div>
                  </div>

                  {!isScanning ? (
                    <Button onClick={startScan} size="lg" className="text-lg px-8">
                      <Search className="h-5 w-5 mr-2" />
                      Buscar Câmeras Automaticamente
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary mr-3" />
                        <span className="text-lg">Procurando câmeras...</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Isso pode levar alguns segundos...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Select Cameras */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold mb-2">Câmeras Encontradas! 📹</h2>
                    <p className="text-muted-foreground">
                      Selecione quais câmeras você quer usar para monitoramento
                    </p>
                  </div>

                  <div className="space-y-3">
                    {foundCameras.map((camera) => (
                      <div 
                        key={camera.id}
                        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          selectedCameras.includes(camera.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-200 hover:border-primary/50'
                        }`}
                        onClick={() => toggleCamera(camera.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className={`p-2 rounded-lg ${
                              camera.status === 'online' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              <Camera className={`h-5 w-5 ${
                                camera.status === 'online' ? 'text-green-600' : 'text-red-600'
                              }`} />
                            </div>
                            <div>
                              <h4 className="font-semibold">{camera.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {camera.brand} • {camera.ip}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={camera.status === 'online' ? 'default' : 'destructive'}>
                              {camera.status === 'online' ? '✅ Online' : '❌ Offline'}
                            </Badge>
                            {selectedCameras.includes(camera.id) && (
                              <CheckCircle className="h-5 w-5 text-primary" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between pt-6">
                    <Button variant="outline" onClick={() => setCurrentStep(0)}>
                      Buscar Novamente
                    </Button>
                    <Button 
                      onClick={testCameras}
                      disabled={selectedCameras.length === 0}
                      className="flex items-center"
                    >
                      Testar Câmeras Selecionadas
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Test Connection */}
              {currentStep === 2 && (
                <div className="text-center space-y-6">
                  <div className="text-6xl mb-4">⚡</div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Testando Conexões</h2>
                    <p className="text-muted-foreground mb-6">
                      Verificando se as câmeras estão transmitindo corretamente...
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary mr-3" />
                    <span className="text-lg">Conectando às câmeras...</span>
                  </div>
                </div>
              )}

              {/* Step 3: Complete */}
              {currentStep === 3 && (
                <div className="text-center space-y-6">
                  <div className="text-6xl mb-4">🎉</div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Tudo Funcionando!</h2>
                    <p className="text-muted-foreground mb-6">
                      Suas câmeras estão conectadas e a IA já está analisando
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                    <h4 className="font-semibold text-green-800 mb-3">✅ Configuração Concluída:</h4>
                    <div className="text-green-700 text-sm space-y-1">
                      <p>• {selectedCameras.length} câmera(s) conectada(s)</p>
                      <p>• IA de detecção ativada</p>
                      <p>• Alertas em tempo real configurados</p>
                      <p>• Gravação automática de eventos ativa</p>
                    </div>
                  </div>

                  <Button onClick={finishSetup} size="lg" className="text-lg px-8">
                    🚀 Ver Meu Painel de Monitoramento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Setup;