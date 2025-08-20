import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Camera, Play, Square, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import HLS from 'hls.js';

interface CameraStatus {
  isLoading: boolean;
  cameraFound: boolean;
  cameraData: any;
  rtspUrl: string;
  hlsUrl: string;
  conversionStatus: 'idle' | 'converting' | 'success' | 'error';
  videoPlaying: boolean;
  lastError: string;
}

export default function CameraConnectionTester() {
  const [status, setStatus] = useState<CameraStatus>({
    isLoading: false,
    cameraFound: false,
    cameraData: null,
    rtspUrl: '',
    hlsUrl: '',
    conversionStatus: 'idle',
    videoPlaying: false,
    lastError: ''
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HLS | null>(null);

  // Verificar se a câmera existe
  const checkCamera = async () => {
    setStatus(prev => ({ ...prev, isLoading: true, lastError: '' }));
    
    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: { action: 'list' },
        headers: { 'x-org-id': 'demo-org-id' }
      });

      if (error) {
        throw new Error(`Erro ao buscar câmeras: ${error.message}`);
      }

      const cameras = data?.data || [];
      const testCamera = cameras.find((cam: any) => cam.is_permanent === true);

      if (testCamera) {
        console.log('Câmera de teste encontrada:', testCamera);
        setStatus(prev => ({
          ...prev,
          cameraFound: true,
          cameraData: testCamera,
          rtspUrl: testCamera.stream_urls?.rtsp || '',
          hlsUrl: testCamera.stream_urls?.hls || testCamera.stream_urls?.hls_url || ''
        }));
        toast.success(`Câmera encontrada: ${testCamera.name}`);
      } else {
        setStatus(prev => ({
          ...prev,
          cameraFound: false,
          lastError: 'Câmera de teste não encontrada'
        }));
        toast.error('Câmera de teste não encontrada');
      }
    } catch (error) {
      console.error('Erro ao verificar câmera:', error);
      setStatus(prev => ({
        ...prev,
        cameraFound: false,
        lastError: error.message
      }));
      toast.error('Erro ao verificar câmera');
    } finally {
      setStatus(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Converter RTSP para HLS
  const convertToHLS = async () => {
    if (!status.rtspUrl) {
      toast.error('URL RTSP não disponível');
      return;
    }

    setStatus(prev => ({ ...prev, conversionStatus: 'converting', lastError: '' }));
    
    try {
      console.log('Iniciando conversão RTSP → HLS para:', status.rtspUrl);
      
      const { data, error } = await supabase.functions.invoke('rtsp-to-hls', {
        body: {
          action: 'start',
          rtsp_url: status.rtspUrl,
          camera_id: status.cameraData?.id || 'test-camera'
        }
      });

      if (error) {
        throw new Error(`Erro na conversão: ${error.message}`);
      }

      const hlsUrl = data?.conversion?.hls_url || data?.hls_url;
      if (hlsUrl) {
        console.log('URL HLS obtida:', hlsUrl);
        setStatus(prev => ({
          ...prev,
          hlsUrl,
          conversionStatus: 'success'
        }));
        toast.success('Conversão RTSP → HLS concluída');
      } else {
        throw new Error('URL HLS não retornada');
      }
    } catch (error) {
      console.error('Erro na conversão:', error);
      setStatus(prev => ({
        ...prev,
        conversionStatus: 'error',
        lastError: error.message
      }));
      toast.error(`Erro na conversão: ${error.message}`);
    }
  };

  // Iniciar reprodução do vídeo
  const startVideo = async () => {
    if (!status.hlsUrl || !videoRef.current) {
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

      console.log('Iniciando reprodução HLS:', status.hlsUrl);

      if (HLS.isSupported()) {
        const hls = new HLS({
          debug: true,
          enableWorker: true,
          lowLatencyMode: false
        });

        hlsRef.current = hls;

        hls.on(HLS.Events.MEDIA_ATTACHED, () => {
          console.log('HLS: Media anexada');
        });

        hls.on(HLS.Events.MANIFEST_PARSED, () => {
          console.log('HLS: Manifest parseado');
          video.play().then(() => {
            setStatus(prev => ({ ...prev, videoPlaying: true }));
            toast.success('Vídeo iniciado');
          }).catch(e => {
            console.error('Erro no autoplay:', e);
            toast.warning('Clique no vídeo para iniciar');
          });
        });

        hls.on(HLS.Events.ERROR, (event, data) => {
          console.error('Erro HLS:', data);
          setStatus(prev => ({
            ...prev,
            videoPlaying: false,
            lastError: `Erro HLS: ${data.details}`
          }));
          toast.error(`Erro no vídeo: ${data.details}`);
        });

        hls.loadSource(status.hlsUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari nativo
        video.src = status.hlsUrl;
        video.addEventListener('canplay', () => {
          video.play().then(() => {
            setStatus(prev => ({ ...prev, videoPlaying: true }));
            toast.success('Vídeo iniciado (nativo)');
          }).catch(e => {
            console.error('Erro no autoplay nativo:', e);
            toast.warning('Clique no vídeo para iniciar');
          });
        }, { once: true });
      } else {
        throw new Error('Formato HLS não suportado neste navegador');
      }
    } catch (error) {
      console.error('Erro ao iniciar vídeo:', error);
      setStatus(prev => ({
        ...prev,
        videoPlaying: false,
        lastError: error.message
      }));
      toast.error(`Erro no vídeo: ${error.message}`);
    }
  };

  // Parar vídeo
  const stopVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setStatus(prev => ({ ...prev, videoPlaying: false }));
    toast.info('Vídeo parado');
  };

  // Verificar câmera automaticamente
  useEffect(() => {
    checkCamera();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Teste de Conexão da Câmera
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status da Câmera */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-2">
            {status.cameraFound ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )}
            <span className="font-medium">Câmera Encontrada</span>
            <Badge variant={status.cameraFound ? "default" : "destructive"}>
              {status.cameraFound ? "Sim" : "Não"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {status.conversionStatus === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : status.conversionStatus === 'error' ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : status.conversionStatus === 'converting' ? (
              <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-500" />
            )}
            <span className="font-medium">Conversão HLS</span>
            <Badge variant={
              status.conversionStatus === 'success' ? "default" :
              status.conversionStatus === 'error' ? "destructive" :
              status.conversionStatus === 'converting' ? "secondary" : "outline"
            }>
              {status.conversionStatus === 'success' ? "Pronto" :
               status.conversionStatus === 'error' ? "Erro" :
               status.conversionStatus === 'converting' ? "Convertendo" : "Pendente"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {status.videoPlaying ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-gray-500" />
            )}
            <span className="font-medium">Vídeo Tocando</span>
            <Badge variant={status.videoPlaying ? "default" : "outline"}>
              {status.videoPlaying ? "Sim" : "Não"}
            </Badge>
          </div>
        </div>

        {/* Informações da Câmera */}
        {status.cameraData && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Detalhes da Câmera</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span><strong>Nome:</strong> {status.cameraData.name}</span>
              <span><strong>Status:</strong> {status.cameraData.status}</span>
              <span><strong>IP:</strong> {status.cameraData.ip_address}:{status.cameraData.port}</span>
              <span><strong>Modelo:</strong> {status.cameraData.brand} {status.cameraData.model}</span>
            </div>
            {status.rtspUrl && (
              <div className="mt-2">
                <strong>RTSP:</strong> <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{status.rtspUrl}</code>
              </div>
            )}
            {status.hlsUrl && (
              <div className="mt-2">
                <strong>HLS:</strong> <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{status.hlsUrl}</code>
              </div>
            )}
          </div>
        )}

        {/* Controles */}
        <div className="flex flex-wrap gap-2">
          <Button 
            onClick={checkCamera} 
            disabled={status.isLoading}
            variant="outline"
          >
            {status.isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar Câmera
          </Button>

          <Button 
            onClick={convertToHLS}
            disabled={!status.cameraFound || status.conversionStatus === 'converting'}
            variant="secondary"
          >
            {status.conversionStatus === 'converting' ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Converter RTSP → HLS
          </Button>

          <Button 
            onClick={startVideo}
            disabled={!status.hlsUrl || status.videoPlaying}
            variant="default"
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Vídeo
          </Button>

          <Button 
            onClick={stopVideo}
            disabled={!status.videoPlaying}
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
            className="w-full h-full object-cover"
            controls
            muted
            playsInline
          />
          {!status.videoPlaying && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold">Aguardando vídeo...</p>
                <p className="text-sm opacity-75">
                  {!status.cameraFound ? "Câmera não encontrada" :
                   !status.hlsUrl ? "Aguardando conversão HLS" :
                   "Clique em 'Iniciar Vídeo'"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mensagem de Erro */}
        {status.lastError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <span className="font-medium">Erro:</span>
            </div>
            <p className="mt-1 text-red-700 dark:text-red-300 text-sm">{status.lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}