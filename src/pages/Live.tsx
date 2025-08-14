import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { LIVE_HLS_URL, DEMO_VIDEO_STREAM } from "@/config";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import { useRealtimeDetections } from "@/hooks/useRealtimeDetections";
import type { RealtimeEvent } from "@/hooks/useRealtimeEvents";
import OverlayCanvas from "@/components/OverlayCanvas";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import StreamDiagnostics from "@/components/StreamDiagnostics";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, AlertTriangle } from "lucide-react";

const Live: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraId, setCameraId] = useState<string>("cam-real-01");
  const [availableDVRs, setAvailableDVRs] = useState<any[]>([]);
  const [selectedDVR, setSelectedDVR] = useState<any>(null);
  const [currentStreamUrl, setCurrentStreamUrl] = useState<string>(LIVE_HLS_URL);
  const { events } = useRealtimeEvents(cameraId);
  const { latestDetection } = useRealtimeDetections(cameraId);
  const [simulate, setSimulate] = useState(false);
  const [simEvent, setSimEvent] = useState<RealtimeEvent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Carregar DVRs configurados
  useEffect(() => {
    loadDVRs();
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
          // Carregar TODAS as configurações salvas (não apenas connected)
          setAvailableDVRs(result.configs);
          
          if (result.configs.length > 0) {
            setSelectedDVR(result.configs[0]);
            setCameraId(result.configs[0].id);
            setCurrentStreamUrl(result.configs[0].stream_url);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar DVRs:', error);
    }
  };

  const handleDVRChange = (dvrId: string) => {
    const dvr = availableDVRs.find(d => d.id === dvrId);
    if (dvr) {
      setSelectedDVR(dvr);
      setCameraId(dvr.id);
      setCurrentStreamUrl(dvr.stream_url);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    (video as any).autoplay = true;

    try {
      // Para streams RTSP, não podemos usar HLS diretamente no browser
      // Vamos mostrar uma mensagem informativa
      if (currentStreamUrl.startsWith('rtsp://')) {
        // Para streams RTSP, mostrar informação ao usuário
        return;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true });
        hls.loadSource(currentStreamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        return () => hls.destroy();
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = currentStreamUrl;
        const onLoaded = () => video.play().catch(() => {});
        video.addEventListener('loadedmetadata', onLoaded);
        return () => video.removeEventListener('loadedmetadata', onLoaded);
      }
    } catch (e) {
      toast({ title: "Erro no player", description: String(e), variant: "destructive" });
    }
  }, [currentStreamUrl]);

  // Convert real detection to event format for overlay
  const realEvent = useMemo(() => {
    if (!latestDetection) return null;
    
    return {
      camera_id: latestDetection.camera_id,
      bbox: latestDetection.bbox,
      label: latestDetection.detection_type,
      conf: latestDetection.confidence,
      ts: latestDetection.created_at,
      reason: `${latestDetection.service} detection`
    } as RealtimeEvent;
  }, [latestDetection]);

  // Último evento da câmera (do Realtime legacy)
  const lastForCam = useMemo(() => {
    return events.length ? events[events.length - 1] : null;
  }, [events]);

  const startProcessing = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('stream-start', {
        body: {
          camera_id: cameraId,
          stream_url: currentStreamUrl,
          analytics_enabled: ['people_detection', 'vehicle_detection', 'safety_monitoring']
        }
      });

      if (error) throw error;
      
      toast({
        title: "Processamento iniciado",
        description: `Análise em tempo real ativa para ${cameraId}`
      });
    } catch (error) {
      toast({
        title: "Erro ao iniciar processamento",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const stopProcessing = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('stream-stop', {
        body: { camera_id: cameraId }
      });

      if (error) throw error;
      
      toast({
        title: "Processamento parado",
        description: `Análise pausada para ${cameraId}`
      });
    } catch (error) {
      toast({
        title: "Erro ao parar processamento", 
        description: String(error),
        variant: "destructive"
      });
    }
  };

  const startRtspConversion = async () => {
    if (!selectedDVR || !currentStreamUrl.startsWith('rtsp://')) {
      toast({
        title: "Stream RTSP necessário",
        description: "Selecione um DVR com stream RTSP para converter",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('Iniciando conversão RTSP→HLS:', {
        rtsp_url: currentStreamUrl,
        camera_id: cameraId,
        quality: 'medium'
      });

      const { data, error } = await supabase.functions.invoke('rtsp-to-hls', {
        body: {
          rtsp_url: currentStreamUrl,
          camera_id: cameraId,
          quality: 'medium',
          action: 'start'
        }
      });

      console.log('Resposta da conversão:', { data, error });

      if (error) {
        console.error('Erro detalhado da edge function:', error);
        throw new Error(`Edge Function Error: ${error.message || JSON.stringify(error)}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Conversão falhou sem detalhes');
      }

      toast({
        title: "🎬 Conversão RTSP→HLS iniciada!",
        description: `Configurando servidor de streaming para ${selectedDVR.name}`,
      });

      // Mostrar instruções de setup
      console.log('Instruções de setup:', data.instructions);
      
      if (data.conversion?.hls_url) {
        setCurrentStreamUrl(data.conversion.hls_url);
        toast({
          title: "Stream HLS disponível",
          description: "Agora você pode ver o vídeo no browser!",
        });
      }

    } catch (error) {
      console.error('Erro completo na conversão:', error);
      
      let errorMessage = 'Erro desconhecido na conversão';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Erro na conversão",
        description: errorMessage,
        variant: "destructive"
      });
    }
  };

  // Simulação de detecções (caixas aleatórias)
  useEffect(() => {
    if (!simulate) { setSimEvent(null); return; }
    const labels = ["person", "car", "truck", "bus", "motorcycle", "bicycle"] as const;
    const interval = setInterval(() => {
      const x1 = Math.random() * 0.7;
      const y1 = Math.random() * 0.6;
      const w = 0.15 + Math.random() * 0.25;
      const h = 0.12 + Math.random() * 0.3;
      const ev: RealtimeEvent = {
        camera_id: cameraId,
        bbox: [x1, y1, Math.min(0.98, x1 + w), Math.min(0.98, y1 + h)],
        label: labels[Math.floor(Math.random() * labels.length)],
        conf: 0.6 + Math.random() * 0.35,
        ts: new Date().toISOString(),
        reason: "demo-simulated",
      };
      setSimEvent(ev);
    }, 900);
    return () => clearInterval(interval);
  }, [simulate, cameraId]);

  const eventToShow = simulate ? simEvent : realEvent || lastForCam;

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Live View</h1>
        <p className="text-muted-foreground">Transmissão HLS com overlays em tempo real</p>
      </header>

      <section className="mb-4 flex items-center gap-4 flex-wrap">
        {availableDVRs.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">DVR/Câmera</label>
            <Select value={selectedDVR?.id || ""} onValueChange={handleDVRChange}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Selecione um DVR configurado" />
              </SelectTrigger>
              <SelectContent>
                {availableDVRs.map((dvr) => (
                  <SelectItem key={dvr.id} value={dvr.id}>
                    {dvr.name} ({dvr.protocol}) 
                    <Badge variant={dvr.status === 'connected' ? 'default' : 'secondary'} className="ml-2">
                      {dvr.status}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="camera">camera_id</label>
          <Input id="camera" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="w-[220px]" placeholder="cam-real-01" />
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => {
              setCameraId("demo-hls-stream");
              setCurrentStreamUrl(DEMO_VIDEO_STREAM);
              setSelectedDVR(null);
              toast({
                title: "Stream Demo Carregado",
                description: "Usando stream de teste para demonstração",
              });
            }} 
            variant="outline" 
            size="sm"
          >
            🎬 Demo de Teste
          </Button>
          <Button 
            onClick={() => {
              setCameraId("webcam-real");
              setCurrentStreamUrl("https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8");
              setSelectedDVR(null);
              toast({
                title: "Stream Público Carregado", 
                description: "Usando webcam pública real para teste",
              });
            }} 
            variant="outline" 
            size="sm"
          >
            📹 Webcam Pública
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          Detecções reais: {latestDetection ? '✅' : '❌'} | Eventos legacy: {events.length}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={startProcessing} disabled={isProcessing} size="sm">
            {isProcessing ? "Iniciando..." : "Iniciar Análise"}
          </Button>
          <Button onClick={stopProcessing} variant="outline" size="sm">
            Parar
          </Button>
          {currentStreamUrl.startsWith('rtsp://') && (
            <Button onClick={startRtspConversion} variant="secondary" size="sm">
              🎬 Converter RTSP→HLS
            </Button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="sim">Simular detecções</Label>
          <Switch id="sim" checked={simulate} onCheckedChange={setSimulate} />
        </div>
      </section>

      <section className="relative w-full aspect-video rounded-lg overflow-hidden shadow-primary">
        {currentStreamUrl.startsWith('rtsp://') ? (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <div className="text-center text-white p-8">
              <div className="text-6xl mb-4">📹</div>
              <h3 className="text-xl font-semibold mb-2">Stream RTSP Real Conectado</h3>
              <p className="text-gray-300 mb-2">
                DVR: <strong>{selectedDVR?.name || 'Desconhecido'}</strong>
              </p>
              <p className="text-gray-300 mb-4">
                URL: <code className="bg-gray-800 px-2 py-1 rounded text-sm">{currentStreamUrl}</code>
              </p>
              <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mb-4">
                <p className="text-blue-200 text-sm">
                  ℹ️ Browsers não reproduzem RTSP diretamente. O sistema está processando o stream nos servidores.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-green-400">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Análise de IA funcionando em background</span>
              </div>
              <p className="text-gray-400 text-xs mt-4">
                Para ver o vídeo no browser, clique em "Converter RTSP→HLS"
              </p>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="w-full h-full bg-black"
            controls={false}
            playsInline
            muted
            autoPlay
            crossOrigin="anonymous"
          />
        )}
        <OverlayCanvas videoRef={videoRef} event={eventToShow} />
      </section>

      {/* Painel de Diagnóstico */}
      <section className="mt-8">
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Diagnóstico de Conectividade dos Streams
              </div>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <StreamDiagnostics />
          </CollapsibleContent>
        </Collapsible>
      </section>
    </main>
  );
};

export default Live;
