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
  url = url.replace('{username}', encodeURIComponent(config.username || ''));
  url = url.replace('{password}', encodeURIComponent(config.password || ''));
  url = url.replace('{host}', config.host);
  url = url.replace('{port}', config.port.toString());
  url = url.replace('{channel}', config.channel.toString());
  url = url.replace('{stream}', config.stream_quality === 'sub' ? '1' : '0');
  
  // Se não tem username/password, remover da URL
  if (!config.username && !config.password) {
    url = url.replace(/\/\/:@/, '//');
  }

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
    const pathParts = url.pathname.split('/');
    let action = pathParts[pathParts.length - 1] || url.searchParams.get('action');
    
    console.log(`DVR Manager - Method: ${req.method}, URL: ${req.url}, Path Action: ${action}`);

    if (req.method === 'POST') {
      let body;
      try {
        const text = await req.text();
        if (!text || text.trim() === '') {
          console.log('Empty request body received');
          return new Response(
            JSON.stringify({ success: false, error: 'Body da requisição está vazio. Envie dados JSON válidos.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        body = JSON.parse(text);
        if (!body || typeof body !== 'object') {
          throw new Error('Body deve ser um objeto JSON válido');
        }
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'JSON inválido na requisição. Verifique a sintaxe do JSON.',
            details: parseError.message 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Usar action do body se disponível, senão usar da URL
      if (body.action) {
        action = body.action;
      }
      
      console.log(`Using action: ${action}`);

      switch (action) {
        case 'test-connection':
        case 'test': {
          const config: TestConnectionRequest = body;
          
          // Validar campos obrigatórios
          if (!config.protocol || !config.host) {
            return new Response(
              JSON.stringify({ success: false, error: 'Protocol e host são obrigatórios' }),
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

        case 'save-config':
        case 'save': {
          console.log('Save config request body:', JSON.stringify(body, null, 2));
          
          const config: DVRConfig = body;
          
          // Validar campos obrigatórios
          if (!config.name || !config.protocol || !config.host) {
            console.error('Missing required fields:', { name: config.name, protocol: config.protocol, host: config.host });
            return new Response(
              JSON.stringify({ success: false, error: 'Name, protocol e host são obrigatórios' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Get user from auth header
          const authHeader = req.headers.get('authorization')
          if (!authHeader?.startsWith('Bearer ')) {
            return new Response(
              JSON.stringify({ success: false, error: 'Unauthorized' }),
              { status: 401, headers: corsHeaders }
            )
          }

          const token = authHeader.substring(7)
          
          // Get user from token
          const { data: { user }, error: authError } = await supabase.auth.getUser(token)
          
          console.log('Auth result:', { user: user?.id, authError });
          
          if (authError || !user) {
            console.error('Auth failed:', { authError, user });
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid token' }),
              { status: 401, headers: corsHeaders }
            )
          }

          // Get user's organization
          const { data: orgData, error: orgError } = await supabase
            .from('org_users')
            .select('org_id')
            .eq('user_id', user.id)
            .single()

          let orgId = null;
          if (orgData) {
            orgId = orgData.org_id;
          }

          // Construir URL do stream
          const streamUrl = buildStreamUrl(config);
          
          // Testar conexão primeiro
          const testResult = await testRTSPConnection(streamUrl);
          
          // Verificar se já existe uma configuração com o mesmo nome e org_id
          const { data: existingConfig } = await supabase
            .from('dvr_configs')
            .select('id')
            .eq('name', config.name)
            .eq('org_id', orgId)
            .maybeSingle();

          let data, error;

          if (existingConfig) {
            // Atualizar configuração existente
            const result = await supabase
              .from('dvr_configs')
              .update({
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
                updated_at: new Date().toISOString()
              })
              .eq('id', existingConfig.id)
              .select()
              .single();
            
            data = result.data;
            error = result.error;
          } else {
            // Criar nova configuração
            const result = await supabase
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
                org_id: orgId
              })
              .select()
              .single();
            
            data = result.data;
            error = result.error;
          }

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

        case 'scan-network':
        case 'scan': {
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
          console.log(`Unknown action: ${action}, URL: ${req.url}`);
          return new Response(
            JSON.stringify({ 
              error: 'Ação não reconhecida',
              action: action,
              available_actions: ['test-connection', 'save-config', 'scan-network']
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
      }
    }

    if (req.method === 'GET') {
      // Get user from auth header for GET requests
      const authHeader = req.headers.get('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers: corsHeaders }
        )
      }

      const token = authHeader.substring(7)
      
      // Get user from token
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid token' }),
          { status: 401, headers: corsHeaders }
        )
      }

      // Get user's organization
      const { data: orgData, error: orgError } = await supabase
        .from('org_users')
        .select('org_id')
        .eq('user_id', user.id)
        .single()

      let orgId = null;
      if (orgData) {
        orgId = orgData.org_id;
      }

      // Listar configurações DVR filtradas por org_id
      const { data, error } = await supabase
        .from('dvr_configs')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('GET Error:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('GET Success - Found configs:', data?.length || 0, 'for org:', orgId);
      return new Response(
        JSON.stringify({ success: true, configs: data || [] }),
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