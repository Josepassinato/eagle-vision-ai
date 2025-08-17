import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Church, Shield, BarChart3, Settings, Users, Camera, MapPin, AlertTriangle, Eye, Download } from 'lucide-react';
import { ChurchZoneManager } from '@/components/ChurchZoneManager';
import { ChurchEventAnalytics } from '@/components/ChurchEventAnalytics';
import { ChurchPrivacyControls } from '@/components/ChurchPrivacyControls';
import { PastorDashboard } from '@/components/PastorDashboard';
import { useChurchAnalytics } from '@/hooks/useChurchAnalytics';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';

export default function Vision4Church() {
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const { getTodayStats } = useChurchAnalytics(selectedCamera === 'all' ? undefined : selectedCamera);
  const { getPrivacyLevel } = usePrivacyMode();

  const todayStats = getTodayStats();
  const privacyLevel = getPrivacyLevel();

  // Mock cameras data - in real app this would come from a hook
  const cameras = [
    { id: 'cam-entrance', name: 'Entrada Principal', online: true },
    { id: 'cam-altar', name: 'Área do Altar', online: true },
    { id: 'cam-corridor', name: 'Corredor Central', online: false },
    { id: 'cam-exit', name: 'Saída Lateral', online: true }
  ];

  const features = [
    {
      title: 'Edge AI com MediaPipe',
      description: 'Processamento local com YOLO/RT-DETR e MediaPipe Pose para detecção de comportamentos',
      status: 'implemented',
      impact: 'high'
    },
    {
      title: 'Contagem de Pessoas ≥96%',
      description: 'Precisão superior a 96% em contagem por passagem em portas com câmera superior',
      status: 'implemented',
      impact: 'high'
    },
    {
      title: 'Detecção Comportamental',
      description: 'Run, fall, intrusion, loitering, reach-into-bag com confidence e clip_uri',
      status: 'implemented',
      impact: 'medium'
    },
    {
      title: 'Modo No-Bio',
      description: 'Flag global MODE_NO_BIO=true ativa anonimização automática sem biometria',
      status: 'implemented',
      impact: 'high'
    },
    {
      title: 'Google Cloud Integration',
      description: 'Vertex AI Vision, Video Intelligence, Cloud Run, BigQuery, GCS',
      status: 'in-progress',
      impact: 'high'
    },
    {
      title: 'Docker Edge Deployment',
      description: 'Docker-compose otimizado para mini-PC/Jetson com todos os serviços',
      status: 'planned',
      impact: 'medium'
    }
  ];

  const getStatusColor = (status: string) => {
    const colors = {
      implemented: 'bg-success',
      'in-progress': 'bg-warning',
      planned: 'bg-muted'
    };
    return colors[status as keyof typeof colors] || 'bg-muted';
  };

  const getPrivacyLevelColor = () => {
    const colors = {
      low: 'bg-destructive',
      medium: 'bg-warning',
      high: 'bg-success',
      no_bio: 'bg-primary'
    };
    return colors[privacyLevel];
  };

  const getPrivacyLevelLabel = () => {
    const labels = {
      low: 'Baixo',
      medium: 'Médio',
      high: 'Alto',
      no_bio: 'Sem Biometria'
    };
    return labels[privacyLevel];
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Church className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Vision4Church</h1>
            <p className="text-muted-foreground">
              IA Especializada para Ambientes Religiosos - 100% Google Cloud
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge className={getPrivacyLevelColor()}>
            <Shield className="w-3 h-3 mr-1" />
            Privacidade: {getPrivacyLevelLabel()}
          </Badge>
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Câmeras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera.id} value={camera.id}>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${camera.online ? 'bg-success' : 'bg-destructive'}`} />
                    <span>{camera.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Presença Atual</p>
                <p className="text-2xl font-bold">{todayStats.attendance}</p>
                <p className="text-xs text-muted-foreground">Pico: {todayStats.peak}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Camera className="w-8 h-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Câmeras Online</p>
                <p className="text-2xl font-bold">{cameras.filter(c => c.online).length}</p>
                <p className="text-xs text-muted-foreground">de {cameras.length} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-8 h-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Eventos Hoje</p>
                <p className="text-2xl font-bold">{todayStats.safety}</p>
                <p className="text-xs text-muted-foreground">Segurança</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-8 h-8 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Privacidade</p>
                <p className="text-lg font-bold">{getPrivacyLevelLabel()}</p>
                <p className="text-xs text-muted-foreground">Conformidade</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Implementation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5" />
            <span>Status de Implementação Vision4Church</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{feature.title}</h4>
                      <Badge className={getStatusColor(feature.status)}>
                        {feature.status === 'implemented' ? 'Implementado' :
                         feature.status === 'in-progress' ? 'Em Progresso' : 'Planejado'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                    <Badge variant="outline" className="text-xs">
                      {feature.impact === 'high' ? 'Alto Impacto' : 
                       feature.impact === 'medium' ? 'Médio Impacto' : 'Baixo Impacto'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="pastor" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pastor" className="flex items-center space-x-2">
            <Church className="w-4 h-4" />
            <span>Dashboard Pastor</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center space-x-2">
            <BarChart3 className="w-4 h-4" />
            <span>Analytics</span>
          </TabsTrigger>
          <TabsTrigger value="zones" className="flex items-center space-x-2">
            <MapPin className="w-4 h-4" />
            <span>Zonas</span>
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex items-center space-x-2">
            <Shield className="w-4 h-4" />
            <span>Privacidade</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Configurações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pastor">
          <PastorDashboard cameraId={selectedCamera === 'all' ? undefined : selectedCamera} />
        </TabsContent>

        <TabsContent value="analytics">
          <ChurchEventAnalytics cameraId={selectedCamera === 'all' ? undefined : selectedCamera} />
        </TabsContent>

        <TabsContent value="zones">
          {selectedCamera === 'all' ? (
            <Card>
              <CardContent className="p-8 text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Selecione uma Câmera</h3>
                <p className="text-muted-foreground">
                  Para gerenciar zonas, selecione uma câmera específica no menu acima.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ChurchZoneManager cameraId={selectedCamera} />
          )}
        </TabsContent>

        <TabsContent value="privacy">
          <ChurchPrivacyControls />
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Cloud Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Google Cloud Integration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Vertex AI Vision</span>
                    <Badge variant="outline">Configurado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Video Intelligence API</span>
                    <Badge variant="outline">Configurado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cloud Run</span>
                    <Badge className="bg-warning">Pendente</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>BigQuery</span>
                    <Badge className="bg-warning">Pendente</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cloud Storage</span>
                    <Badge variant="outline">Configurado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Looker Studio</span>
                    <Badge className="bg-warning">Pendente</Badge>
                  </div>
                </div>
                <Button className="w-full">
                  Configurar Google Cloud
                </Button>
              </CardContent>
            </Card>

            {/* Edge Deployment */}
            <Card>
              <CardHeader>
                <CardTitle>Edge Deployment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Docker Compose Edge</span>
                    <Badge className="bg-warning">Em Desenvolvimento</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>YOLO/RT-DETR Service</span>
                    <Badge variant="outline">Pronto</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>MediaPipe Pose</span>
                    <Badge variant="outline">Pronto</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Rules Engine</span>
                    <Badge variant="outline">Pronto</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Blur Service</span>
                    <Badge variant="outline">Pronto</Badge>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Download Docker Compose
                </Button>
              </CardContent>
            </Card>

            {/* Camera Profiles */}
            <Card>
              <CardHeader>
                <CardTitle>Perfis de Câmera</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cameras.map((camera) => (
                    <div key={camera.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${camera.online ? 'bg-success' : 'bg-destructive'}`} />
                        <span className="font-medium">{camera.name}</span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button className="w-full" variant="outline">
                  Gerenciar Perfis
                </Button>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card>
              <CardHeader>
                <CardTitle>Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Edge AI Pipeline</span>
                    <Badge className="bg-success">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Database</span>
                    <Badge className="bg-success">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Storage</span>
                    <Badge className="bg-success">Online</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Analytics</span>
                    <Badge className="bg-success">Online</Badge>
                  </div>
                </div>
                <Button className="w-full" variant="outline">
                  Ver Diagnósticos
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}