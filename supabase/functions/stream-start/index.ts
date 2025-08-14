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

    // Get user's organization
    const { data: orgData, error: orgError } = await supabase
      .from('org_users')
      .select('org_id')
      .eq('user_id', userData.user.id)
      .single();

    const orgId = orgData?.org_id || null;

    // Update camera status
    const { error: cameraError } = await supabase
      .from('cameras')
      .upsert({
        id: camera_id,
        name: `Camera ${camera_id}`,
        stream_url,
        online: true,
        last_seen: new Date().toISOString(),
        org_id: orgId
      });

    if (cameraError) throw cameraError;

    // Simulate analytics processing without infinite loops
    // In a real implementation, this would start external frame processors
    
    // Instead of setInterval, just simulate a few detections
    try {
      const frameId = `frame_${camera_id}_${Date.now()}`;
      
      // Generate simulated detection
      const simulatedDetection = {
        frame_id: frameId,
        camera_id,
        org_id: orgId,
        service: 'demo-analytics',
        detection_type: Math.random() > 0.5 ? 'person' : 'vehicle',
        confidence: 0.75 + Math.random() * 0.25,
        bbox: [
          Math.random() * 0.5,
          Math.random() * 0.5, 
          0.5 + Math.random() * 0.3,
          0.5 + Math.random() * 0.3
        ],
        metadata: {
          analytics_enabled,
          demo_mode: true,
          timestamp: new Date().toISOString()
        }
      };

      // Store simulated detection
      await supabase.from('detections').insert(simulatedDetection);
      
      console.log(`Started processing simulation for camera ${camera_id}`);
    } catch (error) {
      console.error("Simulation setup error:", error);
    }

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