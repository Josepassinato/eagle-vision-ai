import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-org-id",
};

async function validateOrgAccess(supabase: any, orgId: string, authHeader: string | null) {
  // Check if using API key
  const apiKey = authHeader?.startsWith('Bearer ak_') ? authHeader.replace('Bearer ', '') : null;
  
  if (apiKey) {
    const { data: keyData, error: keyError } = await supabase
      .from('org_api_keys')
      .select('org_id')
      .eq('secret', apiKey)
      .single();
    
    if (keyError || !keyData || keyData.org_id !== orgId) {
      return { valid: false, error: "Invalid API key or organization access" };
    }
    
    return { valid: true, orgId: keyData.org_id };
  }

  // Check user authentication
  if (!authHeader) {
    return { valid: false, error: "Authorization required" };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return { valid: false, error: "Invalid authentication" };
  }

  // Check user belongs to org
  const { data: orgUser, error: orgError } = await supabase
    .from('org_users')
    .select('org_id')
    .eq('user_id', userData.user.id)
    .eq('org_id', orgId)
    .single();

  if (orgError || !orgUser) {
    return { valid: false, error: "Access denied to organization" };
  }

  return { valid: true, orgId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[DEVICE-LINK] Starting device linking");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { org_id, device_id, device_name, device_type = "edge_appliance", location } = await req.json();

    if (!org_id || !device_id) {
      return new Response(JSON.stringify({ error: "org_id and device_id are required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Validate organization access
    const authHeader = req.headers.get("Authorization");
    const access = await validateOrgAccess(supabase, org_id, authHeader);
    if (!access.valid) {
      return new Response(JSON.stringify({ error: access.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    // Set org context for RLS
    await supabase.rpc('set_config', {
      parameter: 'request.org_id',
      value: org_id
    });

    console.log(`[DEVICE-LINK] Linking device for org: ${org_id}, device: ${device_id}`);

    // Check if device already exists
    const { data: existingDevice, error: checkError } = await supabase
      .from('edge_devices')
      .select('*')
      .eq('device_id', device_id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error("[DEVICE-LINK] Error checking existing device:", checkError);
      return new Response(JSON.stringify({ error: "Failed to check device status" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (existingDevice) {
      if (existingDevice.org_id === org_id) {
        // Device already linked to this org
        return new Response(JSON.stringify({
          success: true,
          message: "Device already linked to this organization",
          device_id: existingDevice.device_id,
          status: existingDevice.status,
          linked_at: existingDevice.linked_at
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      } else {
        // Device linked to different org
        return new Response(JSON.stringify({ error: "Device is already linked to another organization" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 409,
        });
      }
    }

    // Create new device link
    const { data: device, error: deviceError } = await supabase
      .from('edge_devices')
      .insert({
        org_id,
        device_id,
        device_name: device_name || `Edge Device ${device_id.slice(-8)}`,
        device_type,
        location,
        status: 'linked',
        linked_at: new Date().toISOString(),
        metadata: {
          edge_mode: true,
          metadata_only: true,
          clip_upload_policy: "on_demand",
          max_local_storage_gb: 100
        }
      })
      .select()
      .single();

    if (deviceError) {
      console.error("[DEVICE-LINK] Failed to create device:", deviceError);
      return new Response(JSON.stringify({ error: "Failed to link device" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Generate device configuration
    const deviceConfig = {
      device_id,
      org_id,
      supabase_url: Deno.env.get("SUPABASE_URL"),
      api_endpoint: `${Deno.env.get("SUPABASE_URL")}/functions/v1`,
      upload_policy: "metadata_only",
      clip_retention_days: 7,
      sync_interval_minutes: 5,
      health_check_interval_minutes: 1
    };

    console.log(`[DEVICE-LINK] Device linked successfully: ${device_id}`);

    return new Response(JSON.stringify({
      success: true,
      device_id: device.device_id,
      device_name: device.device_name,
      status: device.status,
      linked_at: device.linked_at,
      config: deviceConfig,
      message: "Device successfully linked to organization"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("[DEVICE-LINK] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});