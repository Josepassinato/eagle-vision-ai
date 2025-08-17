import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-partner-key, x-white-label',
};

async function validatePartnerApiKey(apiKey: string, supabase: any) {
  const { data, error } = await supabase.rpc('validate_partner_api_key', { api_key: apiKey });
  if (error || !data || data.length === 0) {
    throw new Error('Invalid partner API key');
  }
  return data[0];
}

async function recordPartnerUsage(partnerId: string, tenantId: string, endpoint: string, supabase: any) {
  // Record usage for billing
  await supabase
    .from('partner_billing_usage')
    .upsert({
      partner_id: partnerId,
      tenant_id: tenantId,
      endpoint,
      usage_date: new Date().toISOString().split('T')[0],
      event_count: 1
    }, {
      onConflict: 'partner_id,tenant_id,endpoint,usage_date',
      ignoreDuplicates: false
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

    // Validate Partner API Key
    const partnerApiKey = req.headers.get('x-partner-key');
    if (!partnerApiKey) {
      return new Response(JSON.stringify({ error: 'Partner API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const partnerInfo = await validatePartnerApiKey(partnerApiKey, supabase);
    const url = new URL(req.url);

    // Apply white-label configuration
    const whiteLabelHeader = req.headers.get('x-white-label');
    const whiteLabelConfig = partnerInfo.white_label_config || {};

    if (req.method === 'GET' && url.pathname.includes('/services/') && url.pathname.includes('/summary')) {
      const serviceId = url.pathname.split('/')[4]; // /partner/v1/services/:id/summary
      const tenantId = url.searchParams.get('tenant_id');

      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'tenant_id parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

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
        .select(`
          *,
          visitor:visitors(name, visitor_code, member_status)
        `)
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
      const uniqueVisitors = new Set(attendance?.map(a => a.visitor_id).filter(Boolean)).size;
      const memberCount = attendance?.filter(a => a.visitor?.member_status === 'member').length || 0;
      const visitorCount = attendance?.filter(a => a.visitor?.member_status === 'visitor').length || 0;

      const summary = {
        service: {
          id: service.id,
          name: service.name,
          start_time: service.start_time,
          end_time: service.end_time,
          status: service.status,
          expected_attendance: service.expected_attendance
        },
        attendance: {
          total: totalAttendance,
          unique_visitors: uniqueVisitors,
          members: memberCount,
          visitors: visitorCount,
          attendance_rate: service.expected_attendance 
            ? ((totalAttendance / service.expected_attendance) * 100).toFixed(1) + '%'
            : null
        },
        events: {
          total_events: events?.length || 0,
          incidents: events?.filter(e => ['safety_incident', 'security_alert'].includes(e.event_type)).length || 0,
          peak_occupancy: Math.max(...(events?.map(e => e.person_count) || [0]))
        },
        white_label: whiteLabelConfig,
        processing_time_ms: Date.now() - startTime
      };

      // Record usage for billing
      EdgeRuntime.waitUntil(
        recordPartnerUsage(partnerInfo.partner_id, tenantId, 'services_summary', supabase)
      );

      return new Response(JSON.stringify(summary), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/events')) {
      const tenantId = url.searchParams.get('tenant_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      const eventType = url.searchParams.get('event_type');
      const limit = parseInt(url.searchParams.get('limit') || '100');

      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'tenant_id parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let query = supabase
        .from('church_events')
        .select('*')
        .eq('org_id', tenantId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }
      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data: events, error: eventsError } = await query;

      if (eventsError) {
        throw new Error(`Failed to fetch events: ${eventsError.message}`);
      }

      const response = {
        events: events || [],
        total_count: events?.length || 0,
        filters_applied: {
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate,
          event_type: eventType,
          limit
        },
        white_label: whiteLabelConfig,
        processing_time_ms: Date.now() - startTime
      };

      // Record usage for billing
      EdgeRuntime.waitUntil(
        recordPartnerUsage(partnerInfo.partner_id, tenantId, 'events', supabase)
      );

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/visitors/recurrence')) {
      const tenantId = url.searchParams.get('tenant_id');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');

      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'tenant_id parameter required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get visitor recurrence data
      let visitorQuery = supabase
        .from('visitors')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('visit_count', { ascending: false });

      if (startDate) {
        visitorQuery = visitorQuery.gte('first_visit', startDate);
      }
      if (endDate) {
        visitorQuery = visitorQuery.lte('last_visit', endDate);
      }

      const { data: visitors, error: visitorsError } = await visitorQuery;

      if (visitorsError) {
        throw new Error(`Failed to fetch visitors: ${visitorsError.message}`);
      }

      // Calculate recurrence analytics
      const totalVisitors = visitors?.length || 0;
      const firstTimeVisitors = visitors?.filter(v => v.visit_count === 1).length || 0;
      const returningVisitors = totalVisitors - firstTimeVisitors;
      const recurrenceRate = totalVisitors > 0 ? (returningVisitors / totalVisitors * 100).toFixed(1) : '0';

      // Group by visit count
      const visitCountDistribution = visitors?.reduce((acc, visitor) => {
        const count = visitor.visit_count;
        const bucket = count === 1 ? '1' : 
                      count <= 3 ? '2-3' :
                      count <= 5 ? '4-5' :
                      count <= 10 ? '6-10' : '11+';
        acc[bucket] = (acc[bucket] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Member vs visitor analysis
      const memberCount = visitors?.filter(v => v.member_status === 'member').length || 0;
      const visitorCount = visitors?.filter(v => v.member_status === 'visitor').length || 0;

      const response = {
        summary: {
          total_visitors: totalVisitors,
          first_time_visitors: firstTimeVisitors,
          returning_visitors: returningVisitors,
          recurrence_rate_percentage: parseFloat(recurrenceRate),
          member_count: memberCount,
          visitor_count: visitorCount
        },
        visit_count_distribution: visitCountDistribution,
        top_returning_visitors: visitors?.slice(0, 10).map(v => ({
          visitor_code: v.visitor_code,
          name: v.name,
          visit_count: v.visit_count,
          first_visit: v.first_visit,
          last_visit: v.last_visit,
          member_status: v.member_status
        })) || [],
        filters_applied: {
          tenant_id: tenantId,
          start_date: startDate,
          end_date: endDate
        },
        white_label: whiteLabelConfig,
        processing_time_ms: Date.now() - startTime
      };

      // Record usage for billing
      EdgeRuntime.waitUntil(
        recordPartnerUsage(partnerInfo.partner_id, tenantId, 'visitors_recurrence', supabase)
      );

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Partner API Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});