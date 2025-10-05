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

// Simular conversão RTSP→HLS usando MediaMTX
const startConversion = async (request: ConversionRequest): Promise<ConversionStatus> => {
  const { rtsp_url, camera_id, quality = 'medium' } = request;
  
  console.log(`Starting RTSP→HLS conversion for camera ${camera_id}`);
  
  // Gerar URL HLS usando MediaMTX
  let mediamtxBase = Deno.env.get('MEDIAMTX_PUBLIC_BASE') || 'http://localhost:8888';
  
  // Garantir que o /hls está no final se não estiver
  if (!mediamtxBase.endsWith('/hls')) {
    mediamtxBase = mediamtxBase.replace(/\/$/, '') + '/hls';
  }
  
  console.log(`[DEBUG] Gerando URL HLS para RTSP: ${rtsp_url}`);
  console.log(`[DEBUG] MediaMTX base URL normalizado: ${mediamtxBase}`);
  
  // Bloquear URLs de demo conhecidas
  const looksLikeDemo = /demo-|mux\.dev|akamaihd\.net|shaka-demo|tears-of-steel|BigBuckBunny/i.test(rtsp_url);
  
  let hls_url: string | undefined;
  
  if (looksLikeDemo) {
    console.warn('[DEBUG] URL parece demo; hls_url não será definido.');
    hls_url = undefined;
  } else {
    // Gerar URL HLS usando o camera_id como nome do stream no MediaMTX
    // MediaMTX serve HLS em: https://dominio/hls/{stream_name}/index.m3u8
    hls_url = `${mediamtxBase}/${camera_id}/index.m3u8`;
    console.log(`[DEBUG] URL HLS gerada: ${hls_url}`);
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
  
  // Configurar MediaMTX para puxar este stream
  configureMediaMTXStream(camera_id, rtsp_url);
  
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

const configureMediaMTXStream = async (camera_id: string, rtsp_url: string) => {
  try {
    const mediamtxApiUrl = Deno.env.get('MEDIAMTX_API_URL') || 'http://localhost:9997';
    
    console.log(`Configuring MediaMTX stream for ${camera_id}`);
    console.log(`MediaMTX API URL: ${mediamtxApiUrl}`);
    
    // Configurar path no MediaMTX via API
    const pathConfig = {
      name: camera_id,
      source: rtsp_url,
      sourceProtocol: 'tcp',
      sourceOnDemand: true,
      sourceOnDemandStartTimeout: '10s',
      sourceOnDemandCloseAfter: '60s',
    };

    const response = await fetch(`${mediamtxApiUrl}/v3/config/paths/add/${camera_id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pathConfig),
    });

    if (!response.ok && response.status !== 409) {
      console.warn(`MediaMTX API warning: ${response.status}`);
    } else {
      console.log(`MediaMTX configured successfully for ${camera_id}`);
    }
    
    const status = activeConversions.get(camera_id);
    if (status) {
      status.status = 'running';
      activeConversions.set(camera_id, status);
    }
    
    // Manter conversão ativa por 30 minutos
    setTimeout(() => {
      stopConversion(camera_id);
    }, 30 * 60 * 1000);
    
  } catch (error) {
    console.error(`MediaMTX config error for camera ${camera_id}:`, error);
    const status = activeConversions.get(camera_id);
    if (status) {
      status.status = 'error';
      status.error_message = error.message;
      activeConversions.set(camera_id, status);
    }
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

        case 'status': {
          const { camera_id } = body;
          const status = camera_id ? activeConversions.get(camera_id) || null : null;
          return new Response(
            JSON.stringify({ success: true, conversion: status }),
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