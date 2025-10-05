import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Play, Square, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import HLS from 'hls.js';

export default function DirectRTSPTester() {
  const [rtspUrl, setRtspUrl] = useState('rtsp://190.171.138.210/1');
  const [cameraId, setCameraId] = useState('test-camera-' + Date.now());
  const [hlsUrl, setHlsUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'converting' | 'ready' | 'playing' | 'error'>('idle');
  const [lastError, setLastError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);

  // Limpar player ao desmontar
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  const convertToHLS = async () => {
    if (!rtspUrl) {
      toast.error('Digite uma URL RTSP válida');
      return;
    }

    setIsLoading(true);
    setStatus('converting');
    setLastError('');
    
    try {
      console.log('🎬 Iniciando conversão RTSP → HLS');
      console.log('📹 RTSP URL:', rtspUrl);
      console.log('🆔 Camera ID:', cameraId);
      
      const { data, error } = await supabase.functions.invoke('rtsp-to-hls', {
        body: {
          action: 'start',
          rtsp_url: rtspUrl,
          camera_id: cameraId,
          quality: 'medium'
        }
      });

      if (error) {
        throw new Error(`Erro na conversão: ${error.message}`);
      }

      const hlsResult = data?.conversion?.hls_url || data?.hls_url;
      
      if (hlsResult) {
        console.log('✅ URL HLS obtida:', hlsResult);
        setHlsUrl(hlsResult);
        setStatus('ready');
        toast.success('Conversão RTSP → HLS concluída! Clique em "Iniciar Vídeo" para reproduzir.');
      } else {
        throw new Error('URL HLS não foi retornada pela conversão');
      }
    } catch (error) {
      console.error('❌ Erro na conversão:', error);
      setStatus('error');
      setLastError(error.message);
      toast.error(`Erro na conversão: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const startVideo = async () => {
    if (!hlsUrl || !videoRef.current) {
      toast.error('URL HLS não disponível');
      return;
    }

    try {
      const video = videoRef.current;
      
      // Limpar player anterior
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      console.log('🎥 Iniciando reprodução HLS:', hlsUrl);

      if (HLS.isSupported()) {
        const hls = new HLS({
          debug: true,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        hlsRef.current = hls;

        hls.on(HLS.Events.MEDIA_ATTACHED, () => {
          console.log('📎 HLS: Media anexada');
        });

        hls.on(HLS.Events.MANIFEST_PARSED, () => {
          console.log('📋 HLS: Manifest parseado');
          video.play().then(() => {
            setStatus('playing');
            toast.success('Vídeo iniciado!');
          }).catch(e => {
            console.error('⚠️ Erro no autoplay:', e);
            toast.warning('Clique no vídeo para iniciar');
          });
        });

        hls.on(HLS.Events.ERROR, (event, data) => {
          console.error('❌ Erro HLS:', data);
          if (data.fatal) {
            setStatus('error');
            setLastError(`Erro fatal HLS: ${data.details}`);
            toast.error(`Erro no vídeo: ${data.details}`);
          }
        });

        hls.loadSource(hlsUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari nativo
        video.src = hlsUrl;
        video.addEventListener('canplay', () => {
          video.play().then(() => {
            setStatus('playing');
            toast.success('Vídeo iniciado (Safari nativo)');
          }).catch(e => {
            console.error('⚠️ Erro no autoplay:', e);
            toast.warning('Clique no vídeo para iniciar');
          });
        }, { once: true });
      } else {
        throw new Error('Formato HLS não suportado neste navegador');
      }
    } catch (error) {
      console.error('❌ Erro ao iniciar vídeo:', error);
      setStatus('error');
      setLastError(error.message);
      toast.error(`Erro no vídeo: ${error.message}`);
    }
  };

  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStatus('ready');
    toast.info('Vídeo parado');
  };

  return (
    <Card className="w-full max-w-5xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Teste Direto de Stream RTSP
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={status === 'idle' ? 'outline' : status === 'error' ? 'destructive' : 'default'}>
            Status: {status === 'idle' ? 'Aguardando' : 
                     status === 'converting' ? 'Convertendo...' :
                     status === 'ready' ? 'Pronto' :
                     status === 'playing' ? 'Reproduzindo' : 'Erro'}
          </Badge>
          {hlsUrl && (
            <Badge variant="secondary">
              HLS Disponível
            </Badge>
          )}
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">URL RTSP</label>
            <Input
              value={rtspUrl}
              onChange={(e) => setRtspUrl(e.target.value)}
              placeholder="rtsp://ip:porta/caminho"
              className="font-mono text-sm"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">ID da Câmera (único)</label>
            <Input
              value={cameraId}
              onChange={(e) => setCameraId(e.target.value)}
              placeholder="test-camera-123"
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* URLs Geradas */}
        {hlsUrl && (
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div>
              <span className="text-sm font-medium">URL RTSP:</span>
              <code className="block text-xs mt-1 p-2 bg-background rounded overflow-x-auto">
                {rtspUrl}
              </code>
            </div>
            <div>
              <span className="text-sm font-medium">URL HLS:</span>
              <code className="block text-xs mt-1 p-2 bg-background rounded overflow-x-auto">
                {hlsUrl}
              </code>
            </div>
          </div>
        )}

        {/* Controles */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={convertToHLS}
            disabled={isLoading || !rtspUrl}
            variant="default"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Converter RTSP → HLS
          </Button>

          <Button 
            onClick={startVideo}
            disabled={!hlsUrl || status === 'playing'}
            variant="secondary"
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Vídeo
          </Button>

          <Button 
            onClick={stopVideo}
            disabled={status !== 'playing'}
            variant="destructive"
          >
            <Square className="h-4 w-4 mr-2" />
            Parar Vídeo
          </Button>
        </div>

        {/* Player de Vídeo */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            controls
            muted
            playsInline
          />
          {status !== 'playing' && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold">
                  {status === 'idle' ? 'Digite uma URL RTSP e clique em Converter' :
                   status === 'converting' ? 'Convertendo stream...' :
                   status === 'ready' ? 'Clique em "Iniciar Vídeo"' :
                   status === 'error' ? 'Erro na reprodução' : 'Aguardando...'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mensagem de Erro */}
        {lastError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Erro:</span>
            </div>
            <p className="mt-1 text-sm text-destructive/80">{lastError}</p>
          </div>
        )}

        {/* Instruções */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            📋 Instruções
          </h4>
          <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
            <li>1. Digite a URL RTSP da câmera (ex: rtsp://190.171.138.210/1)</li>
            <li>2. Clique em "Converter RTSP → HLS" e aguarde</li>
            <li>3. Quando a conversão terminar, clique em "Iniciar Vídeo"</li>
            <li>4. O vídeo deve começar a tocar automaticamente</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
