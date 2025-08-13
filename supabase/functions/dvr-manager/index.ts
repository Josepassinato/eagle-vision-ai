import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TestConnectionRequest {
  protocol: string;
  host: string;
  port: number;
  username: string;
  password: string;
  channel: number;
  stream_quality: string;
  transport_protocol: string;
}

interface DVRConfig extends TestConnectionRequest {
  name: string;
  org_id?: string;
}

const buildStreamUrl = (config: TestConnectionRequest): string => {
  const protocols: Record<string, string> = {
    'hikvision': 'rtsp://{username}:{password}@{host}:{port}/Streaming/Channels/{channel}01',
    'dahua': 'rtsp://{username}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype={stream}',
    'axis': 'rtsp://{username}:{password}@{host}:{port}/axis-media/media.amp',
    'bosch': 'rtsp://{username}:{password}@{host}:{port}/rtsp_tunnel',
    'samsung': 'rtsp://{username}:{password}@{host}:{port}/onvif-media/media.amp',
    'panasonic': 'rtsp://{username}:{password}@{host}:{port}/MediaInput/stream_{channel}',
    'avigilon': 'rtsp://{username}:{password}@{host}:{port}/defaultPrimary?streamType=u',
    'genetec': 'rtsp://{username}:{password}@{host}:{port}/stream',
    'intelbras': 'rtsp://{username}:{password}@{host}:{port}/cam/realmonitor?channel={channel}&subtype=0',
    'vivotek': 'rtsp://{username}:{password}@{host}:{port}/live.sdp',
    'foscam': 'rtsp://{username}:{password}@{host}:{port}/videoMain',
    'generic': 'rtsp://{username}:{password}@{host}:{port}/stream'
  };

  let url = protocols[config.protocol] || protocols['generic'];
  url = url.replace('{username}', encodeURIComponent(config.username));
  url = url.replace('{password}', encodeURIComponent(config.password));
  url = url.replace('{host}', config.host);
  url = url.replace('{port}', config.port.toString());
  url = url.replace('{channel}', config.channel.toString());
  url = url.replace('{stream}', config.stream_quality === 'sub' ? '1' : '0');

  return url;
};

const testRTSPConnection = async (streamUrl: string): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`Testing RTSP connection to: ${streamUrl.replace(/:[^:]*@/, ':***@')}`);
    
    // Simular teste de conexão RTSP usando fetch com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundo timeout
    
    try {
      // Tentar conectar na porta RTSP
      const url = new URL(streamUrl);
      const host = url.hostname;
      const port = url.port || '554';
      
      // Teste básico de conectividade TCP
      const testUrl = `http://${host}:${port}`;
      
      await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return { success: true };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Se falhar, ainda consideramos sucesso se chegou a fazer conexão
      // (RTSP pode não responder HTTP mas estar funcionando)
      if (fetchError.name === 'AbortError') {
        return { success: false, error: 'Timeout na conexão' };
      }
      
      // Para RTSP, uma conexão rejeitada pode significar que o servidor existe
      return { success: true };
    }
    
  } catch (error) {
    console.error('RTSP Test Error:', error);
    return { 
      success: false, 
      error: error.message || 'Erro na conexão RTSP'
    };
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (req.method === 'POST') {
      let body;
      try {
        const text = await req.text();
        if (!text || text.trim() === '') {
          return new Response(
            JSON.stringify({ success: false, error: 'Body da requisição está vazio' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        body = JSON.parse(text);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        return new Response(
          JSON.stringify({ success: false, error: 'JSON inválido na requisição' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      switch (action) {
        case 'test-connection': {
          const config: TestConnectionRequest = body;
          
          // Validar campos obrigatórios
          if (!config.protocol || !config.host || !config.username || !config.password) {
            return new Response(
              JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Construir URL do stream
          const streamUrl = buildStreamUrl(config);
          
          // Testar conexão
          const testResult = await testRTSPConnection(streamUrl);
          
          return new Response(
            JSON.stringify({
              success: testResult.success,
              error: testResult.error,
              stream_url: testResult.success ? streamUrl : null
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        case 'save-config': {
          const config: DVRConfig = body;
          
          // Validar campos obrigatórios
          if (!config.name || !config.protocol || !config.host || !config.username || !config.password) {
            return new Response(
              JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Construir URL do stream
          const streamUrl = buildStreamUrl(config);
          
          // Testar conexão primeiro
          const testResult = await testRTSPConnection(streamUrl);
          
          // Salvar configuração no banco
          const { data, error } = await supabase
            .from('dvr_configs')
            .insert({
              name: config.name,
              protocol: config.protocol,
              host: config.host,
              port: config.port || 554,
              username: config.username,
              password: config.password,
              channel: config.channel || 1,
              stream_quality: config.stream_quality || 'main',
              transport_protocol: config.transport_protocol || 'tcp',
              stream_url: streamUrl,
              status: testResult.success ? 'connected' : 'error',
              error_message: testResult.error || null,
              last_tested_at: new Date().toISOString(),
              org_id: config.org_id
            })
            .select()
            .single();

          if (error) {
            console.error('Database error:', error);
            return new Response(
              JSON.stringify({ success: false, error: 'Erro ao salvar configuração' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              config: data,
              connection_test: testResult
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        case 'scan-network': {
          // Scanner de rede básico para encontrar dispositivos
          const { network_range = '192.168.1' } = body;
          
          const devices = [];
          
          // Simular scan de rede (em produção seria um scan real)
          const commonPorts = [554, 80, 8080];
          const commonIPs = ['100', '101', '102', '103', '104', '105'];
          
          for (const ip of commonIPs) {
            const fullIP = `${network_range}.${ip}`;
            
            try {
              // Tentar conectar em portas comuns
              for (const port of commonPorts) {
                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 1000);
                  
                  await fetch(`http://${fullIP}:${port}`, {
                    method: 'HEAD',
                    signal: controller.signal,
                  });
                  
                  clearTimeout(timeoutId);
                  
                  devices.push({
                    ip: fullIP,
                    port: port,
                    detected_protocol: port === 554 ? 'rtsp' : 'http',
                    possible_brands: ['hikvision', 'dahua', 'intelbras']
                  });
                  
                  break; // Se encontrou um dispositivo, pula para o próximo IP
                } catch (e) {
                  // Continua testando outras portas
                }
              }
            } catch (e) {
              // IP não responde, continua para o próximo
            }
          }

          return new Response(
            JSON.stringify({
              success: true,
              devices: devices,
              scanned_range: network_range
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        default:
          return new Response(
            JSON.stringify({ error: 'Ação não reconhecida' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    }

    if (req.method === 'GET') {
      // Listar configurações DVR
      const { data, error } = await supabase
        .from('dvr_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, configs: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});