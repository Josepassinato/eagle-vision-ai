import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Zap, 
  Cpu, 
  BarChart3, 
  Settings, 
  CheckCircle, 
  Loader2,
  TrendingUp,
  Clock,
  Gauge
} from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface TensorRTConfig {
  precision: 'FP32' | 'FP16' | 'INT8';
  workspace_size: number;
  batch_size: number;
  max_batch_size: number;
  optimization_level: 1 | 2 | 3 | 4 | 5;
}

interface PerformanceMetrics {
  model: string;
  original_fps: number;
  optimized_fps: number;
  speedup: number;
  memory_usage: number;
  accuracy_retention: number;
  inference_time_ms: number;
}

interface OptimizationJob {
  id: string;
  model_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  config: TensorRTConfig;
  metrics?: PerformanceMetrics;
  error_message?: string;
  started_at: Date;
  completed_at?: Date;
}

const TensorRTOptimizer: React.FC = () => {
  const [optimizationJobs, setOptimizationJobs] = useState<OptimizationJob[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [tensorrtConfig, setTensorRTConfig] = useState<TensorRTConfig>({
    precision: 'FP16',
    workspace_size: 1024,
    batch_size: 1,
    max_batch_size: 8,
    optimization_level: 3
  });
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [performanceHistory, setPerformanceHistory] = useState<PerformanceMetrics[]>([]);

  const availableModels = [
    { id: 'yolov8n', name: 'YOLOv8 Nano', size: '6.2MB', type: 'Detection' },
    { id: 'yolov8s', name: 'YOLOv8 Small', size: '21.5MB', type: 'Detection' },
    { id: 'yolov8m', name: 'YOLOv8 Medium', size: '49.7MB', type: 'Detection' },
    { id: 'yolov8l', name: 'YOLOv8 Large', size: '83.7MB', type: 'Detection' },
    { id: 'yolov8x', name: 'YOLOv8 XLarge', size: '136.7MB', type: 'Detection' }
  ];

  const handleOptimization = useCallback(async () => {
    if (!selectedModel) {
      toast.error('Selecione um modelo para otimizar');
      return;
    }

    setIsOptimizing(true);
    const jobId = crypto.randomUUID();
    
    const newJob: OptimizationJob = {
      id: jobId,
      model_name: selectedModel,
      status: 'pending',
      progress: 0,
      config: tensorrtConfig,
      started_at: new Date()
    };

    setOptimizationJobs(prev => [newJob, ...prev]);

    try {
      // Start optimization via Supabase Edge Function
      const { data, error } = await supabase.functions.invoke('tensorrt-optimizer', {
        body: {
          job_id: jobId,
          model_name: selectedModel,
          config: tensorrtConfig
        }
      });

      if (error) throw error;

      // Simulate progress updates
      for (let progress = 10; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setOptimizationJobs(prev => 
          prev.map(job => 
            job.id === jobId 
              ? { ...job, status: 'running', progress }
              : job
          )
        );
      }

      // Use real metrics from optimization
      const realMetrics: PerformanceMetrics = {
        model: selectedModel,
        original_fps: data.metrics.original_fps,
        optimized_fps: data.metrics.optimized_fps,
        speedup: data.metrics.speedup,
        memory_usage: data.metrics.memory_usage,
        accuracy_retention: data.metrics.accuracy_retention,
        inference_time_ms: data.metrics.inference_time_ms
      };

      setOptimizationJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: 'completed', 
                progress: 100,
                metrics: realMetrics,
                completed_at: new Date()
              }
            : job
        )
      );

      setPerformanceHistory(prev => [...prev, realMetrics]);
      toast.success(`Modelo ${selectedModel} otimizado com ${realMetrics.speedup.toFixed(1)}x speedup!`);

    } catch (error) {
      setOptimizationJobs(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: 'failed', 
                error_message: 'Erro na otimização TensorRT'
              }
            : job
        )
      );
      toast.error('Erro na otimização TensorRT');
    } finally {
      setIsOptimizing(false);
    }
  }, [selectedModel, tensorrtConfig]);

  const getSpeedupColor = (speedup: number) => {
    if (speedup >= 2.5) return 'text-green-600';
    if (speedup >= 1.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">TensorRT Optimizer</h2>
        <p className="text-muted-foreground">
          Otimize modelos YOLO usando TensorRT para acelerar a inferência em GPUs NVIDIA
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Otimização
            </CardTitle>
            <CardDescription>
              Configure os parâmetros para otimização TensorRT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Modelo YOLO</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{model.name}</span>
                        <Badge variant="outline" className="ml-2">{model.size}</Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Precisão</label>
              <Select 
                value={tensorrtConfig.precision} 
                onValueChange={(value: TensorRTConfig['precision']) => 
                  setTensorRTConfig(prev => ({ ...prev, precision: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FP32">FP32 (Máxima precisão)</SelectItem>
                  <SelectItem value="FP16">FP16 (Equilibrio)</SelectItem>
                  <SelectItem value="INT8">INT8 (Máxima velocidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Batch Size</label>
                <Select 
                  value={tensorrtConfig.batch_size.toString()} 
                  onValueChange={(value) => 
                    setTensorRTConfig(prev => ({ ...prev, batch_size: parseInt(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Nível de Otimização</label>
                <Select 
                  value={tensorrtConfig.optimization_level.toString()} 
                  onValueChange={(value) => 
                    setTensorRTConfig(prev => ({ ...prev, optimization_level: parseInt(value) as TensorRTConfig['optimization_level'] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Básico)</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3 (Padrão)</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="5">5 (Máximo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleOptimization}
              disabled={isOptimizing || !selectedModel}
              className="w-full"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Otimizando...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Iniciar Otimização
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Métricas de Performance
            </CardTitle>
            <CardDescription>
              Comparativo de performance antes e depois da otimização
            </CardDescription>
          </CardHeader>
          <CardContent>
            {performanceHistory.length > 0 ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceHistory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="model" />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="original_fps" 
                      stroke="#ef4444" 
                      name="Original FPS"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="optimized_fps" 
                      stroke="#22c55e" 
                      name="Otimizado FPS"
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="grid grid-cols-3 gap-4">
                  {performanceHistory.slice(-1).map((metrics, index) => (
                    <React.Fragment key={index}>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {metrics.speedup.toFixed(1)}x
                        </div>
                        <div className="text-sm text-muted-foreground">Speedup</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {metrics.optimized_fps}
                        </div>
                        <div className="text-sm text-muted-foreground">FPS</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          {(metrics.accuracy_retention * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Precisão</div>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Gauge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                Nenhuma métrica disponível. Execute uma otimização para ver os resultados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Optimization Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Trabalhos de Otimização
          </CardTitle>
          <CardDescription>
            Histórico e status dos trabalhos de otimização TensorRT
          </CardDescription>
        </CardHeader>
        <CardContent>
          {optimizationJobs.length > 0 ? (
            <div className="space-y-4">
              {optimizationJobs.map(job => (
                <Card key={job.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-medium">{job.model_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {job.config.precision} • Batch {job.config.batch_size} • Level {job.config.optimization_level}
                      </div>
                    </div>
                    <Badge 
                      variant={
                        job.status === 'completed' ? 'default' :
                        job.status === 'failed' ? 'destructive' :
                        job.status === 'running' ? 'secondary' : 'outline'
                      }
                    >
                      {job.status === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {job.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {job.status}
                    </Badge>
                  </div>

                  {job.status === 'running' && (
                    <Progress value={job.progress} className="mb-2" />
                  )}

                  {job.metrics && (
                    <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t">
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getSpeedupColor(job.metrics.speedup)}`}>
                          {job.metrics.speedup.toFixed(1)}x
                        </div>
                        <div className="text-xs text-muted-foreground">Speedup</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {job.metrics.optimized_fps}fps
                        </div>
                        <div className="text-xs text-muted-foreground">Performance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {job.metrics.inference_time_ms}ms
                        </div>
                        <div className="text-xs text-muted-foreground">Latência</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold">
                          {(job.metrics.accuracy_retention * 100).toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Precisão</div>
                      </div>
                    </div>
                  )}

                  {job.error_message && (
                    <Alert className="mt-2">
                      <AlertDescription>{job.error_message}</AlertDescription>
                    </Alert>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Nenhum trabalho de otimização executado ainda.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TensorRTOptimizer;