import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function parseAllowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS") || "https://panel.inigrai.com";
  return env.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = parseAllowedOrigins();
  const isAllowed = allowed.includes(origin);
  const base = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vision-auth",
  } as Record<string, string>;
  if (isAllowed) base["Access-Control-Allow-Origin"] = origin;
  return { headers: base, isAllowed };
}

serve(async (req) => {
  console.log(`Received ${req.method} request to ingest_event`);

  // Preflight
  if (req.method === "OPTIONS") {
    const { headers, isAllowed } = corsHeadersFor(req);
    return new Response(null, { status: isAllowed ? 204 : 403, headers });
  }

  try {
    const { headers, isAllowed } = corsHeadersFor(req);
    if (!isAllowed) {
      return new Response("CORS not allowed", { status: 403, headers });
    }

    // Header secreto obrigatório
    const AUTH = req.headers.get("x-vision-auth");
    const expectedAuth = Deno.env.get("VISION_WEBHOOK_SECRET");
    if (!AUTH || !expectedAuth || AUTH !== expectedAuth) {
      console.error("Unauthorized access attempt");
      return new Response("unauthorized", { status: 401, headers });
    }

    // Parse payload
    const payload = await req.json();
    const { camera_id, person_id, reason, face_similarity, reid_similarity, frames_confirmed, movement_px, ts } = payload;

    // Supabase client (service role)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response("Internal server error - missing configuration", { status: 500, headers });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert event
    const { data, error } = await supabase.from("events").insert({
      camera_id,
      person_id,
      reason,
      face_similarity,
      reid_similarity,
      frames_confirmed,
      movement_px,
      ts: ts || new Date().toISOString(),
    }).select();

    if (error) {
      console.error("Database error:", error);
      return new Response(error.message, { status: 500, headers });
    }

    return new Response(JSON.stringify({ success: true, event_id: data[0]?.id }), {
      status: 200,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    const { headers } = corsHeadersFor(req);
    return new Response("Internal server error", { status: 500, headers });
  }
});
