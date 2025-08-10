import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || (await req.json().catch(() => ({}))).action || "start";

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: u } = await supabaseAuth.auth.getUser(token);
    const user = u.user;
    if (!user) throw new Error("Não autenticado");

    const demoPrefix = `demo-${user.id}-`;

    if (action === "reset") {
      // Clean up demo data
      await supabase.from("vehicle_events").delete().ilike("camera_id", `${demoPrefix}%`);
      await supabase.from("events").delete().ilike("camera_id", `${demoPrefix}%`);
      await supabase.from("cameras").delete().ilike("id", `${demoPrefix}%`);
      await supabase.from("credit_ledger").delete().eq("user_id", user.id).contains("metadata", { demo: true });

      return new Response(JSON.stringify({ ok: true, action: "reset" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Start: first cleanup to idempotency
    await supabase.from("vehicle_events").delete().ilike("camera_id", `${demoPrefix}%`);
    await supabase.from("events").delete().ilike("camera_id", `${demoPrefix}%`);
    await supabase.from("cameras").delete().ilike("id", `${demoPrefix}%`);
    await supabase.from("credit_ledger").delete().eq("user_id", user.id).contains("metadata", { demo: true });

    const now = new Date();

    // Create 3 demo cameras
    const cameras = [1, 2, 3].map((i) => ({
      id: `${demoPrefix}${i}`,
      name: `Câmera Demo ${i}`,
      online: true,
      stream_url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      last_seen: now.toISOString(),
    }));
    await supabase.from("cameras").insert(cameras);

    // Generate events for last 2 hours (per camera)
    const events: any[] = [];
    const vehicleEvents: any[] = [];
    for (let i = 0; i < 120; i += 5) {
      const ts = new Date(now.getTime() - i * 60 * 1000).toISOString();
      for (const cam of cameras) {
        const n = randInt(0, 2);
        for (let k = 0; k < n; k++) {
          events.push({
            ts,
            camera_id: cam.id,
            reason: "motion",
            frames_confirmed: randInt(1, 3),
            movement_px: Math.random() * 100,
          });
          if (Math.random() < 0.3) {
            vehicleEvents.push({
              ts,
              camera_id: cam.id,
              plate: `DEMO${randInt(1000, 9999)}`,
              confidence: Math.random(),
            });
          }
        }
      }
    }

    if (events.length) await supabase.from("events").insert(events);
    if (vehicleEvents.length) await supabase.from("vehicle_events").insert(vehicleEvents);

    // Credit grant and consumption based on events
    const grant = 1000; // demo grant
    const consumption = Math.min(events.length, 600); // cap consumption for demo

    await supabase.from("credit_ledger").insert([
      { user_id: user.id, delta: grant, reason: "demo-grant", metadata: { demo: true } },
      { user_id: user.id, delta: -consumption, reason: "demo-consumption", metadata: { demo: true, per_event_cost: 1 } },
    ]);

    return new Response(
      JSON.stringify({ ok: true, action: "start", cameras: cameras.length, events: events.length, vehicleEvents: vehicleEvents.length, grant, consumption }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
