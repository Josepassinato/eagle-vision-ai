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
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tenantId = await validateTenantApiKey(apiKey, supabase);
    const url = new URL(req.url);
    const serviceId = url.pathname.split('/').pop();

    if (req.method === 'GET' && url.pathname.includes('/summary')) {
      // Get service summary
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', serviceId)
        .eq('tenant_id', tenantId)
        .single();

      if (serviceError || !service) {
        return new Response(JSON.stringify({ error: 'Service not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get attendance data
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('service_id', serviceId);

      // Get events data
      const { data: events } = await supabase
        .from('church_events')
        .select('*')
        .eq('org_id', tenantId)
        .gte('timestamp', service.start_time)
        .lte('timestamp', service.end_time || new Date().toISOString());

      // Calculate summary metrics
      const totalAttendance = attendance?.length || 0;
      const uniqueAttendees = new Set(attendance?.map(a => a.visitor_id).filter(Boolean)).size;
      const avgDwellTime = attendance?.reduce((sum, a) => {
        if (a.exit_time && a.entry_time) {
          return sum + (new Date(a.exit_time).getTime() - new Date(a.entry_time).getTime());
        }
        return sum;
      }, 0) / (attendance?.filter(a => a.exit_time).length || 1);

      const eventsByType = events?.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const summary = {
        service,
        metrics: {
          total_attendance: totalAttendance,
          unique_attendees: uniqueAttendees,
          avg_dwell_time_ms: Math.round(avgDwellTime),
          events_by_type: eventsByType,
          peak_occupancy: Math.max(...(events?.map(e => e.person_count) || [0])),
          service_duration_ms: service.end_time 
            ? new Date(service.end_time).getTime() - new Date(service.start_time).getTime()
            : null
        },
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});