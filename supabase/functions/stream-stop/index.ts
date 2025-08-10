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

async function decommissionWorker(workerDetails: any) {
  // In a real implementation, this would:
  // 1. Stop the processing pipeline
  // 2. Delete the Kubernetes pod
  // 3. Clean up any resources
  // 4. Save final metrics
  
  if (!workerDetails.worker_id) {
    console.log("[DECOMMISSION] No worker to decommission");
    return;
  }

  console.log(`[DECOMMISSION] Stopping worker: ${workerDetails.worker_id}, pod: ${workerDetails.pod_name}`);

  // Simulate decommissioning delay
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log(`[DECOMMISSION] Worker decommissioned: ${workerDetails.worker_id}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[STREAM-STOP] Stopping stream");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { org_id, stream_id } = await req.json();

    if (!org_id || !stream_id) {
      return new Response(JSON.stringify({ error: "org_id and stream_id are required" }), {
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

    console.log(`[STREAM-STOP] Stopping stream for org: ${org_id}, stream: ${stream_id}`);

    // Get stream details
    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .select('*')
      .eq('id', stream_id)
      .eq('org_id', org_id)
      .single();

    if (streamError || !stream) {
      return new Response(JSON.stringify({ error: "Stream not found or access denied" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (stream.status === 'stopped') {
      return new Response(JSON.stringify({ 
        success: true,
        message: "Stream already stopped",
        stream_id,
        status: 'stopped'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Calculate runtime for billing
    const startedAt = stream.started_at ? new Date(stream.started_at) : new Date(stream.created_at);
    const stoppedAt = new Date();
    const runtimeMinutes = Math.ceil((stoppedAt.getTime() - startedAt.getTime()) / (1000 * 60));

    console.log(`[STREAM-STOP] Stream runtime: ${runtimeMinutes} minutes`);

    // Decommission worker
    try {
      await decommissionWorker({
        worker_id: stream.worker_id,
        pod_name: stream.pod_name
      });
    } catch (decommissionError) {
      console.error("[STREAM-STOP] Decommission failed:", decommissionError);
      // Continue with stopping the stream even if decommission fails
    }

    // Update stream status
    const { error: updateError } = await supabase
      .from('streams')
      .update({
        status: 'stopped',
        stopped_at: stoppedAt.toISOString()
      })
      .eq('id', stream_id);

    if (updateError) {
      console.error("[STREAM-STOP] Failed to update stream:", updateError);
      return new Response(JSON.stringify({ error: "Failed to update stream status" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Record usage for billing
    if (runtimeMinutes > 0) {
      const { error: usageError } = await supabase
        .from('usage_events')
        .insert({
          org_id,
          stream_id,
          metric_type: 'stream_minutes',
          quantity: runtimeMinutes,
          period_start: startedAt.toISOString(),
          period_end: stoppedAt.toISOString(),
          metadata: {
            analytic: stream.analytic,
            camera_id: stream.camera_id
          }
        });

      if (usageError) {
        console.error("[STREAM-STOP] Failed to record usage:", usageError);
      } else {
        console.log(`[STREAM-STOP] Recorded ${runtimeMinutes} minutes of usage`);
      }
    }

    // Check if this was the last active stream for the camera
    const { data: otherStreams, error: otherStreamsError } = await supabase
      .from('streams')
      .select('id')
      .eq('camera_id', stream.camera_id)
      .eq('status', 'running');

    if (!otherStreamsError && (!otherStreams || otherStreams.length === 0)) {
      // Update camera status to offline
      await supabase
        .from('cameras')
        .update({ online: false })
        .eq('id', stream.camera_id);
      
      console.log(`[STREAM-STOP] Camera ${stream.camera_id} marked offline`);
    }

    console.log(`[STREAM-STOP] Stream stopped successfully: ${stream_id}`);

    return new Response(JSON.stringify({
      success: true,
      stream_id,
      status: 'stopped',
      runtime_minutes: runtimeMinutes,
      stopped_at: stoppedAt.toISOString(),
      camera_id: stream.camera_id,
      analytic: stream.analytic
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[STREAM-STOP] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});