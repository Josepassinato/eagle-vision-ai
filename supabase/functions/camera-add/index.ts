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
    console.log("[CAMERA-ADD] Starting camera addition");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { org_id, name, source_url } = await req.json();

    if (!org_id || !name || !source_url) {
      return new Response(JSON.stringify({ error: "org_id, name, and source_url are required" }), {
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

    console.log(`[CAMERA-ADD] Adding camera for org: ${org_id}`);

    // Generate camera ID
    const cameraId = `cam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create camera
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .insert({
        id: cameraId,
        name,
        stream_url: source_url,
        org_id,
        online: false
      })
      .select()
      .single();

    if (cameraError) {
      console.error("[CAMERA-ADD] Failed to create camera:", cameraError);
      return new Response(JSON.stringify({ error: "Failed to create camera" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create default camera config
    const { error: configError } = await supabase
      .from('camera_configs')
      .insert({
        camera_id: cameraId,
        person_threshold: 0.5,
        vehicle_threshold: 0.5,
        counting_lines: null
      });

    if (configError) {
      console.error("[CAMERA-ADD] Failed to create camera config:", configError);
    }

    console.log(`[CAMERA-ADD] Camera created successfully: ${cameraId}`);

    return new Response(JSON.stringify({
      success: true,
      camera_id: cameraId,
      name: camera.name,
      source_url: camera.stream_url,
      status: 'offline',
      created_at: camera.created_at
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("[CAMERA-ADD] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});