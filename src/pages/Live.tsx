import React, { useState, useEffect, useRef, useMemo } from 'react';
import Hls from 'hls.js';
import { useRealtimeEvents, type RealtimeEvent } from '@/hooks/useRealtimeEvents';
import { useRealtimeDetections } from '@/hooks/useRealtimeDetections';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import OverlayCanvas from '@/components/OverlayCanvas';
import StreamDiagnostics from '@/components/StreamDiagnostics';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Play, Square, RotateCcw } from 'lucide-react';

interface DVRConfig {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port?: number;
  stream_url?: string;
}


export default function Live() {
  const [cameraId, setCameraId] = useState('');
  const [dvrs, setDvrs] = useState<DVRConfig[]>([]);
  const [streamUrl, setStreamUrl] = useState('');
  const [simulate, setSimulate] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carregar DVRs configurados
  useEffect(() => {
    loadDVRs();
  }, []);

  // Recarregar configs quando a sessão autenticar/mudar
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        loadDVRs();
      }
    });
    return () => {
      try { listener?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  const loadDVRs = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.access_token) {
        toast({
          title: "Erro de autenticação",
          description: "Usuário não autenticado",
          variant: "destructive"
        });
        return;
      }

      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/dvr-manager`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2YnN3bm55d2p5dnFmeGV6Z2ZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ3NTI3ODQsImV4cCI6MjA3MDMyODc4NH0.fmpP6MWxsz-GYT44mAvBfR5rXIFdR-PoUbswzkeClo4',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.configs) {
          setDvrs(result.configs);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar DVRs:', error);
    }
  };

const handleDVRChange = (dvrId: string) => {
  const dvr = dvrs.find(d => d.id === dvrId);
  if (dvr) {
    setCameraId(dvrId);
    const fallbackPort = dvr.port ?? 554;
    setStreamUrl(dvr.stream_url || `rtsp://${dvr.host}:${fallbackPort}/stream`);
  }
};

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const { toast } = useToast();

  // ========== HLS Player Setup com DEBUG DETALHADO ==========
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;
    
    // Configurar video element
    video.muted = true;
    video.playsInline = true;
    video.controls = true;
    video.loop = false;
    video.preload = "metadata";

    console.log("🎬 [DEBUG] Configurando player para URL:", streamUrl);
    console.log("🔍 [DEBUG] Tipo de URL detectado:", streamUrl.includes('.m3u8') ? 'HLS' : streamUrl.includes('.mp4') ? 'MP4' : 'Outro');

    // Limpar player anterior
    if (hlsRef.current) {
      console.log("🧹 [DEBUG] Limpando player HLS anterior");
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Verificar se é RTSP (mostrar aviso)
    if (streamUrl.startsWith('rtsp://')) {
      console.log("⚠️ [DEBUG] Stream RTSP detectado:", streamUrl);
      return;
    }

    // 🎯 DETECTAR TIPO DE ARQUIVO
    const isHLS = streamUrl.includes('.m3u8') || streamUrl.includes('playlist');
    const isMP4 = streamUrl.includes('.mp4');

    console.log("🔎 [DEBUG] Análise do arquivo:");
    console.log("  - É HLS (.m3u8):", isHLS);
    console.log("  - É MP4:", isMP4);

    if (isMP4) {
      // 📹 USAR PLAYER NATIVO PARA MP4
      console.log("📹 [DEBUG] Usando player nativo para MP4");
      video.src = streamUrl;
      video.load();
      
      video.addEventListener('loadstart', () => console.log("🔄 [DEBUG] MP4: Load start"));
      video.addEventListener('loadedmetadata', () => console.log("📊 [DEBUG] MP4: Metadata loaded"));
      video.addEventListener('loadeddata', () => console.log("📦 [DEBUG] MP4: Data loaded"));
      video.addEventListener('canplay', () => {
        console.log("▶️ [DEBUG] MP4: Can play");
        video.play().catch(e => console.log("🔇 [DEBUG] Autoplay bloqueado:", e));
      });
      video.addEventListener('error', (e) => {
        console.error("❌ [DEBUG] MP4 Error:", e);
        console.error("❌ [DEBUG] Video error code:", video.error?.code);
        console.error("❌ [DEBUG] Video error message:", video.error?.message);
      });

    } else if (isHLS && Hls.isSupported()) {
      // 🎵 USAR HLS.JS PARA STREAMS HLS
      console.log("✅ [DEBUG] HLS.js suportado, iniciando player HLS...");
      
      const hls = new Hls({
        debug: true, // 🔍 Ativar debug detalhado
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 10,
        maxBufferLength: 15,
        maxMaxBufferLength: 20,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 3,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        console.log("📺 [DEBUG] HLS: Media attached");
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
        console.log("📄 [DEBUG] HLS: Manifest parsed");
        console.log("📊 [DEBUG] HLS: Levels disponíveis:", data.levels.length);
        video.play().catch(e => console.log("▶️ [DEBUG] Autoplay bloqueado:", e));
      });

      hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
        console.log("🎚️ [DEBUG] HLS: Level loaded:", data.level);
      });

      hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
        console.log("📦 [DEBUG] HLS: Fragment loaded:", data.frag.sn);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("❌ [DEBUG] Erro HLS.js:", data);
        console.error("❌ [DEBUG] Tipo:", data.type);
        console.error("❌ [DEBUG] Detalhes:", data.details);
        console.error("❌ [DEBUG] Fatal:", data.fatal);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log("🔄 [DEBUG] Tentando recuperar de erro de rede...");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log("🔧 [DEBUG] Tentando recuperar de erro de mídia...");
              hls.recoverMediaError();
              break;
            default:
              console.log("💥 [DEBUG] Erro fatal HLS, destruindo player");
              hls.destroy();
              hlsRef.current = null;
              toast({
                title: "Erro no player HLS",
                description: `${data.type}: ${data.details}`,
                variant: "destructive"
              });
              break;
          }
        }
      });

      hls.attachMedia(video);
      hls.loadSource(streamUrl);

    } else if (isHLS && video.canPlayType('application/vnd.apple.mpegurl')) {
      // 🍎 HLS NATIVO (Safari)
      console.log("🍎 [DEBUG] Usando HLS nativo (Safari)");
      video.src = streamUrl;
      video.addEventListener('error', (e) => {
        console.error("❌ [DEBUG] Safari HLS Error:", e);
      });
    } else {
      console.error("❌ [DEBUG] Formato não suportado:", streamUrl);
      toast({
        title: "Formato não suportado",
        description: "Este tipo de vídeo não é compatível",
        variant: "destructive"
      });
    }

    return () => {
      if (hlsRef.current) {
        console.log("🧹 [DEBUG] Limpando player HLS");
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, toast]);

  // ========== Real-time Data Processing ==========
  const { events } = useRealtimeEvents(cameraId || 'demo-camera');
  const { latestDetection } = useRealtimeDetections(cameraId || 'demo-camera');

  const processedDetection = useMemo(() => {
    if (!latestDetection) return null;
    
    // Convert RealtimeDetection to RealtimeEvent format
    return {
      camera_id: latestDetection.camera_id,
      ts: latestDetection.created_at,
      bbox: latestDetection.bbox,
      label: latestDetection.detection_type,
      conf: latestDetection.confidence
    } as RealtimeEvent;
  }, [latestDetection]);

  const processedEvents = useMemo(() => {
    // Return events as is since they already match RealtimeEvent interface
    return events;
  }, [events]);

  const startProcessing = async (cameraId: string) => {
    try {
      setIsProcessing(true);
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('stream-start', {
        body: {
          camera_id: cameraId,
          stream_url: streamUrl,
          analytics_enabled: ['people_detection', 'vehicle_detection', 'safety_monitoring']
        }
      });

      if (response.error) throw response.error;
      
      toast({
        title: "Análise iniciada",
        description: "Processamento em tempo real ativado"
      });
    } catch (error) {
      console.error('Erro ao iniciar processamento:', error);
      toast({
        title: "Erro",
        description: "Falha ao iniciar análise",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const stopProcessing = async (cameraId: string) => {
    try {
      const response = await supabase.functions.invoke('stream-stop', {
        body: { camera_id: cameraId }
      });

      if (response.error) throw response.error;
      
      toast({
        title: "Análise parada",
        description: "Processamento em tempo real desativado"
      });
    } catch (error) {
      console.error('Erro ao parar processamento:', error);
    }
  };

  // ========== RTSP to HLS Conversion ==========
  const startRtspConversion = async () => {
    try {
      setIsProcessing(true);
      console.log('Iniciando conversão RTSP→HLS:', {
        rtsp_url: streamUrl,
      });

      // Garantir um camera_id válido mesmo para streams demo
      const cameraIdToUse = (cameraId && cameraId.trim().length > 0)
        ? cameraId
        : (() => {
            try {
              const host = new URL(streamUrl.replace('rtsp://', 'http://')).hostname;
              return host.replace('.internal', '') || 'demo-camera';
            } catch {
              return 'demo-camera';
            }
          })();
      if (!cameraId) setCameraId(cameraIdToUse);

      const { data: result, error: fnError } = await supabase.functions.invoke('rtsp-to-hls', {
        body: {
          rtsp_url: streamUrl,
          camera_id: cameraIdToUse,
          quality: 'medium',
          action: 'start'
        }
      });

      if (fnError) throw fnError;
      console.log('Resposta da conversão:', { data: result, error: null });

      if (result.success) {
        const newStreamUrl = result.conversion.hls_url;
        setStreamUrl(newStreamUrl);
        
        if (result.instructions) {
          console.log('Instruções de setup:', result.instructions);
        }
        
        toast({
          title: "Stream HLS disponível",
          description: "Agora você pode ver o vídeo no browser!"
        });
      } else {
        throw new Error(result.message || 'Erro na conversão');
      }
    } catch (error) {
      console.error('Erro na conversão RTSP→HLS:', error);
      toast({
        title: "Erro na conversão",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ========== Reset Player Function ==========
  const resetPlayer = () => {
    console.log("🔄 [DEBUG] Reset do player solicitado");
    
    if (hlsRef.current) {
      console.log("🧹 [DEBUG] Destruindo player HLS atual");
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (videoRef.current) {
      console.log("📺 [DEBUG] Limpando elemento de vídeo");
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    setStreamUrl('');
    
    toast({
      title: "Player reiniciado",
      description: "Agora você pode selecionar um novo stream"
    });
  };

  // ========== Simulation of Real-time Detections ==========
  useEffect(() => {
    if (!simulate || !streamUrl) return;

    const simulateDetections = () => {
      // Definir cenários baseados na URL do stream
      let detectionScenarios: any[] = [];
      
      if (streamUrl.includes('demo-office') || streamUrl.includes('BigBuckBunny')) {
        // EduBehavior: Detecções de pessoas
        detectionScenarios = [
          { type: 'person', zone: { x: 100, y: 150, width: 80, height: 120 } },
          { type: 'person', zone: { x: 300, y: 180, width: 75, height: 110 } }
        ];
      } else if (streamUrl.includes('demo-parking') || streamUrl.includes('Sintel')) {
        // LPR: Detecções de veículos e placas
        detectionScenarios = [
          { type: 'vehicle', zone: { x: 200, y: 200, width: 150, height: 100 } },
          { type: 'license_plate', zone: { x: 250, y: 280, width: 60, height: 20 } }
        ];
      } else if (streamUrl.includes('demo-retail')) {
        // Antifurto: Detecções de produtos e pessoas
        detectionScenarios = [
          { type: 'person', zone: { x: 150, y: 100, width: 70, height: 130 } },
          { type: 'product', zone: { x: 400, y: 250, width: 50, height: 40 } }
        ];
      } else if (streamUrl.includes('demo-security')) {
        // SafetyVision: Detecções de segurança
        detectionScenarios = [
          { type: 'ppe_violation', zone: { x: 180, y: 120, width: 90, height: 140 } },
          { type: 'safety_equipment', zone: { x: 350, y: 200, width: 60, height: 80 } }
        ];
      }

      // Simular detecções aleatórias
      const randomDetection = detectionScenarios[Math.floor(Math.random() * detectionScenarios.length)];
      if (randomDetection) {
        // Adicionar variação aleatória às coordenadas
        const bbox = {
          x: randomDetection.zone.x + (Math.random() - 0.5) * 20,
          y: randomDetection.zone.y + (Math.random() - 0.5) * 20,
          width: randomDetection.zone.width + (Math.random() - 0.5) * 10,
          height: randomDetection.zone.height + (Math.random() - 0.5) * 10
        };

        const simulatedEvent: RealtimeEvent = {
          camera_id: cameraId || 'demo_camera',
          ts: new Date().toISOString(),
          bbox: [bbox.x, bbox.y, bbox.x + bbox.width, bbox.y + bbox.height],
          label: randomDetection.type,
          conf: 0.75 + Math.random() * 0.2 // 75-95%
        };

        // Disparar evento personalizado para o overlay
        window.dispatchEvent(new CustomEvent('simulatedDetection', { 
          detail: simulatedEvent 
        }));
      }
    };

    const interval = setInterval(simulateDetections, 2000 + Math.random() * 3000); // 2-5 segundos
    return () => clearInterval(interval);
  }, [simulate, streamUrl]);

  // ========== Demo Stream Buttons ==========
  const demoStreams = [
    { name: 'Escritório (EduBehavior)', url: 'rtsp://demo-office.internal:8554/stream' },
    { name: 'Estacionamento (LPR)', url: 'rtsp://demo-parking.internal:8554/stream' },
    { name: 'Loja (Antifurto)', url: 'rtsp://demo-retail.internal:8554/stream' },
    { name: 'Fábrica (SafetyVision)', url: 'rtsp://demo-security.internal:8554/stream' }
  ];

  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  // Determinar qual evento mostrar no overlay
  const eventToShow = simulate ? null : (processedDetection || processedEvents[0]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Live View</h1>
          <p className="text-slate-300">Transmissão HLS com overlays em tempo real</p>
        </div>

        {/* Controls */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Controles de Stream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">DVR/Câmera</label>
                <Select value={cameraId} onValueChange={handleDVRChange} disabled={dvrs.length === 0}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Selecionar DVR..." />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {dvrs.map((dvr) => (
                      <SelectItem key={dvr.id} value={dvr.id} className="text-white hover:bg-slate-700">
                        {dvr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                 </Select>
                 {dvrs.length === 0 && (
                   <p className="mt-2 text-xs text-slate-400">
                     Nenhuma configuração encontrada. Salve em Test DVR e clique em Recarregar.
                   </p>
                 )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Camera ID</label>
                <Input
                  value={cameraId}
                  onChange={(e) => setCameraId(e.target.value)}
                  placeholder="Ex: 3e433952-236b-4993-9b1b..."
                  className="bg-slate-700 border-slate-600 text-white placeholder-slate-400"
                />
              </div>

               <div className="flex items-end space-x-2">
                 <Button 
                   onClick={resetPlayer}
                   variant="outline"
                   className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                 >
                   <RotateCcw className="w-4 h-4 mr-2" />
                   Reset Player
                 </Button>
                 <Button 
                   onClick={loadDVRs}
                   variant="outline"
                   className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
                 >
                   Recarregar DVRs
                 </Button>
               </div>
            </div>

            {/* Demo Stream Buttons */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Streams Demo</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {demoStreams.map((demo, idx) => (
                  <Button
                    key={idx}
                    onClick={() => {
                      setStreamUrl(demo.url);
                      try {
                        const host = new URL(demo.url.replace('rtsp://', 'http://')).hostname;
                        const id = host.replace('.internal', '');
                        setCameraId(id);
                      } catch {
                        setCameraId('demo-camera');
                      }
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600 text-xs"
                  >
                    {demo.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button 
                onClick={startRtspConversion}
                disabled={!streamUrl || isProcessing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? 'Processando...' : 'Converter RTSP→HLS'}
              </Button>

              <Button 
                onClick={() => startProcessing(cameraId)}
                disabled={!cameraId || !streamUrl}
                variant="outline"
                className="bg-green-600 hover:bg-green-700 text-white border-green-600"
              >
                <Play className="w-4 h-4 mr-2" />
                Iniciar Análise
              </Button>

              <Button 
                onClick={() => stopProcessing(cameraId)}
                disabled={!cameraId}
                variant="outline"
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                <Square className="w-4 h-4 mr-2" />
                Parar Análise
              </Button>

              <Button 
                onClick={() => setSimulate(!simulate)}
                variant={simulate ? "default" : "outline"}
                className={simulate ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-700 border-slate-600 text-white hover:bg-slate-600"}
              >
                {simulate ? 'Parar Simulação' : 'Simular detecções'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Video Player */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                controls
                muted
                playsInline
              />
              
              {/* RTSP Message Overlay */}
              {streamUrl.startsWith('rtsp://') && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                  <Alert className="max-w-md bg-slate-800 border-slate-600">
                    <AlertDescription className="text-white">
                      <strong>⚠️ Browsers não reproduzem RTSP diretamente.</strong><br/>
                      O sistema está processando o stream nos servidores.<br/>
                      Para ver o vídeo no browser, clique em "Converter RTSP→HLS"
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Detection Overlays */}
              <OverlayCanvas 
                videoRef={videoRef}
                event={eventToShow}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stream Diagnostics */}
        <Collapsible open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700"
            >
              <span className="flex items-center gap-2">
                {diagnosticsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Diagnóstico de Conectividade dos Streams
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <StreamDiagnostics />
          </CollapsibleContent>
        </Collapsible>

      </div>
    </div>
  );
}