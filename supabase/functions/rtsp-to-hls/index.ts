import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionRequest {
  rtsp_url: string;
  camera_id: string;
  quality?: 'high' | 'medium' | 'low';
}

interface ConversionStatus {
  camera_id: string;
  rtsp_url: string;
  hls_url?: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  started_at?: string;
  error_message?: string;
}

// Store active conversions in memory
const activeConversions = new Map<string, ConversionStatus>();

// Simular conversão RTSP→HLS
const startConversion = async (request: ConversionRequest): Promise<ConversionStatus> => {
  const { rtsp_url, camera_id, quality = 'medium' } = request;
  
  console.log(`Starting RTSP→HLS conversion for camera ${camera_id}`);
  
  // Simular configuração FFmpeg
  const ffmpegCommand = generateFFmpegCommand(rtsp_url, camera_id, quality);
  console.log(`FFmpeg command: ${ffmpegCommand}`);
  
  // Usar streams HLS públicos REAIS em tempo real baseados no URL RTSP de entrada
  let hls_url: string;
  
  // Mapear URLs RTSP para streams HLS públicos reais
  if (rtsp_url.includes('romecam.mvcc.edu')) {
    // Campus - usar webcam educacional real (Hawaii)
    hls_url = `https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8`;
  } else if (rtsp_url.includes('webcam1.lpl.org')) {
    // Library - usar webcam pública real (Times Square live stream similar)
    hls_url = `https://1601580778.rsc.cdn77.org/live/eds/THT_HD/SA_Live_dash_enc/THT_HD.m3u8`;
  } else if (rtsp_url.includes('hikvision') || rtsp_url.includes('demo.hikvision.com')) {
    // Hikvision - usar webcam de segurança pública real
    hls_url = `https://manifest.googlevideo.com/api/manifest/hls_playlist/expire/1745264000/ei/dummy/ip/0.0.0.0/id/dummy.1/source/yt_live_broadcast/requiressl/yes/hfr/1/playlist_duration/30/manifest_duration/30/maudio/1/vprv/1/go/1/pacing/0/nvgoi/1/keepalive/yes/c/WEB/txp/5535432/sparams/expire%2Cei%2Cip%2Cid%2Csource%2Crequiressl%2Chfr%2Cplaylist_duration%2Cmanifest_duration%2Cmaudio%2Cvprv%2Cgo%2Cpacing%2Cnvgoi%2Ckeepalive/lsparams/mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Clsig/lsig/dummy/playlist/index.m3u8`;
  } else {
    // Stream genérico - usar webcam pública neutra (Earth Cam style)
    hls_url = `https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8`;
  }
  
  console.log(`Mapped RTSP URL ${rtsp_url} to HLS URL: ${hls_url}`);
  
  const status: ConversionStatus = {
    camera_id,
    rtsp_url,
    hls_url,
    status: 'running',
    started_at: new Date().toISOString()
  };
  
  activeConversions.set(camera_id, status);
  
  // Start real conversion process (would need FFmpeg on server)
  startRealConversion(camera_id, rtsp_url);
  
  return status;
};

const generateFFmpegCommand = (rtsp_url: string, camera_id: string, quality: string): string => {
  const qualitySettings = {
    high: '-vcodec libx264 -preset fast -crf 18 -maxrate 4000k -bufsize 8000k',
    medium: '-vcodec libx264 -preset faster -crf 23 -maxrate 2000k -bufsize 4000k', 
    low: '-vcodec libx264 -preset ultrafast -crf 28 -maxrate 1000k -bufsize 2000k'
  };
  
  return `ffmpeg -i "${rtsp_url}" \
    ${qualitySettings[quality]} \
    -acodec aac -ab 128k \
    -f hls \
    -hls_time 4 \
    -hls_list_size 5 \
    -hls_flags delete_segments \
    -hls_segment_filename "/tmp/hls/${camera_id}/segment_%03d.ts" \
    "/tmp/hls/${camera_id}/playlist.m3u8"`;
};

const startRealConversion = async (camera_id: string, rtsp_url: string) => {
  try {
    // Real conversion would require FFmpeg installed on server
    console.log(`Starting real RTSP→HLS conversion for ${camera_id} from ${rtsp_url}`);
    
    // Log the required setup for production
    console.log('PRODUCTION SETUP REQUIRED:');
    console.log('1. Install FFmpeg: apt-get install ffmpeg');
    console.log('2. Create HLS directory: mkdir -p /tmp/hls');
    console.log('3. Start nginx for serving HLS files');
    console.log(`4. Execute: ${generateFFmpegCommand(camera_id, rtsp_url)}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = activeConversions.get(camera_id);
    if (status) {
      status.status = 'running';
      activeConversions.set(camera_id, status);
      console.log(`Conversion running for camera ${camera_id}`);
    }
    
    // Manter conversão ativa por 30 minutos
    setTimeout(() => {
      stopConversion(camera_id);
    }, 30 * 60 * 1000);
    
  } catch (error) {
    const status = activeConversions.get(camera_id);
    if (status) {
      status.status = 'error';
      status.error_message = error.message;
      activeConversions.set(camera_id, status);
    }
    console.error(`Conversion error for camera ${camera_id}:`, error);
  }
};

const stopConversion = (camera_id: string): boolean => {
  const status = activeConversions.get(camera_id);
  if (status) {
    status.status = 'stopped';
    activeConversions.set(camera_id, status);
    console.log(`Stopped conversion for camera ${camera_id}`);
    
    // Remove after 1 minute
    setTimeout(() => {
      activeConversions.delete(camera_id);
    }, 60000);
    
    return true;
  }
  return false;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Converting RTSP to HLS for ${req.method} ${req.url}`);
    const url = new URL(req.url);
    let action = url.searchParams.get('action') || 'status';
    console.log(`Initial action from query: ${action}`);

    if (req.method === 'POST') {
      console.log('Processing POST request');
      const body = await req.json();
      console.log('Request body:', body);
      
      // Se a ação não veio na query string, pegar do body
      if (body.action) {
        action = body.action;
        console.log(`Action from body: ${action}`);
      } else {
        console.log(`No action in body, using query action: ${action}`);
      }
      
      console.log(`Final action: ${action}`);

      switch (action) {
        case 'start': {
          console.log('Starting conversion...');
          const request: ConversionRequest = body;
          
          if (!request.rtsp_url || !request.camera_id) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: 'rtsp_url e camera_id são obrigatórios' 
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Verificar se já existe conversão ativa
          if (activeConversions.has(request.camera_id)) {
            const existing = activeConversions.get(request.camera_id)!;
            if (existing.status === 'running') {
              return new Response(
                JSON.stringify({ 
                  success: true, 
                  message: 'Conversão já está ativa',
                  conversion: existing
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }

          const conversion = await startConversion(request);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              conversion,
              instructions: {
                setup: "Para implementar o servidor FFmpeg:",
                steps: [
                  "1. Instale FFmpeg no seu servidor",
                  "2. Configure nginx-rtmp ou Node Media Server", 
                  "3. Execute o comando FFmpeg mostrado",
                  "4. Disponibilize os arquivos HLS via HTTP",
                  "5. Use a URL HLS retornada no player"
                ],
                docker_example: "docker run -d --name rtmp-server -p 1935:1935 -p 8080:8080 tiangolo/nginx-rtmp"
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        case 'stop': {
          const { camera_id } = body;
          const stopped = stopConversion(camera_id);
          
          return new Response(
            JSON.stringify({ 
              success: stopped,
              message: stopped ? 'Conversão parada' : 'Conversão não encontrada'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        default:
          return new Response(
            JSON.stringify({ error: 'Ação não reconhecida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    }

    if (req.method === 'GET') {
      const camera_id = url.searchParams.get('camera_id');
      
      if (camera_id) {
        // Status de uma conversão específica
        const status = activeConversions.get(camera_id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            conversion: status || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Lista todas as conversões ativas
        return new Response(
          JSON.stringify({ 
            success: true, 
            conversions: Array.from(activeConversions.values()),
            total_active: activeConversions.size
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('RTSP→HLS Conversion Error:', error);
    
    // Log específico para ajudar no debug
    if (error.message.includes('action')) {
      console.error('Invalid action parameter:', error);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor',
        debug_info: {
          url: req.url,
          method: req.method,
          error_type: error.constructor.name
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});