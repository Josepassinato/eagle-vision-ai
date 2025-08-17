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

    if (req.method === 'GET' && url.pathname.includes('/live')) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      // Get current occupancy by zone from recent events
      const { data: recentEvents } = await supabase
        .from('church_events')
        .select('camera_id, zone_name, person_count, timestamp, event_type')
        .eq('org_id', tenantId)
        .gte('timestamp', fiveMinutesAgo)
        .order('timestamp', { ascending: false });

      // Get church zones configuration
      const { data: zones } = await supabase
        .from('church_zones')
        .select('*')
        .eq('org_id', tenantId)
        .eq('is_active', true);

      // Get active services
      const now = new Date().toISOString();
      const { data: activeServices } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .lte('start_time', now)
        .or(`end_time.is.null,end_time.gte.${now}`);

      // Calculate current occupancy per zone
      const occupancyByZone = new Map();
      const occupancyByCamera = new Map();

      // Initialize with zones
      zones?.forEach(zone => {
        occupancyByZone.set(`${zone.camera_id}-${zone.zone_name}`, {
          camera_id: zone.camera_id,
          zone_name: zone.zone_name,
          zone_type: zone.zone_type,
          current_count: 0,
          last_updated: null,
          max_capacity: zone.metadata?.max_capacity || null,
          privacy_level: zone.privacy_level
        });
      });

      // Process recent events to get latest counts
      recentEvents?.forEach(event => {
        const zoneKey = `${event.camera_id}-${event.zone_name}`;
        if (occupancyByZone.has(zoneKey)) {
          const current = occupancyByZone.get(zoneKey);
          if (!current.last_updated || event.timestamp > current.last_updated) {
            current.current_count = event.person_count || 0;
            current.last_updated = event.timestamp;
          }
        }

        // Camera level aggregation
        if (!occupancyByCamera.has(event.camera_id)) {
          occupancyByCamera.set(event.camera_id, {
            camera_id: event.camera_id,
            total_count: 0,
            last_updated: event.timestamp
          });
        }
        const cameraData = occupancyByCamera.get(event.camera_id);
        if (event.timestamp > cameraData.last_updated) {
          cameraData.total_count = Math.max(cameraData.total_count, event.person_count || 0);
          cameraData.last_updated = event.timestamp;
        }
      });

      const liveOccupancy = {
        timestamp: new Date().toISOString(),
        zones: Array.from(occupancyByZone.values()),
        cameras: Array.from(occupancyByCamera.values()),
        active_services: activeServices?.map(service => ({
          id: service.id,
          name: service.name,
          start_time: service.start_time,
          expected_attendance: service.expected_attendance
        })) || [],
        total_occupancy: Array.from(occupancyByCamera.values())
          .reduce((sum, camera) => sum + camera.total_count, 0),
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(liveOccupancy), {
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