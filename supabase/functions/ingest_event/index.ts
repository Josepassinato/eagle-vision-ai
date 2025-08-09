import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-vision-auth',
};

serve(async (req) => {
  console.log(`Received ${req.method} request to ingest_event`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via header personalizado
    const AUTH = req.headers.get("x-vision-auth");
    const expectedAuth = Deno.env.get("VISION_WEBHOOK_SECRET");

    if (!AUTH || !expectedAuth || AUTH !== expectedAuth) {
      console.error("Unauthorized access attempt");
      return new Response("unauthorized", { 
        status: 401,
        headers: corsHeaders 
      });
    }

    // Parse do payload
    const payload = await req.json();
    console.log("Received payload:", payload);

    const { 
      camera_id, 
      person_id, 
      reason, 
      face_similarity, 
      reid_similarity, 
      frames_confirmed, 
      movement_px, 
      ts 
    } = payload;

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response("Internal server error - missing configuration", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Inserir evento na tabela events
    const { data, error } = await supabase.from("events").insert({
      camera_id,
      person_id,
      reason,
      face_similarity,
      reid_similarity,
      frames_confirmed,
      movement_px,
      ts: ts || new Date().toISOString()
    }).select();

    if (error) {
      console.error("Database error:", error);
      return new Response(error.message, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    console.log("Event inserted successfully:", data);

    return new Response(JSON.stringify({ 
      success: true, 
      event_id: data[0]?.id 
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("Internal server error", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});