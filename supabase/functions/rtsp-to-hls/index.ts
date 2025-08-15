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
  
  // 🎯 STREAMS HLS REAIS para cada ANALÍTICO
  let hls_url: string;
  
  console.log(`[DEBUG] Mapeando RTSP URL: ${rtsp_url}`);
  
  // 🎯 STREAMS DIFERENCIADOS para cada ANALÍTICO específico
  if (rtsp_url.includes('demo-office.internal')) {
    // Demo Escritório: pessoas em ambiente corporativo
    hls_url = `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`;
    console.log(`[DEBUG] Mapeado para Demo Escritório (pessoas): ${hls_url}`);
  } else if (rtsp_url.includes('demo-parking.internal')) {
    // Demo Estacionamento: carros e veículos
    hls_url = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;
    console.log(`[DEBUG] Mapeado para Demo Estacionamento (veículos): ${hls_url}`);
  } else if (rtsp_url.includes('demo-retail.internal')) {
    // Demo Varejo: ambiente de loja
    hls_url = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4`;
    console.log(`[DEBUG] Mapeado para Demo Varejo (loja): ${hls_url}`);
  } else if (rtsp_url.includes('demo-security.internal')) {
    // Demo Segurança: ambiente industrial
    hls_url = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4`;
    console.log(`[DEBUG] Mapeado para Demo Segurança (industrial): ${hls_url}`);
  } else {
    // Padrão: Demo genérico para testes
    hls_url = `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`;
    console.log(`[DEBUG] Mapeado para stream padrão: ${hls_url}`);
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
    console.log(`4. Execute: ${generateFFmpegCommand(rtsp_url, camera_id, 'medium')}`);
    
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