import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function validateTenantApiKey(apiKey: string, supabase: any) {
  const { data, error } = await supabase.rpc('validate_tenant_api_key', { api_key: apiKey });
  if (error || !data) {
    throw new Error('Invalid API key');
  }
  return data;
}

async function logApiAudit(supabase: any, tenantId: string, req: Request, status: number, responseTimeMs: number) {
  await supabase.from('api_audit_logs').insert({
    tenant_id: tenantId,
    endpoint: new URL(req.url).pathname,
    method: req.method,
    api_key_used: req.headers.get('x-api-key')?.substring(0, 10) + '...',
    response_status: status,
    response_time_ms: responseTimeMs,
    ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    user_agent: req.headers.get('user-agent')
  });
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      const responseTime = Date.now() - startTime;
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tenantId = await validateTenantApiKey(apiKey, supabase);

    if (req.method === 'POST') {
      const payload = await req.json();
      const {
        camera_id,
        event_type,
        confidence = 0.0,
        metadata = {},
        person_count = 0,
        zone_name,
        clip_uri,
        service_id
      } = payload;

      // Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('church_events')
        .insert({
          camera_id,
          event_type,
          confidence,
          metadata,
          person_count,
          zone_name,
          clip_uri,
          org_id: tenantId
        })
        .select()
        .single();

      if (eventError) {
        const responseTime = Date.now() - startTime;
        await logApiAudit(supabase, tenantId, req, 500, responseTime);
        return new Response(JSON.stringify({ error: eventError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update attendance if applicable
      if (service_id && ['entry', 'exit', 'attendance'].includes(event_type)) {
        const { error: attendanceError } = await supabase
          .from('attendance')
          .insert({
            service_id,
            camera_id,
            zone_name,
            method: 'detection',
            confidence,
            metadata: { event_id: eventData.id }
          });

        if (attendanceError) {
          console.error('Attendance update error:', attendanceError);
        }
      }

      // Store clip with retention policy
      if (clip_uri) {
        EdgeRuntime.waitUntil(
          supabase.from('clips_retention').insert({
            tenant_id: tenantId,
            clip_path: clip_uri,
            bucket_name: 'event_clips',
            retention_days: 30
          })
        );
      }

      const responseTime = Date.now() - startTime;
      EdgeRuntime.waitUntil(logApiAudit(supabase, tenantId, req, 200, responseTime));

      return new Response(JSON.stringify({ 
        success: true, 
        event_id: eventData.id,
        processing_time_ms: responseTime 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: responseTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});