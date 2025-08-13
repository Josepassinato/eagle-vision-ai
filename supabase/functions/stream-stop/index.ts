import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StreamStopRequest {
  camera_id: string;
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

    const { camera_id }: StreamStopRequest = await req.json();

    // Update camera status to offline
    const { error: cameraError } = await supabase
      .from('cameras')
      .update({
        online: false,
        last_seen: new Date().toISOString()
      })
      .eq('id', camera_id);

    if (cameraError) throw cameraError;

    console.log(`Stopped processing for camera ${camera_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        camera_id,
        message: "Stream processing stopped"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Stream stop error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});