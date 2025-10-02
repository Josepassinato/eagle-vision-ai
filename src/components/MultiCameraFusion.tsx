import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Camera, 
  GitMerge, 
  TrendingUp, 
  Clock, 
  Activity,
  MapPin,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FusedTrack {
  track_id: string;
  person_id?: string;
  cameras: string[];
  first_seen: string;
  last_seen: string;
  trajectory: Array<{
    camera_id: string;
    timestamp: string;
  }>;
  confidence: number;
}

interface FusionStats {
  total_fused_tracks: number;
  avg_confidence: number;
  avg_cameras_per_track: number;
  total_trajectory_points: number;
}

const MultiCameraFusion: React.FC = () => {
  const [fusedTracks, setFusedTracks] = useState<FusedTrack[]>([]);
  const [stats, setStats] = useState<FusionStats | null>(null);
  const [timeRange, setTimeRange] = useState<number>(24);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<FusedTrack | null>(null);

  useEffect(() => {
    loadFusionStats();
    loadRecentTracks();
  }, [timeRange]);

  const loadFusionStats = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { 
          action: 'get_fusion_stats',
          time_range_hours: timeRange
        }
      });

      if (error) throw error;
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading fusion stats:', error);
    }
  };

  const loadRecentTracks = async () => {
    setIsLoading(true);
    try {
      // Load recent performance metrics for fused tracks
      const { data: metrics, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('service_name', 'multi-camera-fusion')
        .eq('metric_type', 'fused_track')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Convert metrics to fused tracks
      const tracks: FusedTrack[] = (metrics || []).map(m => {
        const metadata = m.metadata as any;
        return {
          track_id: metadata?.track_id || m.id,
          cameras: metadata?.cameras || [],
          first_seen: m.timestamp,
          last_seen: new Date(new Date(m.timestamp).getTime() + (metadata?.duration || 0)).toISOString(),
          trajectory: [],
          confidence: m.value
        };
      });

      setFusedTracks(tracks);
    } catch (error) {
      console.error('Error loading tracks:', error);
      toast.error('Falha ao carregar tracks de fusão');
    } finally {
      setIsLoading(false);
    }
  };

  const correlateCameraEvents = async () => {
    setIsLoading(true);
    try {
      // Get all available cameras
      const { data: cameras } = await supabase
        .from('ip_cameras')
        .select('name')
        .limit(10);

      const cameraIds = (cameras || []).map(c => c.name);

      const { data, error } = await supabase.functions.invoke('multi-camera-fusion', {
        body: { 
          action: 'correlate_events',
          camera_ids: cameraIds,
          time_range_minutes: 30
        }
      });

      if (error) throw error;

      toast.success(`${data.correlated_events.length} eventos correlacionados encontrados`);
      console.log('Correlated events:', data.correlated_events);
    } catch (error) {
      console.error('Error correlating events:', error);
      toast.error('Falha ao correlacionar eventos');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (firstSeen: string, lastSeen: string) => {
    const duration = new Date(lastSeen).getTime() - new Date(firstSeen).getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Multi-Camera Fusion</h2>
          <p className="text-muted-foreground">
            Rastreamento cross-camera e correlação temporal de eventos
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange.toString()} onValueChange={(v) => setTimeRange(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 hora</SelectItem>
              <SelectItem value="6">6 horas</SelectItem>
              <SelectItem value="24">24 horas</SelectItem>
              <SelectItem value="168">7 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={correlateCameraEvents} disabled={isLoading}>
            <GitMerge className="mr-2 h-4 w-4" />
            Correlacionar Eventos
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Tracks Fusionados</p>
                  <p className="text-2xl font-bold">{stats.total_fused_tracks}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Confiança Média</p>
                  <p className="text-2xl font-bold">{(stats.avg_confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Câmeras/Track</p>
                  <p className="text-2xl font-bold">{stats.avg_cameras_per_track.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Pontos de Trajetória</p>
                  <p className="text-2xl font-bold">{stats.total_trajectory_points}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fused Tracks List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Tracks Fusionados Recentes
          </CardTitle>
          <CardDescription>
            Pessoas rastreadas através de múltiplas câmeras
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando tracks...
            </div>
          ) : fusedTracks.length > 0 ? (
            <div className="space-y-3">
              {fusedTracks.map((track) => (
                <Card 
                  key={track.track_id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTrack(track)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              Track #{track.track_id.slice(0, 8)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDuration(track.first_seen, track.last_seen)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Camera className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="outline">
                            {track.cameras.length} câmeras
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Confiança</div>
                          <div className="font-semibold text-green-600">
                            {(track.confidence * 100).toFixed(1)}%
                          </div>
                        </div>

                        <Badge>
                          {new Date(track.first_seen).toLocaleTimeString('pt-BR')}
                        </Badge>
                      </div>
                    </div>

                    {/* Cameras involved */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {track.cameras.map((camera, idx) => (
                        <Badge key={idx} variant="secondary">
                          <Camera className="mr-1 h-3 w-3" />
                          {camera}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Nenhum track fusionado encontrado no período selecionado.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Track Details Modal */}
      {selectedTrack && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes do Track</CardTitle>
            <CardDescription>
              Track #{selectedTrack.track_id.slice(0, 8)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Primeira Detecção</p>
                  <p className="font-medium">
                    {new Date(selectedTrack.first_seen).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Última Detecção</p>
                  <p className="font-medium">
                    {new Date(selectedTrack.last_seen).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duração Total</p>
                  <p className="font-medium">
                    {formatDuration(selectedTrack.first_seen, selectedTrack.last_seen)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Câmeras Atravessadas</p>
                  <p className="font-medium">{selectedTrack.cameras.length}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Timeline de Câmeras</p>
                <div className="space-y-2">
                  {selectedTrack.cameras.map((camera, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{camera}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                onClick={() => setSelectedTrack(null)} 
                variant="outline" 
                className="w-full"
              >
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MultiCameraFusion;
