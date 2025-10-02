import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import RealTimeMetricCard from '@/components/RealTimeMetricCard';
import HeatMapVisualization from '@/components/HeatMapVisualization';
import { useRealTimeAnalytics } from '@/hooks/useRealTimeAnalytics';
import { usePredictiveAnalytics } from '@/hooks/usePredictiveAnalytics';
import { 
  Activity, 
  Cpu, 
  Network, 
  HardDrive, 
  Users, 
  AlertTriangle, 
  Camera, 
  Zap,
  TrendingUp,
  BarChart3,
  MapPin,
  Brain,
  Target,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';

const RealTimeAnalytics = () => {
  const { toast } = useToast();
  const { 
    metrics, 
    isConnected, 
    error, 
    connect, 
    disconnect, 
    getDashboardData 
  } = useRealTimeAnalytics();
  
  const { 
    getPredictions, 
    loading: predictiveLoading 
  } = usePredictiveAnalytics();

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState('1h');
  const [heatMapData, setHeatMapData] = useState<number[][]>([]);
  const [selectedView, setSelectedView] = useState<'overview' | 'predictions' | 'heatmap' | 'behavior'>('overview');

  useEffect(() => {
    loadDashboardData();
  }, [timeframe]);

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await getDashboardData(timeframe);
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    }
  };

  const loadPredictions = async () => {
    try {
      const { predictions } = await getPredictions({
        timeframe: '24h',
        confidence_threshold: 0.7
      });
      setPredictions(predictions);
    } catch (err) {
      console.error('Error loading predictions:', err);
    }
  };


  const handleWebSocketToggle = () => {
    if (isConnected) {
      disconnect();
      toast({
        title: "Disconnected",
        description: "Real-time updates disabled",
      });
    } else {
      connect();
      toast({
        title: "Connecting...",
        description: "Establishing real-time connection",
      });
    }
  };


  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics em Tempo Real</h1>
          <p className="text-muted-foreground">
            Dashboard avançado com métricas em tempo real, análise preditiva e visualizações
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15m">15 min</SelectItem>
              <SelectItem value="1h">1 hora</SelectItem>
              <SelectItem value="6h">6 horas</SelectItem>
              <SelectItem value="24h">24 horas</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleWebSocketToggle}
            variant={isConnected ? "default" : "outline"}
            className="space-x-2"
          >
            <Zap className={`h-4 w-4 ${isConnected ? 'animate-pulse' : ''}`} />
            <span>{isConnected ? 'Conectado' : 'Conectar'}</span>
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      <div className="flex items-center space-x-4">
        <Badge variant={isConnected ? "default" : "secondary"}>
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span>{isConnected ? 'Tempo Real Ativo' : 'Tempo Real Inativo'}</span>
          </div>
        </Badge>
        
        {error && (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Erro de Conexão
          </Badge>
        )}
      </div>

      {/* Main Content */}
      <Tabs value={selectedView} onValueChange={(value: any) => setSelectedView(value)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="predictions" className="space-x-2">
            <Brain className="h-4 w-4" />
            <span>Predições</span>
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="space-x-2">
            <MapPin className="h-4 w-4" />
            <span>Heat Maps</span>
          </TabsTrigger>
          <TabsTrigger value="behavior" className="space-x-2">
            <Target className="h-4 w-4" />
            <span>Comportamento</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Real-Time Metrics Cards */}
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <RealTimeMetricCard
                title="Taxa de Processamento"
                value={metrics.frameProcessingRate}
                unit="FPS"
                trend="up"
                trendValue="+2.3%"
                status="good"
                icon={<Activity className="h-4 w-4" />}
                description="Frames processados por segundo"
              />
              
              <RealTimeMetricCard
                title="Precisão de Detecção"
                value={metrics.detectionAccuracy}
                unit="%"
                trend="stable"
                trendValue="0.1%"
                status="good"
                icon={<Target className="h-4 w-4" />}
                description="Precisão média dos modelos"
              />
              
              <RealTimeMetricCard
                title="Latência de Rede"
                value={metrics.networkLatency}
                unit="ms"
                trend="down"
                trendValue="-1.2ms"
                status={metrics.networkLatency > 100 ? "warning" : "good"}
                icon={<Network className="h-4 w-4" />}
                description="Latência média de comunicação"
              />
              
              <RealTimeMetricCard
                title="Carga do Sistema"
                value={metrics.systemLoad}
                unit="%"
                trend="up"
                trendValue="+3.1%"
                status={metrics.systemLoad > 80 ? "critical" : metrics.systemLoad > 60 ? "warning" : "good"}
                icon={<Cpu className="h-4 w-4" />}
                description="Utilização do sistema"
              />
              
              <RealTimeMetricCard
                title="Streams Ativos"
                value={metrics.activeStreams}
                trend="stable"
                status="good"
                icon={<Camera className="h-4 w-4" />}
                description="Câmeras transmitindo"
              />
              
              <RealTimeMetricCard
                title="Taxa de Erro"
                value={metrics.errorRate}
                unit="%"
                trend="down"
                trendValue="-0.2%"
                status={parseFloat(metrics.errorRate) > 5 ? "warning" : "good"}
                icon={<AlertTriangle className="h-4 w-4" />}
                description="Erros por processamento"
              />
              
              <RealTimeMetricCard
                title="Uso de Armazenamento"
                value={metrics.storageUsage}
                unit="%"
                trend="up"
                trendValue="+1.5%"
                status={metrics.storageUsage > 85 ? "warning" : "good"}
                icon={<HardDrive className="h-4 w-4" />}
                description="Capacidade utilizada"
              />
              
              <RealTimeMetricCard
                title="Pessoas Detectadas"
                value={metrics.peopleDetected}
                trend="up"
                trendValue="+5"
                status="good"
                icon={<Users className="h-4 w-4" />}
                description="Contagem em tempo real"
              />
            </div>
          )}

          {/* Time Series Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Tendências de Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.timeSeries ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dashboardData.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="frameRate" 
                        stroke="#8884d8" 
                        strokeWidth={2}
                        name="Frame Rate (FPS)"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="latency" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Latência (ms)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de séries temporais disponíveis
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Carga do Sistema</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {dashboardData?.timeSeries ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dashboardData.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="systemLoad" 
                        stroke="#ffc658" 
                        fill="#ffc658" 
                        fillOpacity={0.6}
                        name="Carga (%)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados de carga do sistema disponíveis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5" />
                  <span>Predições Ativas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {predictions.length > 0 ? predictions.slice(0, 5).map((prediction, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {prediction.model_type === 'crowd_prediction' ? 'Predição de Multidão' :
                           prediction.model_type === 'incident_prediction' ? 'Predição de Incidente' :
                           'Detecção de Anomalia'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Valor: {prediction.value.toFixed(2)} | Confiança: {(prediction.confidence * 100).toFixed(0)}%
                        </div>
                        {prediction.camera_id && (
                          <div className="text-xs text-muted-foreground">
                            Câmera: {prediction.camera_id}
                          </div>
                        )}
                      </div>
                      <Badge variant={prediction.confidence > 0.8 ? "default" : "secondary"}>
                        {(prediction.confidence * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {predictiveLoading ? 'Carregando predições...' : 'Nenhuma predição disponível'}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Precisão dos Modelos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { model: 'Crowd Prediction', accuracy: 92 },
                    { model: 'Incident Prediction', accuracy: 87 },
                    { model: 'Anomaly Detection', accuracy: 89 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="accuracy" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Heat Map Tab */}
        <TabsContent value="heatmap" className="space-y-6">
          {heatMapData.length > 0 ? (
            <HeatMapVisualization
              data={heatMapData}
              width={600}
              height={400}
              colorScheme="heat"
              hotSpots={[]}
              onZoneSelect={(zone) => {
                toast({
                  title: "Zona Selecionada",
                  description: `Analisando zona: ${zone.x}, ${zone.y} (${zone.width}x${zone.height})`,
                });
              }}
            />
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Sem Dados de Heat Map</h3>
                <p className="text-muted-foreground">
                  Os dados de mapa de calor serão exibidos quando houver atividade nas câmeras
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Behavior Tab */}
        <TabsContent value="behavior" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Padrões de Movimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Fluxo Principal</div>
                      <div className="text-sm text-muted-foreground">Entrada → Área Central</div>
                    </div>
                    <Badge>85% confiança</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">Movimento Circular</div>
                      <div className="text-sm text-muted-foreground">Horário de almoço</div>
                    </div>
                    <Badge variant="secondary">72% confiança</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Análise de Permanência</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tempo médio de permanência:</span>
                    <span className="font-medium">2m 15s</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Zonas de alta permanência:</span>
                    <span className="font-medium">3 identificadas</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Eficiência de fluxo:</span>
                    <span className="font-medium">78%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RealTimeAnalytics;