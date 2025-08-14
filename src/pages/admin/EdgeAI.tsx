import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cpu, HardDrive, Zap, Download, Upload, Settings, Activity } from "lucide-react";

interface EdgeDevice {
  id: string;
  device_name: string;
  device_type: string;
  status: string;
  location: string;
  ip_address: string;
  version: string;
  last_seen: string;
  metadata: any;
}

interface ModelDeployment {
  id: string;
  model_name: string;
  model_version: string;
  quantization: 'INT8' | 'FP16' | 'FP32';
  device_id: string;
  status: 'deploying' | 'active' | 'failed';
  deployment_size_mb: number;
  inference_time_ms: number;
  accuracy_drop: number;
}

export default function EdgeAI() {
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [deployments, setDeployments] = useState<ModelDeployment[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<EdgeDevice | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadEdgeDevices();
    loadModelDeployments();
    
    // Setup realtime updates for edge devices
    const channel = supabase
      .channel('edge_devices_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'edge_devices'
      }, () => {
        loadEdgeDevices();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadEdgeDevices = async () => {
    try {
      const { data, error } = await supabase
        .from('edge_devices')
        .select('*')
        .order('last_seen', { ascending: false });
      
      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error loading edge devices:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dispositivos edge",
        variant: "destructive"
      });
    }
  };

  const loadModelDeployments = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('edge-ai-manager', {
        body: { action: 'get_deployments' }
      });
      
      if (error) throw error;
      setDeployments(data.deployments || []);
    } catch (error) {
      console.error('Error loading deployments:', error);
    }
  };

  const deployModel = async (deviceId: string, modelName: string, quantization: string) => {
    setIsDeploying(true);
    try {
      const { error } = await supabase.functions.invoke('edge-ai-manager', {
        body: { 
          action: 'deploy_model',
          device_id: deviceId,
          model_name: modelName,
          quantization
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Deployment do modelo ${modelName} iniciado em ${deviceId}`
      });
      
      loadModelDeployments();
      
    } catch (error) {
      console.error('Error deploying model:', error);
      toast({
        title: "Erro",
        description: "Falha ao fazer deploy do modelo",
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const optimizeModel = async (modelName: string, targetDevice: string) => {
    try {
      const { error } = await supabase.functions.invoke('edge-ai-manager', {
        body: { 
          action: 'optimize_model',
          model_name: modelName,
          target_device: targetDevice
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Otimização do modelo iniciada"
      });
      
    } catch (error) {
      console.error('Error optimizing model:', error);
      toast({
        title: "Erro",
        description: "Falha ao otimizar modelo",
        variant: "destructive"
      });
    }
  };

  const getDeviceStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      case 'deploying': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Edge AI Deployment – IA Avançada | Painel</title>
        <meta name="description" content="Gerenciamento de deployment de modelos IA em dispositivos edge" />
        <link rel="canonical" href="/app/edge-ai" />
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edge AI Deployment</h1>
          <p className="text-muted-foreground">Deploy e gerenciamento de modelos IA em dispositivos edge</p>
        </div>
        <Button onClick={() => optimizeModel('yolo-v8', 'jetson-nano')} className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Otimizar Modelos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Dispositivos Online</p>
                <p className="text-2xl font-bold">{devices.filter(d => d.status === 'online').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Modelos Deployados</p>
                <p className="text-2xl font-bold">{deployments.filter(d => d.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Inferência Média</p>
                <p className="text-2xl font-bold">
                  {deployments.length > 0 
                    ? `${Math.round(deployments.reduce((acc, d) => acc + d.inference_time_ms, 0) / deployments.length)}ms`
                    : '--'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Uso de Storage</p>
                <p className="text-2xl font-bold">
                  {deployments.length > 0 
                    ? `${Math.round(deployments.reduce((acc, d) => acc + d.deployment_size_mb, 0) / 1024)}GB`
                    : '--'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Dispositivos Edge</TabsTrigger>
          <TabsTrigger value="deployments">Model Deployments</TabsTrigger>
          <TabsTrigger value="optimization">Otimização & Quantização</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dispositivos Edge Conectados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((device) => (
                  <Card key={device.id} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedDevice(device)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-medium">{device.device_name}</h4>
                          <p className="text-sm text-muted-foreground">{device.location}</p>
                        </div>
                        <Badge variant={device.status === 'online' ? 'default' : 'destructive'}>
                          {device.status}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Tipo:</span>
                          <span className="font-medium">{device.device_type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IP:</span>
                          <span className="font-mono">{device.ip_address}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Versão:</span>
                          <span>{device.version}</span>
                        </div>
                      </div>
                      
                      {device.metadata && (
                        <div className="mt-3 space-y-1">
                          {device.metadata.cpu_usage && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>CPU</span>
                                <span>{device.metadata.cpu_usage}%</span>
                              </div>
                              <Progress value={device.metadata.cpu_usage} className="h-1" />
                            </div>
                          )}
                          {device.metadata.memory_usage && (
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span>Memória</span>
                                <span>{device.metadata.memory_usage}%</span>
                              </div>
                              <Progress value={device.metadata.memory_usage} className="h-1" />
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedDevice && (
            <Card>
              <CardHeader>
                <CardTitle>Detalhes do Dispositivo: {selectedDevice.device_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Informações do Hardware</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Localização:</span>
                        <span>{selectedDevice.location}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Endereço IP:</span>
                        <span className="font-mono">{selectedDevice.ip_address}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Última Conexão:</span>
                        <span>{new Date(selectedDevice.last_seen).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Deploy de Modelo</h4>
                    <div className="space-y-3">
                      <select className="w-full p-2 border rounded">
                        <option>YOLO v8 - Detecção de Pessoas</option>
                        <option>SafetyVision - Análise de EPI</option>
                        <option>EduBehavior - Análise Comportamental</option>
                      </select>
                      <select className="w-full p-2 border rounded">
                        <option value="INT8">INT8 (Rápido, menor precisão)</option>
                        <option value="FP16">FP16 (Balanceado)</option>
                        <option value="FP32">FP32 (Melhor precisão)</option>
                      </select>
                      <Button 
                        className="w-full"
                        disabled={isDeploying || selectedDevice.status !== 'online'}
                        onClick={() => deployModel(selectedDevice.id, 'yolo-v8', 'INT8')}
                      >
                        {isDeploying ? 'Deployando...' : 'Deploy Modelo'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployments Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployments.map((deployment) => (
                  <div key={deployment.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">{deployment.model_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Versão {deployment.model_version} • {deployment.quantization}
                        </p>
                      </div>
                      <Badge variant={deployment.status === 'active' ? 'default' : 'destructive'}>
                        {deployment.status}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Dispositivo</p>
                        <p className="font-medium">{deployment.device_id}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Tamanho</p>
                        <p className="font-medium">{deployment.deployment_size_mb}MB</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Inferência</p>
                        <p className="font-medium">{deployment.inference_time_ms}ms</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Queda de Precisão</p>
                        <p className="font-medium">{deployment.accuracy_drop.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Otimização de Modelos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">Técnicas de Quantização</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded p-4">
                      <h5 className="font-medium mb-2">INT8</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Tamanho:</span>
                          <span className="text-green-600">75% menor</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Velocidade:</span>
                          <span className="text-green-600">3x mais rápido</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Precisão:</span>
                          <span className="text-yellow-600">-2% a -5%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded p-4">
                      <h5 className="font-medium mb-2">FP16</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Tamanho:</span>
                          <span className="text-green-600">50% menor</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Velocidade:</span>
                          <span className="text-green-600">2x mais rápido</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Precisão:</span>
                          <span className="text-green-600">-0.5% a -1%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded p-4">
                      <h5 className="font-medium mb-2">FP32</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Tamanho:</span>
                          <span>Padrão</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Velocidade:</span>
                          <span>Padrão</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Precisão:</span>
                          <span className="text-green-600">Máxima</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-4">Suporte a Hardware</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded p-4">
                      <h5 className="font-medium mb-3">NVIDIA Jetson Nano</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>TensorRT otimizado</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>INT8 nativo</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span>GPU limitada</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded p-4">
                      <h5 className="font-medium mb-3">NVIDIA Jetson Xavier</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>TensorRT avançado</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Multi-stream</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span>Deep Learning acelerado</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monitoramento em Tempo Real</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Performance por Dispositivo</h4>
                    <div className="space-y-3">
                      {devices.filter(d => d.status === 'online').map((device) => (
                        <div key={device.id} className="border rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{device.device_name}</span>
                            <Badge variant="secondary">{device.device_type}</Badge>
                          </div>
                          
                          {device.metadata && (
                            <div className="space-y-2">
                              {device.metadata.cpu_usage && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>CPU</span>
                                    <span>{device.metadata.cpu_usage}%</span>
                                  </div>
                                  <Progress value={device.metadata.cpu_usage} />
                                </div>
                              )}
                              
                              {device.metadata.gpu_usage && (
                                <div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span>GPU</span>
                                    <span>{device.metadata.gpu_usage}%</span>
                                  </div>
                                  <Progress value={device.metadata.gpu_usage} />
                                </div>
                              )}
                              
                              {device.metadata.temperature && (
                                <div className="text-sm">
                                  <span>Temperatura: </span>
                                  <span className={device.metadata.temperature > 70 ? 'text-red-500' : 'text-green-500'}>
                                    {device.metadata.temperature}°C
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Métricas de Inferência</h4>
                    <div className="space-y-4">
                      <div className="border rounded p-3">
                        <h5 className="font-medium mb-2">Latência Média</h5>
                        <div className="text-2xl font-bold text-blue-600">45ms</div>
                        <div className="text-sm text-muted-foreground">Última hora</div>
                      </div>
                      
                      <div className="border rounded p-3">
                        <h5 className="font-medium mb-2">Throughput</h5>
                        <div className="text-2xl font-bold text-green-600">22 FPS</div>
                        <div className="text-sm text-muted-foreground">Média por dispositivo</div>
                      </div>
                      
                      <div className="border rounded p-3">
                        <h5 className="font-medium mb-2">Precisão Aggregate</h5>
                        <div className="text-2xl font-bold text-purple-600">94.2%</div>
                        <div className="text-sm text-muted-foreground">Todos os modelos</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}