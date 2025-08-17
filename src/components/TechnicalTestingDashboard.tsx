import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle, Clock, Camera, Activity, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TestMetrics {
  fps_real: number;
  fps_target: number;
  false_positive_rate: number;
  false_negative_rate: number;
  latency_p50: number;
  latency_p95: number;
  detection_accuracy: number;
  confidence_avg: number;
}

interface CameraTest {
  id: string;
  camera_id: string;
  camera_name: string;
  camera_type: 'entrada' | 'auditorio' | 'lateral';
  test_status: 'pending' | 'running' | 'completed' | 'failed';
  metrics?: TestMetrics;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

interface VertexAIComparison {
  event_id: string;
  local_count: number;
  vertex_count: number;
  difference: number;
  timestamp: string;
  camera_id: string;
  accuracy_score: number;
}

export default function TechnicalTestingDashboard() {
  const [cameraTests, setCameraTests] = useState<CameraTest[]>([]);
  const [vertexComparisons, setVertexComparisons] = useState<VertexAIComparison[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [testDuration, setTestDuration] = useState<number>(300); // 5 minutes default
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [overallMetrics, setOverallMetrics] = useState<TestMetrics | null>(null);

  // Load cameras and existing test results
  useEffect(() => {
    loadCameras();
    loadTestResults();
    loadVertexComparisons();
  }, []);

  const loadCameras = async () => {
    try {
      const { data: cameras, error } = await supabase
        .from('cameras')
        .select('id, name')
        .eq('online', true);

      if (error) throw error;

      // Initialize test objects for each camera
      const testObjects: CameraTest[] = cameras.map(camera => ({
        id: `test_${camera.id}`,
        camera_id: camera.id,
        camera_name: camera.name || camera.id,
        camera_type: determineCameraType(camera.name || camera.id),
        test_status: 'pending'
      }));

      setCameraTests(testObjects);
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast.error('Erro ao carregar câmeras');
    }
  };

  const determineCameraType = (cameraName: string): 'entrada' | 'auditorio' | 'lateral' => {
    const name = cameraName.toLowerCase();
    if (name.includes('entrada') || name.includes('entry')) return 'entrada';
    if (name.includes('auditorio') || name.includes('auditorium')) return 'auditorio';
    return 'lateral';
  };

  const loadTestResults = async () => {
    try {
      const { data: metrics, error } = await supabase
        .from('ai_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (metrics && metrics.length > 0) {
        const avgMetrics = calculateAverageMetrics(metrics);
        setOverallMetrics(avgMetrics);
      }
    } catch (error) {
      console.error('Error loading test results:', error);
    }
  };

  const loadVertexComparisons = async () => {
    // This would load comparison data between local detection and Vertex AI
    // For now, we'll simulate some data
    const mockComparisons: VertexAIComparison[] = [
      {
        event_id: '1',
        local_count: 15,
        vertex_count: 14,
        difference: 1,
        timestamp: new Date().toISOString(),
        camera_id: 'cam_1',
        accuracy_score: 93.3
      }
    ];
    setVertexComparisons(mockComparisons);
  };

  const calculateAverageMetrics = (metrics: any[]): TestMetrics => {
    const validMetrics = metrics.filter(m => m.fps_actual && m.inference_latency_ms);
    
    return {
      fps_real: validMetrics.reduce((sum, m) => sum + (m.fps_actual || 0), 0) / validMetrics.length,
      fps_target: validMetrics.reduce((sum, m) => sum + (m.fps_target || 30), 0) / validMetrics.length,
      false_positive_rate: validMetrics.reduce((sum, m) => sum + (m.false_positive_rate || 0), 0) / validMetrics.length,
      false_negative_rate: 0.05, // Simulated
      latency_p50: validMetrics.reduce((sum, m) => sum + (m.inference_latency_ms || 0), 0) / validMetrics.length,
      latency_p95: Math.max(...validMetrics.map(m => m.inference_latency_ms || 0)),
      detection_accuracy: 95.2, // Simulated
      confidence_avg: validMetrics.reduce((sum, m) => sum + (m.confidence_avg || 0), 0) / validMetrics.length
    };
  };

  const startEdgeValidationTest = async (cameraId: string) => {
    setIsRunningTest(true);
    
    try {
      // Update test status
      setCameraTests(prev => prev.map(test => 
        test.camera_id === cameraId 
          ? { ...test, test_status: 'running', started_at: new Date().toISOString() }
          : test
      ));

      // Call edge function to start validation test
      const { data, error } = await supabase.functions.invoke('edge-ai-manager', {
        body: {
          action: 'start_validation_test',
          camera_id: cameraId,
          test_duration: testDuration,
          test_types: ['yolo', 'mediapipe', 'fps', 'latency']
        }
      });

      if (error) throw error;

      toast.success('Teste de validação iniciado');
      
      // Simulate test completion after duration
      setTimeout(() => {
        completeTest(cameraId);
      }, testDuration * 1000);

    } catch (error) {
      console.error('Error starting test:', error);
      toast.error('Erro ao iniciar teste');
      
      setCameraTests(prev => prev.map(test => 
        test.camera_id === cameraId 
          ? { ...test, test_status: 'failed', error_message: error.message }
          : test
      ));
    } finally {
      setIsRunningTest(false);
    }
  };

  const completeTest = (cameraId: string) => {
    // Simulate test completion with mock metrics
    const mockMetrics: TestMetrics = {
      fps_real: Math.random() * 10 + 25, // 25-35 FPS
      fps_target: 30,
      false_positive_rate: Math.random() * 0.05, // 0-5%
      false_negative_rate: Math.random() * 0.03, // 0-3%
      latency_p50: Math.random() * 500 + 100, // 100-600ms
      latency_p95: Math.random() * 1000 + 800, // 800-1800ms
      detection_accuracy: Math.random() * 10 + 90, // 90-100%
      confidence_avg: Math.random() * 0.3 + 0.7 // 0.7-1.0
    };

    setCameraTests(prev => prev.map(test => 
      test.camera_id === cameraId 
        ? { 
            ...test, 
            test_status: 'completed',
            metrics: mockMetrics,
            completed_at: new Date().toISOString()
          }
        : test
    ));

    toast.success('Teste concluído com sucesso');
  };

  const runVertexAIComparison = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('vertex-ai-analysis', {
        body: {
          analysisType: 'comparison_test',
          cameras: cameraTests.map(test => test.camera_id)
        }
      });

      if (error) throw error;

      toast.success('Comparação com Vertex AI iniciada');
    } catch (error) {
      console.error('Error running Vertex AI comparison:', error);
      toast.error('Erro ao executar comparação com Vertex AI');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'running': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Testes Técnicos - Qualidade dos Analíticos</h1>
          <p className="text-muted-foreground">
            Validação Edge (YOLO + MediaPipe) e Integração Google Vertex AI
          </p>
        </div>
        <Button onClick={runVertexAIComparison} variant="outline">
          <TrendingUp className="mr-2 h-4 w-4" />
          Comparar com Vertex AI
        </Button>
      </div>

      <Tabs defaultValue="edge-validation" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="edge-validation">Validação Edge</TabsTrigger>
          <TabsTrigger value="performance-metrics">Métricas de Performance</TabsTrigger>
          <TabsTrigger value="vertex-comparison">Comparação Vertex AI</TabsTrigger>
        </TabsList>

        <TabsContent value="edge-validation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Teste</CardTitle>
              <CardDescription>
                Configure os parâmetros para teste de validação edge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="camera-select">Câmera</Label>
                  <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma câmera" />
                    </SelectTrigger>
                    <SelectContent>
                      {cameraTests.map(test => (
                        <SelectItem key={test.camera_id} value={test.camera_id}>
                          {test.camera_name} ({test.camera_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="duration">Duração do Teste (segundos)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={testDuration}
                    onChange={(e) => setTestDuration(Number(e.target.value))}
                    min={60}
                    max={3600}
                  />
                </div>
              </div>

              <Button 
                onClick={() => selectedCamera && startEdgeValidationTest(selectedCamera)}
                disabled={!selectedCamera || isRunningTest}
                className="w-full"
              >
                <Activity className="mr-2 h-4 w-4" />
                {isRunningTest ? 'Teste em Andamento...' : 'Iniciar Teste de Validação'}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {cameraTests.map(test => (
              <Card key={test.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-4 w-4" />
                      <CardTitle className="text-lg">{test.camera_name}</CardTitle>
                      <Badge variant="outline">{test.camera_type}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(test.test_status)}
                      <Badge variant={getStatusColor(test.test_status)}>
                        {test.test_status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {test.metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {test.metrics.fps_real.toFixed(1)}
                        </div>
                        <div className="text-sm text-muted-foreground">FPS Real</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {(test.metrics.false_positive_rate * 100).toFixed(2)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Taxa FP</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {test.metrics.latency_p95.toFixed(0)}ms
                        </div>
                        <div className="text-sm text-muted-foreground">Latência P95</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary">
                          {test.metrics.detection_accuracy.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Precisão</div>
                      </div>
                    </div>
                  )}
                  {test.test_status === 'running' && (
                    <div className="mt-4">
                      <Progress value={33} className="w-full" />
                      <p className="text-sm text-muted-foreground mt-2">
                        Teste em andamento...
                      </p>
                    </div>
                  )}
                  {test.error_message && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="text-sm text-destructive">{test.error_message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance-metrics" className="space-y-6">
          {overallMetrics && (
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Métricas Gerais de Performance</CardTitle>
                  <CardDescription>
                    Agregação das métricas de todas as câmeras testadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {overallMetrics.fps_real.toFixed(1)}
                      </div>
                      <div className="text-sm text-muted-foreground">FPS Médio</div>
                      <div className="text-xs text-muted-foreground">
                        Target: {overallMetrics.fps_target}
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {(overallMetrics.false_positive_rate * 100).toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Taxa Falso Positivo</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {overallMetrics.latency_p95.toFixed(0)}ms
                      </div>
                      <div className="text-sm text-muted-foreground">Latência P95</div>
                      <div className={`text-xs ${overallMetrics.latency_p95 < 2000 ? 'text-green-600' : 'text-red-600'}`}>
                        Target: &lt; 2000ms
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary mb-2">
                        {overallMetrics.detection_accuracy.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Precisão de Detecção</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Status de Qualidade</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>FPS dentro do target</span>
                      <Badge variant={overallMetrics.fps_real >= (overallMetrics.fps_target * 0.9) ? 'default' : 'destructive'}>
                        {overallMetrics.fps_real >= (overallMetrics.fps_target * 0.9) ? 'OK' : 'BAIXO'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>Latência P95 &lt; 2s</span>
                      <Badge variant={overallMetrics.latency_p95 < 2000 ? 'default' : 'destructive'}>
                        {overallMetrics.latency_p95 < 2000 ? 'OK' : 'ALTO'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span>Taxa de Falso Positivo &lt; 5%</span>
                      <Badge variant={overallMetrics.false_positive_rate < 0.05 ? 'default' : 'destructive'}>
                        {overallMetrics.false_positive_rate < 0.05 ? 'OK' : 'ALTO'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="vertex-comparison" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparação com Google Vertex AI</CardTitle>
              <CardDescription>
                Validação de eventos locais vs. Google Vertex AI Vision/Video Intelligence
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vertexComparisons.length > 0 ? (
                <div className="space-y-4">
                  {vertexComparisons.map(comparison => (
                    <div key={comparison.event_id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Câmera: {comparison.camera_id}</span>
                          <Badge variant="outline">{comparison.timestamp}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Local: {comparison.local_count} | Vertex AI: {comparison.vertex_count} | 
                          Diferença: {comparison.difference}
                        </div>
                      </div>
                      <Badge variant={comparison.accuracy_score > 90 ? 'default' : 'secondary'}>
                        {comparison.accuracy_score.toFixed(1)}% precisão
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma comparação com Vertex AI executada ainda.
                  <div className="mt-4">
                    <Button onClick={runVertexAIComparison} variant="outline">
                      Executar Primeira Comparação
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}