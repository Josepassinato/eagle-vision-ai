import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Network, Zap, Globe, Users, TrendingUp } from "lucide-react";

interface CameraCalibration {
  camera_id: string;
  intrinsic_matrix: number[][];
  extrinsic_matrix: number[][];
  distortion_coefficients: number[];
  calibration_quality: number;
}

interface Track3D {
  id: string;
  position_3d: number[];
  velocity_3d: number[];
  state: 'ACTIVE' | 'LOST' | 'MERGED' | 'TERMINATED';
  associated_detections: Record<string, any>;
  confidence: number;
  track_duration: number;
}

interface SceneContext {
  camera_calibrations: Record<string, CameraCalibration>;
  ground_plane: number[];
  scene_bounds: number[];
}

export default function MultiCameraFusion() {
  const [calibrations, setCalibrations] = useState<CameraCalibration[]>([]);
  const [tracks3D, setTracks3D] = useState<Track3D[]>([]);
  const [sceneContext, setSceneContext] = useState<SceneContext | null>(null);
  const [fusionStats, setFusionStats] = useState({
    cameras_active: 0,
    tracks_active: 0,
    triangulation_accuracy: 0,
    cross_camera_matches: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCameraCalibrations();
    loadActive3DTracks();
    loadFusionStats();
    
    // Setup realtime updates for 3D tracks
    const channel = supabase
      .channel('multi_camera_fusion')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'tracks_3d'
      }, () => {
        loadActive3DTracks();
        loadFusionStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadCameraCalibrations = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { action: 'get_calibrations' }
      });
      
      if (error) throw error;
      setCalibrations(data.calibrations || []);
    } catch (error) {
      console.error('Error loading calibrations:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar calibrações das câmeras",
        variant: "destructive"
      });
    }
  };

  const loadActive3DTracks = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { action: 'get_active_tracks' }
      });
      
      if (error) throw error;
      setTracks3D(data.tracks || []);
    } catch (error) {
      console.error('Error loading 3D tracks:', error);
    }
  };

  const loadFusionStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { action: 'get_fusion_stats' }
      });
      
      if (error) throw error;
      setFusionStats(data.stats || fusionStats);
    } catch (error) {
      console.error('Error loading fusion stats:', error);
    }
  };

  const triggerCalibration = async (cameraId: string) => {
    try {
      const { error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { 
          action: 'trigger_calibration',
          camera_id: cameraId
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: `Calibração iniciada para câmera ${cameraId}`
      });
      
      setTimeout(loadCameraCalibrations, 2000);
      
    } catch (error) {
      console.error('Error triggering calibration:', error);
      toast({
        title: "Erro",
        description: "Falha ao iniciar calibração",
        variant: "destructive"
      });
    }
  };

  const optimizeSceneConfiguration = async () => {
    try {
      const { error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { action: 'optimize_scene_config' }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Otimização da configuração da cena iniciada"
      });
      
    } catch (error) {
      console.error('Error optimizing scene:', error);
      toast({
        title: "Erro",
        description: "Falha ao otimizar configuração",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Multi-Camera Fusion – IA Avançada | Painel</title>
        <meta name="description" content="Sistema de fusão multi-câmera para tracking 3D e análise global da cena" />
        <link rel="canonical" href="/app/multi-camera-fusion" />
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Multi-Camera Fusion</h1>
          <p className="text-muted-foreground">Tracking cross-câmera e compreensão global da cena</p>
        </div>
        <Button onClick={optimizeSceneConfiguration} className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Otimizar Configuração
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Câmeras Ativas</p>
                <p className="text-2xl font-bold">{fusionStats.cameras_active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Tracks 3D Ativos</p>
                <p className="text-2xl font-bold">{fusionStats.tracks_active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Precisão 3D</p>
                <p className="text-2xl font-bold">{(fusionStats.triangulation_accuracy * 100).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Matches Cross-Camera</p>
                <p className="text-2xl font-bold">{fusionStats.cross_camera_matches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calibration" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calibration">Calibração de Câmeras</TabsTrigger>
          <TabsTrigger value="tracking">Tracking 3D</TabsTrigger>
          <TabsTrigger value="scene">Análise de Cena</TabsTrigger>
          <TabsTrigger value="pose">Estimação de Pose 3D</TabsTrigger>
        </TabsList>

        <TabsContent value="calibration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calibrações de Câmeras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {calibrations.map((calibration) => (
                  <div key={calibration.camera_id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">Câmera {calibration.camera_id}</h4>
                        <p className="text-sm text-muted-foreground">
                          Qualidade da calibração: {(calibration.calibration_quality * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={calibration.calibration_quality > 0.8 ? "default" : "destructive"}>
                          {calibration.calibration_quality > 0.8 ? "Excelente" : "Requer Calibração"}
                        </Badge>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => triggerCalibration(calibration.camera_id)}
                        >
                          Recalibrar
                        </Button>
                      </div>
                    </div>
                    
                    <Progress value={calibration.calibration_quality * 100} className="mb-3" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="font-medium mb-1">Matriz Intrínseca</p>
                        <div className="bg-muted p-2 rounded font-mono">
                          {calibration.intrinsic_matrix.map((row, i) => (
                            <div key={i}>[{row.map(v => v.toFixed(2)).join(', ')}]</div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">Posição 3D</p>
                        <div className="bg-muted p-2 rounded font-mono">
                          <div>X: {calibration.extrinsic_matrix[0][3].toFixed(2)}m</div>
                          <div>Y: {calibration.extrinsic_matrix[1][3].toFixed(2)}m</div>
                          <div>Z: {calibration.extrinsic_matrix[2][3].toFixed(2)}m</div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-1">Distorção</p>
                        <div className="bg-muted p-2 rounded font-mono">
                          {calibration.distortion_coefficients.map((coef, i) => (
                            <div key={i}>k{i+1}: {coef.toFixed(4)}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracking" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tracks 3D Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tracks3D.filter(t => t.state === 'ACTIVE').map((track) => (
                  <div key={track.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium">Track {track.id}</h4>
                        <p className="text-sm text-muted-foreground">
                          Duração: {(track.track_duration / 1000).toFixed(1)}s
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default">{track.state}</Badge>
                        <Badge variant="outline">
                          Confiança: {(track.confidence * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Posição 3D (metros)</p>
                        <div className="bg-muted p-3 rounded font-mono text-sm">
                          <div>X: {track.position_3d[0].toFixed(2)}</div>
                          <div>Y: {track.position_3d[1].toFixed(2)}</div>
                          <div>Z: {track.position_3d[2].toFixed(2)}</div>
                        </div>
                      </div>
                      
                      <div>
                        <p className="font-medium mb-2">Velocidade 3D (m/s)</p>
                        <div className="bg-muted p-3 rounded font-mono text-sm">
                          <div>VX: {track.velocity_3d[0].toFixed(2)}</div>
                          <div>VY: {track.velocity_3d[1].toFixed(2)}</div>
                          <div>VZ: {track.velocity_3d[2].toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <p className="font-medium mb-2">Detecções Associadas</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(track.associated_detections).map((cameraId) => (
                          <Badge key={cameraId} variant="secondary">
                            {cameraId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scene" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise Global da Cena</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Densidade da Cena</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Zona A (Entrada)</span>
                        <span>12 pessoas</span>
                      </div>
                      <Progress value={60} />
                      
                      <div className="flex justify-between text-sm">
                        <span>Zona B (Central)</span>
                        <span>8 pessoas</span>
                      </div>
                      <Progress value={40} />
                      
                      <div className="flex justify-between text-sm">
                        <span>Zona C (Saída)</span>
                        <span>5 pessoas</span>
                      </div>
                      <Progress value={25} />
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Padrões de Movimento</h4>
                    <div className="space-y-3">
                      <div className="border rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Fluxo Principal</span>
                          <Badge variant="default">Norte → Sul</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          85% do movimento segue esta direção
                        </p>
                      </div>
                      
                      <div className="border rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Velocidade Média</span>
                          <Badge variant="secondary">1.2 m/s</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Dentro do padrão normal
                        </p>
                      </div>
                      
                      <div className="border rounded p-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Aglomerações</span>
                          <Badge variant="destructive">2 detectadas</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Zona de entrada e corredor B
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Interações Detectadas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-500">23</div>
                      <div className="text-sm text-muted-foreground">Conversas</div>
                    </div>
                    <div className="border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-green-500">45</div>
                      <div className="text-sm text-muted-foreground">Cruzamentos</div>
                    </div>
                    <div className="border rounded p-3 text-center">
                      <div className="text-2xl font-bold text-orange-500">7</div>
                      <div className="text-sm text-muted-foreground">Paradas</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Estimação de Pose 3D</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">Poses Detectadas</h4>
                    <div className="space-y-3">
                      {['Caminhando', 'Parado', 'Sentado', 'Correndo'].map((pose, i) => (
                        <div key={pose} className="flex justify-between items-center">
                          <span className="text-sm">{pose}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{[12, 8, 3, 2][i]}</span>
                            <Progress value={[60, 40, 15, 10][i]} className="w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-3">Qualidade da Estimação</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Precisão dos Keypoints</span>
                          <span>94.2%</span>
                        </div>
                        <Progress value={94.2} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Estabilidade Temporal</span>
                          <span>91.8%</span>
                        </div>
                        <Progress value={91.8} />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Cobertura 3D</span>
                          <span>87.5%</span>
                        </div>
                        <Progress value={87.5} />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Atividades Reconhecidas</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { activity: 'Caminhada Normal', count: 18, confidence: 95 },
                      { activity: 'Conversa em Grupo', count: 6, confidence: 88 },
                      { activity: 'Esperando', count: 4, confidence: 92 },
                      { activity: 'Movimento Rápido', count: 2, confidence: 76 }
                    ].map((item) => (
                      <div key={item.activity} className="border rounded p-3">
                        <div className="text-lg font-bold">{item.count}</div>
                        <div className="text-sm font-medium">{item.activity}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.confidence}% confiança
                        </div>
                      </div>
                    ))}
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