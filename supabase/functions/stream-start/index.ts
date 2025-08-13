import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StreamStartRequest {
  camera_id: string;
  stream_url: string;
  analytics_enabled: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: userData } = await supabaseAuth.auth.getUser(token);
    if (!userData.user) {
      throw new Error("Unauthorized");
    }

    const { camera_id, stream_url, analytics_enabled }: StreamStartRequest = await req.json();

    // Update camera status
    const { error: cameraError } = await supabase
      .from('cameras')
      .upsert({
        id: camera_id,
        name: `Camera ${camera_id}`,
        stream_url,
        online: true,
        last_seen: new Date().toISOString(),
        org_id: userData.user.id // For demo, using user_id as org_id
      });

    if (cameraError) throw cameraError;

    // Start frame processing simulation
    const frameProcessingInterval = setInterval(async () => {
      try {
        const frameId = `frame_${camera_id}_${Date.now()}`;
        
        // Call analytics processor
        const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analytics-processor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'x-api-key': 'demo-key',
            'x-org-id': userData.user.id
          },
          body: JSON.stringify({
            frame_id: frameId,
            camera_id,
            timestamp: new Date().toISOString(),
            analytics_enabled
          })
        });

        if (!response.ok) {
          console.error(`Analytics processing failed: ${response.status}`);
        }
      } catch (error) {
        console.error("Frame processing error:", error);
      }
    }, 1000); // Process 1 frame per second

    // Store interval ID for cleanup (in real implementation, use Redis or similar)
    console.log(`Started processing for camera ${camera_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        camera_id,
        message: "Stream processing started",
        analytics_enabled
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Stream start error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});