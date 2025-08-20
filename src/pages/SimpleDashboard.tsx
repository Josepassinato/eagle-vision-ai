import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Camera, 
  Users, 
  Shield, 
  Activity,
  Clock,
  CheckCircle,
  Settings,
  BarChart3,
  Bell,
  Eye,
  TrendingUp,
  Brain
} from "lucide-react";
import Hls from 'hls.js';
import { useBrowserDetection } from "@/hooks/useBrowserDetection";
import OverlayCanvas from "@/components/OverlayCanvas";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import CameraConnectionTester from "@/components/CameraConnectionTester";

interface IPCamera {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  ip_address: string;
  port: number;
  status: string;
  stream_urls?: { rtsp?: string };
  is_permanent?: boolean;
}

const SimpleDashboard = () => {
  const [isLive, setIsLive] = useState(true);
  const [cameras, setCameras] = useState<IPCamera[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [converting, setConverting] = useState(false);
  const [stats, setStats] = useState({
    camerasOnline: 0,
    totalCameras: 0,
    peopleToday: 127,
    alertsToday: 3,
    lastActivity: "2 min atrás"
  });

  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // AI Detection
  const { isLoading: aiLoading, detections, events, counts, isReady } = useBrowserDetection(videoRef, true, "people_count");
  const { events: realtimeEvents } = useRealtimeEvents("test-camera");

  // Seleciona a melhor câmera (prioriza a de teste TC73 permanente, depois quem tem stream_urls, depois online)
  const getPreferredCamera = (cams: IPCamera[] = []): IPCamera | undefined => {
    return (
      cams.find((c: any) => c.is_permanent && c.model === 'TC73') ||
      cams.find((c: any) => (c as any)?.stream_urls?.hls || (c as any)?.stream_urls?.rtsp) ||
      cams.find((c) => c.status === 'online') ||
      cams[0]
    );
  };

  // Carregar câmeras reais
  const loadCameras = async () => {
    try {
      setLoadingCameras(true);
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: { action: 'list' },
        headers: {
          'x-org-id': 'demo-org-id'
        }
      });
      
      if (error) {
        console.error('Error loading cameras:', error);
        toast.error('Erro ao carregar câmeras');
        return;
      }
      
      if (data.success) {
        const cameraList = data.data || [];
        console.log('Câmeras carregadas:', cameraList);
        
        // Converter dados da API para formato esperado
        const formattedCameras = cameraList.map((cam: any) => ({
          id: cam.id,
          name: cam.name || `Câmera ${cam.ip_address}`,
          brand: cam.brand,
          model: cam.model,
          ip_address: cam.ip_address,
          port: cam.port || 554,
          status: cam.status,
          stream_urls: cam.stream_urls || {},
          is_permanent: cam.is_permanent
        }));
        
        setCameras(formattedCameras);
        
        // Atualizar estatísticas reais
        const onlineCameras = formattedCameras.filter((cam: IPCamera) => cam.status === 'online' || cam.status === 'configured').length;
        setStats(prev => ({
          ...prev,
          camerasOnline: onlineCameras,
          totalCameras: formattedCameras.length
        }));
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast.error('Erro ao carregar câmeras');
    } finally {
      setLoadingCameras(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, []);

  // Simular dados em tempo real para pessoas e alertas
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        peopleToday: prev.peopleToday + Math.random() > 0.7 ? 1 : 0,
        alertsToday: prev.alertsToday + Math.random() > 0.95 ? 1 : 0,
        lastActivity: Math.random() > 0.8 ? "Agora" : "2 min atrás"
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const cam = getPreferredCamera(cameras);
    if (!cam || !videoRef.current) return;

    console.log('Configurando vídeo para câmera:', cam);
    
    const hlsUrl = (cam as any)?.stream_urls?.hls || (cam as any)?.stream_urls?.hls_url || null;
    const rtspUrl = cam.stream_urls?.rtsp || ((cam as any).is_permanent && (cam as any).model === 'TC73' ? `rtsp://admin:admin@${cam.ip_address}:${cam.port || 554}/stream1` : undefined);
    
    let hlsInstance: Hls | null = null;

    const attachHls = (url: string) => {
      if (!videoRef.current) return;
      console.log('Iniciando HLS player com URL:', url);
      const video = videoRef.current;
      if (Hls.isSupported()) {
        hlsInstance = new Hls();
        hlsInstance.loadSource(url);
        hlsInstance.attachMedia(video);
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((e) => console.log('Autoplay bloqueado:', e));
        });
        hlsInstance.on(Hls.Events.ERROR, (_, data) => {
          console.error('HLS error:', data);
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        const onCanPlay = () => {
          video.play().catch((e) => console.log('Autoplay bloqueado (nativo):', e));
        };
        video.addEventListener('canplay', onCanPlay, { once: true });
      }
    };

    // Se já houver HLS, anexar imediatamente
    if (hlsUrl) {
      attachHls(hlsUrl);
      return () => { hlsInstance?.destroy(); };
    }

    // Se houver apenas RTSP, iniciar conversão automaticamente
    if (rtspUrl) {
      console.log('Stream RTSP detectado, iniciando conversão:', rtspUrl);
      (async () => {
        try {
          setConverting(true);
          toast.info('Convertendo RTSP → HLS...');
          
          const { data, error } = await supabase.functions.invoke('rtsp-to-hls', {
            body: { 
              action: 'start', 
              rtsp_url: rtspUrl, 
              camera_id: cam.id 
            },
          });
          
          if (error) {
            console.error('RTSP→HLS error:', error);
            toast.error('Erro na conversão RTSP para HLS');
            return;
          }
          
          const gotUrl = data?.conversion?.hls_url || data?.hls_url;
          if (gotUrl) {
            console.log('URL HLS obtida:', gotUrl);
            // Atualizar câmera localmente e anexar player
            setCameras(prev => prev.map(c => c.id === cam.id ? {
              ...c,
              stream_urls: { ...(c.stream_urls || {}), hls: gotUrl, hls_url: gotUrl }
            } : c));
            attachHls(gotUrl);
            toast.success('Stream HLS iniciado');
          } else {
            toast.warning('Conversão iniciada, aguardando URL HLS...');
          }
        } catch (err) {
          console.error('RTSP→HLS exception:', err);
          toast.error('Erro ao converter RTSP para HLS');
        } finally {
          setConverting(false);
        }
      })();
    }

    return () => { hlsInstance?.destroy(); };
  }, [cameras]);

  const recentEvents = [
    { time: "14:23", type: "person", message: "Pessoa detectada - Entrada Principal", status: "normal" },
    { time: "14:20", type: "alert", message: "Movimento em área restrita", status: "warning" },
    { time: "14:18", type: "person", message: "Cliente reconhecido - Maria Silva", status: "success" },
    { time: "14:15", type: "person", message: "Funcionário detectado - João Costa", status: "success" },
  ];

  return (
    <>
      <Helmet>
        <title>Painel de Monitoramento - Visão de Águia</title>
        <meta name="description" content="Acompanhe sua segurança em tempo real" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold">Visão de Águia</h1>
                </div>
                <Badge variant={isLive ? "default" : "destructive"} className="animate-pulse">
                  {isLive ? "🔴 AO VIVO" : "⚫ OFFLINE"}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={() => navigate('/setup')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/app/dashboard')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Modo Avançado
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Bem-vindo ao seu Painel! 👋</h2>
            <p className="text-muted-foreground text-lg">
              Sua segurança inteligente está funcionando. Aqui você vê tudo em tempo real.
            </p>
          </div>

          {/* Status Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Câmeras Online</p>
                    <p className="text-3xl font-bold text-green-700">
                      {stats.camerasOnline}/{stats.totalCameras}
                    </p>
                  </div>
                  <Camera className="h-8 w-8 text-green-600" />
                </div>
                <Progress value={stats.totalCameras ? (stats.camerasOnline / stats.totalCameras) * 100 : 0} className="mt-3" />
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Pessoas Agora</p>
                    <p className="text-3xl font-bold text-blue-700">{counts.person || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-xs text-blue-600 mt-2">Detectadas pela IA</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Alertas Hoje</p>
                    <p className="text-3xl font-bold text-orange-700">{stats.alertsToday}</p>
                  </div>
                  <Bell className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-xs text-orange-600 mt-2">Todos verificados ✅</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">IA de Detecção</p>
                    <p className="text-lg font-bold text-purple-700">
                      {isReady ? "🤖 Ativa" : aiLoading ? "Carregando..." : "Inativa"}
                    </p>
                  </div>
                  <Brain className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-xs text-purple-600 mt-2">
                  {isReady ? "Analisando em tempo real" : "Sistema de IA"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Live View */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Visualização ao Vivo
                </CardTitle>
                <CardDescription>
                  Stream das suas câmeras em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCameras ? (
                  <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                        <Camera className="h-8 w-8 text-blue-400 animate-spin" />
                      </div>
                      <p className="text-lg font-semibold">Carregando câmeras...</p>
                    </div>
                  </div>
                ) : cameras.length === 0 ? (
                  <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                        <Camera className="h-8 w-8 text-orange-400" />
                      </div>
                      <p className="text-lg font-semibold">Nenhuma câmera configurada</p>
                      <p className="text-gray-300 text-sm mb-4">Configure suas câmeras para ver o stream</p>
                      <Button onClick={() => navigate('/setup')} variant="secondary" size="sm">
                        Configurar Câmeras
                      </Button>
                    </div>
                  </div>
                ) : (() => {
                  const firstCamera = getPreferredCamera(cameras) as any;
                  const hlsUrl = (firstCamera as any)?.stream_urls?.hls || (firstCamera as any)?.stream_urls?.hls_url || null;
                  const rtspUrl = (firstCamera as any)?.stream_urls?.rtsp || ((firstCamera as any)?.is_permanent && (firstCamera as any)?.model === 'TC73' ? `rtsp://admin:admin@${(firstCamera as any)?.ip_address}:${(firstCamera as any)?.port || 554}/stream1` : null);
                  
                  return (
                    <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center relative overflow-hidden">
                      {hlsUrl ? (
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          autoPlay
                          muted
                          playsInline
                          aria-label={`Stream HLS da ${firstCamera?.name || 'câmera'}`}
                        />
                      ) : rtspUrl ? (
                        <div className="text-center text-white px-4">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                            <Camera className="h-8 w-8 text-blue-400" />
                          </div>
                          <p className="text-lg font-semibold">Convertendo RTSP → HLS...</p>
                          <p className="text-gray-300 text-sm mb-4">
                            Detectamos RTSP e iniciamos a conversão automaticamente. Assim que o HLS estiver pronto, o vídeo tocará aqui.
                          </p>
                          <div className="text-xs text-gray-400">Status: {converting ? 'processando' : 'aguardando URL HLS'}</div>
                        </div>
                      ) : (
                        <div className="text-center text-white">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                            <Shield className="h-8 w-8 text-green-400" />
                          </div>
                          <p className="text-lg font-semibold">IA Monitorando</p>
                          <p className="text-gray-300 text-sm">{firstCamera?.name || 'Câmera Principal'}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {firstCamera ? `IP: ${firstCamera.ip_address}:${firstCamera.port}` : 'Stream não disponível'}
                          </p>
                        </div>
                      )}
                      
                      {/* AI Detection Overlay */}
                      <OverlayCanvas 
                        videoRef={videoRef} 
                        event={realtimeEvents[0] || (events.length > 0 ? events[events.length - 1] : null)} 
                      />
                      
                      {/* Overlay info */}
                      <div className="absolute top-3 left-3 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none">
                        {firstCamera?.name || 'Câmera Principal'}
                      </div>
                      <div className="absolute top-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none flex items-center gap-1">
                        {isReady ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            🤖 IA Ativa
                          </>
                        ) : aiLoading ? (
                          <>
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                            IA Carregando...
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-gray-500 rounded-full" />
                            IA Inativa
                          </>
                        )}
                      </div>
                      <div className="absolute bottom-3 left-3 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none">
                        {new Date().toLocaleTimeString()}
                      </div>
                      <div className="absolute bottom-3 right-3 bg-black/50 text-white px-2 py-1 rounded text-xs pointer-events-none flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {counts.person || 0} pessoa{counts.person !== 1 ? 's' : ''}
                      </div>
                    </div>
                  );
                })()}
                
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate('/live')} variant="outline">
                    <Camera className="h-4 w-4 mr-2" />
                    Ver Todas as Câmeras
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Eventos Recentes
                </CardTitle>
                <CardDescription>
                  Últimas atividades detectadas pela IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentEvents.map((event, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-full ${
                        event.status === 'success' ? 'bg-green-100' :
                        event.status === 'warning' ? 'bg-orange-100' : 'bg-blue-100'
                      }`}>
                        {event.type === 'person' ? (
                          <Users className={`h-4 w-4 ${
                            event.status === 'success' ? 'text-green-600' :
                            event.status === 'warning' ? 'text-orange-600' : 'text-blue-600'
                          }`} />
                        ) : (
                          <Bell className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.message}</p>
                        <p className="text-xs text-muted-foreground">{event.time}</p>
                      </div>
                      {event.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate('/events')} variant="outline" size="sm">
                    Ver Todos os Eventos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">🎯 Próximos Passos Sugeridos</h3>
                  <p className="text-muted-foreground">
                    Maximize sua segurança com estas configurações
                  </p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/people')}
                  >
                    <Users className="h-6 w-6" />
                    <span className="font-semibold">Cadastrar Pessoas</span>
                    <span className="text-xs text-muted-foreground">
                      Adicione funcionários e clientes conhecidos
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/config')}
                  >
                    <Settings className="h-6 w-6" />
                    <span className="font-semibold">Ajustar Alertas</span>
                    <span className="text-xs text-muted-foreground">
                      Configure quando receber notificações
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/metrics')}
                  >
                    <TrendingUp className="h-6 w-6" />
                    <span className="font-semibold">Ver Relatórios</span>
                    <span className="text-xs text-muted-foreground">
                      Analise dados e estatísticas
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Camera Connection Tester */}
          <div className="mt-8">
            <CameraConnectionTester />
          </div>
        </div>
      </div>
    </>
  );
};

export default SimpleDashboard;