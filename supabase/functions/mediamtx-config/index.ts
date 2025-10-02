import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConfigureStreamRequest {
  camera_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { camera_id }: ConfigureStreamRequest = await req.json();

    // Buscar informações da câmera no banco de dados
    const { data: camera, error: cameraError } = await supabase
      .from('ip_cameras')
      .select('*')
      .eq('id', camera_id)
      .single();

    if (cameraError || !camera) {
      // Tentar buscar em DVR configs
      const { data: dvrCamera, error: dvrError } = await supabase
        .from('dvr_configs')
        .select('*')
        .eq('id', camera_id)
        .single();

      if (dvrError || !dvrCamera) {
        throw new Error('Câmera não encontrada');
      }

      // Usar dados do DVR
      const rtspUrl = dvrCamera.stream_url;
      return await configureMediaMTX(camera_id, rtspUrl);
    }

    // Construir URL RTSP da câmera IP
    const rtspUrl = camera.stream_urls?.rtsp || 
                    `rtsp://${camera.username}:${camera.password}@${camera.ip_address}:${camera.port}${camera.rtsp_path || '/stream1'}`;

    return await configureMediaMTX(camera_id, rtspUrl);

  } catch (error) {
    console.error("MediaMTX config error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function configureMediaMTX(cameraId: string, rtspUrl: string) {
  const mediamtxApiUrl = Deno.env.get('MEDIAMTX_API_URL') || 'http://localhost:9997';
  const mediamtxPublicBase = Deno.env.get('MEDIAMTX_PUBLIC_BASE') || 'http://localhost:8888';

  console.log(`Configuring MediaMTX for camera ${cameraId}`);
  console.log(`RTSP URL: ${rtspUrl}`);
  console.log(`MediaMTX API: ${mediamtxApiUrl}`);

  // Configurar path no MediaMTX via API
  const pathConfig = {
    name: cameraId,
    source: rtspUrl,
    sourceProtocol: 'tcp',
    sourceOnDemand: true,
    sourceOnDemandStartTimeout: '10s',
    sourceOnDemandCloseAfter: '60s',
  };

  try {
    // Adicionar ou atualizar path no MediaMTX
    const response = await fetch(`${mediamtxApiUrl}/v3/config/paths/add/${cameraId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pathConfig),
    });

    if (!response.ok) {
      // Se falhar, pode ser porque já existe, então tentamos atualizar
      const updateResponse = await fetch(`${mediamtxApiUrl}/v3/config/paths/edit/${cameraId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pathConfig),
      });

      if (!updateResponse.ok) {
        throw new Error(`MediaMTX API error: ${updateResponse.status}`);
      }
    }

    // Retornar URL HLS
    const hlsUrl = `${mediamtxPublicBase}/${cameraId}/index.m3u8`;
    
    console.log(`MediaMTX configured successfully. HLS URL: ${hlsUrl}`);

    return new Response(
      JSON.stringify({
        success: true,
        camera_id: cameraId,
        rtsp_url: rtspUrl,
        hls_url: hlsUrl,
        message: "MediaMTX configurado com sucesso"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('MediaMTX API error:', error);
    
    // Se não conseguir configurar via API, retornar URL HLS mesmo assim
    // O MediaMTX pode ter configuração estática que funciona
    const hlsUrl = `${mediamtxPublicBase}/${cameraId}/index.m3u8`;
    
    return new Response(
      JSON.stringify({
        success: true,
        camera_id: cameraId,
        rtsp_url: rtspUrl,
        hls_url: hlsUrl,
        warning: "Não foi possível configurar via API, usando configuração estática"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
}
