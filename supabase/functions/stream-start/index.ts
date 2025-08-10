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

async function provisionWorker(analytic: string, orgId: string, streamId: string) {
  // In a real implementation, this would:
  // 1. Check if Kubernetes cluster has capacity
  // 2. Deploy a pod with the appropriate analytic worker
  // 3. Configure the worker to process the stream
  // 4. Return worker details
  
  const workerMap: Record<string, string> = {
    peoplevision: 'people-detector',
    vehiclevision: 'vehicle-detector', 
    safetyvision: 'safety-monitor',
    edubehavior: 'education-behavior',
    alpr: 'license-plate-reader'
  };

  const workerId = `${workerMap[analytic] || analytic}-${streamId.slice(-8)}`;
  const podName = `${workerId}-${Date.now()}`;

  console.log(`[PROVISION] Would deploy pod: ${podName} for analytic: ${analytic}`);

  // Simulate provisioning delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  return {
    worker_id: workerId,
    pod_name: podName,
    rtmp_url: `rtmp://mediamtx-service:1935/live/${streamId}`,
    hls_url: `https://your-domain.com/hls/${streamId}/index.m3u8`
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[STREAM-START] Starting stream");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { org_id, camera_id, analytic } = await req.json();

    if (!org_id || !camera_id || !analytic) {
      return new Response(JSON.stringify({ error: "org_id, camera_id, and analytic are required" }), {
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

    console.log(`[STREAM-START] Starting stream for org: ${org_id}, camera: ${camera_id}, analytic: ${analytic}`);

    // Check if camera exists and belongs to org
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', camera_id)
      .eq('org_id', org_id)
      .single();

    if (cameraError || !camera) {
      return new Response(JSON.stringify({ error: "Camera not found or access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Check quotas
    const { data: quota, error: quotaError } = await supabase
      .from('quotas')
      .select('*')
      .eq('org_id', org_id)
      .single();

    if (quotaError || !quota) {
      return new Response(JSON.stringify({ error: "No quota configuration found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Check active streams count
    const { data: activeStreams, error: streamsError } = await supabase
      .from('streams')
      .select('id')
      .eq('org_id', org_id)
      .eq('status', 'running');

    if (streamsError) {
      console.error("[STREAM-START] Failed to check active streams:", streamsError);
      return new Response(JSON.stringify({ error: "Failed to check quota limits" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (activeStreams && activeStreams.length >= quota.max_streams) {
      return new Response(JSON.stringify({ 
        error: `Stream limit reached. Maximum ${quota.max_streams} streams allowed for your plan.` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    // Create stream record
    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .insert({
        org_id,
        camera_id,
        analytic,
        status: 'provisioning',
        source_url: camera.stream_url
      })
      .select()
      .single();

    if (streamError) {
      console.error("[STREAM-START] Failed to create stream:", streamError);
      return new Response(JSON.stringify({ error: "Failed to create stream" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`[STREAM-START] Created stream record: ${stream.id}`);

    // Provision worker (simulate Kubernetes deployment)
    try {
      const workerDetails = await provisionWorker(analytic, org_id, stream.id);

      // Update stream with worker details and mark as running
      const { error: updateError } = await supabase
        .from('streams')
        .update({
          status: 'running',
          worker_id: workerDetails.worker_id,
          pod_name: workerDetails.pod_name,
          rtmp_url: workerDetails.rtmp_url,
          hls_url: workerDetails.hls_url,
          started_at: new Date().toISOString()
        })
        .eq('id', stream.id);

      if (updateError) {
        console.error("[STREAM-START] Failed to update stream:", updateError);
      }

      // Update camera status
      await supabase
        .from('cameras')
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq('id', camera_id);

      console.log(`[STREAM-START] Stream started successfully: ${stream.id}`);

      return new Response(JSON.stringify({
        success: true,
        stream_id: stream.id,
        camera_id,
        analytic,
        status: 'running',
        worker_id: workerDetails.worker_id,
        rtmp_url: workerDetails.rtmp_url,
        hls_url: workerDetails.hls_url,
        started_at: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });

    } catch (provisionError) {
      console.error("[STREAM-START] Provisioning failed:", provisionError);
      
      // Update stream status to failed
      await supabase
        .from('streams')
        .update({ status: 'failed' })
        .eq('id', stream.id);

      return new Response(JSON.stringify({ error: "Failed to provision worker" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

  } catch (error) {
    console.error("[STREAM-START] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});