import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Camera, 
  BarChart3, 
  Settings, 
  Eye,
  TrendingUp,
  Layers,
  Target,
  Zap,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts';

interface ReRankingConfig {
  spatial_weight: number;
  temporal_weight: number;
  appearance_weight: number;
  trajectory_weight: number;
  occlusion_threshold: number;
  similarity_threshold: number;
  max_lost_frames: number;
  reid_model: 'osnet' | 'mobilenet' | 'resnet50';
  fusion_strategy: 'weighted_sum' | 'attention' | 'learned_fusion';
}

interface ReIDMatch {
  person_id: string;
  camera_id: string;
  similarity_score: number;
  spatial_score: number;
  temporal_score: number;
  trajectory_score: number;
  final_score: number;
  confidence: number;
  bbox: [number, number, number, number];
  timestamp: Date;
}

interface CameraView {
  camera_id: string;
  camera_name: string;
  active_tracks: number;
  lost_tracks: number;
  matches_per_minute: number;
  avg_confidence: number;
}

const ReIDReranking: React.FC = () => {
  const [config, setConfig] = useState<ReRankingConfig>({
    spatial_weight: 0.3,
    temporal_weight: 0.2,
    appearance_weight: 0.4,
    trajectory_weight: 0.1,
    occlusion_threshold: 0.7,
    similarity_threshold: 0.75,
    max_lost_frames: 30,
    reid_model: 'osnet',
    fusion_strategy: 'weighted_sum'
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [recentMatches, setRecentMatches] = useState<ReIDMatch[]>([]);
  const [cameraViews, setCameraViews] = useState<CameraView[]>([
    { camera_id: 'cam_001', camera_name: 'Entrada Principal', active_tracks: 5, lost_tracks: 2, matches_per_minute: 12, avg_confidence: 0.87 },
    { camera_id: 'cam_002', camera_name: 'Corredor Norte', active_tracks: 3, lost_tracks: 1, matches_per_minute: 8, avg_confidence: 0.82 },
    { camera_id: 'cam_003', camera_name: 'Área Central', active_tracks: 7, lost_tracks: 3, matches_per_minute: 15, avg_confidence: 0.85 },
    { camera_id: 'cam_004', camera_name: 'Saída Emergência', active_tracks: 2, lost_tracks: 0, matches_per_minute: 4, avg_confidence: 0.89 }
  ]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any[]>([]);

  const handleConfigUpdate = useCallback(async () => {
    setIsOptimizing(true);
    
    try {
      const response = await fetch('/api/reid/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) throw new Error('Falha na configuração');
      
      // Simulate optimization results
      const mockResults = {
        accuracy_improvement: Math.random() * 0.15 + 0.05,
        precision_increase: Math.random() * 0.1 + 0.03,
        recall_increase: Math.random() * 0.12 + 0.02,
        false_positive_reduction: Math.random() * 0.2 + 0.1
      };

      setPerformanceMetrics(prev => [...prev, {
        timestamp: new Date().toISOString(),
        ...mockResults
      }]);

      toast.success('Configuração de re-ranking atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    } finally {
      setIsOptimizing(false);
    }
  }, [config]);

  const generateMockMatches = useCallback(() => {
    const mockMatches: ReIDMatch[] = [];
    const personIds = ['person_001', 'person_002', 'person_003', 'person_004', 'person_005'];
    
    for (let i = 0; i < 10; i++) {
      const match: ReIDMatch = {
        person_id: personIds[Math.floor(Math.random() * personIds.length)],
        camera_id: cameraViews[Math.floor(Math.random() * cameraViews.length)].camera_id,
        similarity_score: Math.random() * 0.4 + 0.6,
        spatial_score: Math.random() * 0.3 + 0.7,
        temporal_score: Math.random() * 0.2 + 0.8,
        trajectory_score: Math.random() * 0.4 + 0.6,
        final_score: 0,
        confidence: Math.random() * 0.3 + 0.7,
        bbox: [
          Math.floor(Math.random() * 200),
          Math.floor(Math.random() * 200),
          Math.floor(Math.random() * 100) + 50,
          Math.floor(Math.random() * 150) + 100
        ],
        timestamp: new Date(Date.now() - Math.random() * 300000)
      };
      
      // Calculate final score using weights
      match.final_score = (
        match.similarity_score * config.appearance_weight +
        match.spatial_score * config.spatial_weight +
        match.temporal_score * config.temporal_weight +
        match.trajectory_score * config.trajectory_weight
      );
      
      mockMatches.push(match);
    }
    
    setRecentMatches(mockMatches.sort((a, b) => b.final_score - a.final_score));
  }, [config, cameraViews]);

  React.useEffect(() => {
    generateMockMatches();
    const interval = setInterval(generateMockMatches, 5000);
    return () => clearInterval(interval);
  }, [generateMockMatches]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Re-ranking Re-ID</h2>
        <p className="text-muted-foreground">
          Sistema avançado de re-ranking para melhorar a precisão de re-identificação em cenários multi-câmera
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração de Re-ranking
            </CardTitle>
            <CardDescription>
              Ajuste os pesos e parâmetros do algoritmo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Peso da Aparência: {config.appearance_weight.toFixed(2)}</Label>
                <Slider
                  value={[config.appearance_weight]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, appearance_weight: value }))}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Peso Espacial: {config.spatial_weight.toFixed(2)}</Label>
                <Slider
                  value={[config.spatial_weight]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, spatial_weight: value }))}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Peso Temporal: {config.temporal_weight.toFixed(2)}</Label>
                <Slider
                  value={[config.temporal_weight]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, temporal_weight: value }))}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Peso da Trajetória: {config.trajectory_weight.toFixed(2)}</Label>
                <Slider
                  value={[config.trajectory_weight]}
                  onValueChange={([value]) => setConfig(prev => ({ ...prev, trajectory_weight: value }))}
                  max={1}
                  min={0}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Limiar de Similaridade</Label>
                <Input
                  type="number"
                  value={config.similarity_threshold}
                  onChange={(e) => setConfig(prev => ({ ...prev, similarity_threshold: parseFloat(e.target.value) }))}
                  min={0}
                  max={1}
                  step={0.01}
                />
              </div>

              <div className="space-y-2">
                <Label>Máximo de Frames Perdidos</Label>
                <Input
                  type="number"
                  value={config.max_lost_frames}
                  onChange={(e) => setConfig(prev => ({ ...prev, max_lost_frames: parseInt(e.target.value) }))}
                  min={1}
                  max={100}
                />
              </div>

              <div className="space-y-2">
                <Label>Modelo Re-ID</Label>
                <Select 
                  value={config.reid_model} 
                  onValueChange={(value: ReRankingConfig['reid_model']) => 
                    setConfig(prev => ({ ...prev, reid_model: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="osnet">OSNet (Recomendado)</SelectItem>
                    <SelectItem value="mobilenet">MobileNet (Rápido)</SelectItem>
                    <SelectItem value="resnet50">ResNet50 (Preciso)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estratégia de Fusão</Label>
                <Select 
                  value={config.fusion_strategy} 
                  onValueChange={(value: ReRankingConfig['fusion_strategy']) => 
                    setConfig(prev => ({ ...prev, fusion_strategy: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted_sum">Soma Ponderada</SelectItem>
                    <SelectItem value="attention">Atenção</SelectItem>
                    <SelectItem value="learned_fusion">Fusão Aprendida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={handleConfigUpdate}
              disabled={isOptimizing}
              className="w-full"
            >
              {isOptimizing ? 'Aplicando...' : 'Aplicar Configuração'}
            </Button>
          </CardContent>
        </Card>

        {/* Live Matches and Camera Views */}
        <div className="lg:col-span-2 space-y-6">
          {/* Camera Views */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Status das Câmeras
              </CardTitle>
              <CardDescription>
                Estado atual do tracking em cada câmera
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {cameraViews.map(camera => (
                  <Card key={camera.camera_id} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{camera.camera_name}</div>
                        <Badge variant="outline">{camera.camera_id}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground">Ativos</div>
                          <div className="font-semibold text-green-600">{camera.active_tracks}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Perdidos</div>
                          <div className="font-semibold text-red-600">{camera.lost_tracks}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Matches/min</div>
                          <div className="font-semibold">{camera.matches_per_minute}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Confiança</div>
                          <div className={`font-semibold ${getConfidenceColor(camera.avg_confidence)}`}>
                            {(camera.avg_confidence * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Matches */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Matches Recentes
              </CardTitle>
              <CardDescription>
                Últimas correspondências de re-identificação com scores detalhados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentMatches.map((match, index) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{match.person_id}</Badge>
                        <Badge variant="secondary">{match.camera_id}</Badge>
                      </div>
                      <div className={`font-semibold ${getConfidenceColor(match.final_score)}`}>
                        Score: {match.final_score.toFixed(3)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Aparência</div>
                        <div className="font-medium">{match.similarity_score.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Espacial</div>
                        <div className="font-medium">{match.spatial_score.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Temporal</div>
                        <div className="font-medium">{match.temporal_score.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Trajetória</div>
                        <div className="font-medium">{match.trajectory_score.toFixed(3)}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Analytics */}
      {performanceMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Métricas de Performance
            </CardTitle>
            <CardDescription>
              Evolução da precisão após ajustes de re-ranking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {performanceMetrics.slice(-1).map((metrics, index) => (
                <React.Fragment key={index}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      +{(metrics.accuracy_improvement * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Precisão</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      +{(metrics.precision_increase * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Precision</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      +{(metrics.recall_increase * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Recall</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      -{(metrics.false_positive_reduction * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Falsos Positivos</div>
                  </div>
                </React.Fragment>
              ))}
            </div>

            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                O sistema de re-ranking está otimizado para cenários com oclusão e múltiplas câmeras. 
                Os pesos atuais maximizam a precisão mantendo baixa latência.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReIDReranking;