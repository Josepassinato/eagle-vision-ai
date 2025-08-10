import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type StartBody = {
  action: "start";
  analytic?: string;
  demo_id?: string | null;
  camera_alias?: string | null;
};

type StopBody = {
  action: "stop";
  session_id: string;
};

type Body = StartBody | StopBody;

function analyticToService(a: string): string {
  switch (a) {
    case "people_count":
      return "fusion"; // central pipeline
    case "vehicle_count":
    case "alpr":
      return "fusion"; // fusion + lpr when available
    case "safety":
      return "safetyvision";
    case "airport":
      return "fusion";
    default:
      return "fusion";
  }
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnon) {
    console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY envs");
    return new Response(JSON.stringify({ error: "Server not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader ?? "" } },
  });

  try {
    const body = (await req.json()) as Body;

    if (body.action === "start") {
      const analytic = body.analytic ?? "people_count";

      // Pick source by demo_id or analytic
      let source: any | null = null;
      if (body.demo_id) {
        const { data, error } = await supabase
          .from("demo_sources")
          .select("*")
          .eq("id", body.demo_id)
          .eq("active", true)
          .maybeSingle();
        if (error) throw error;
        source = data;
      } else {
        const { data, error } = await supabase
          .from("demo_sources")
          .select("*")
          .eq("analytic", analytic)
          .eq("active", true)
          .order("confidence", { ascending: false })
          .limit(1);
        if (error) throw error;
        source = data && data.length ? data[0] : null;
      }

      if (!source) {
        return new Response(
          JSON.stringify({ error: "No active demo source found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const session_id = crypto.randomUUID();
      const service = analyticToService(source.analytic);

      const ui_hint = {
        expected_fps: source.protocol === "MJPEG" ? 10 : 15,
        latency_ms: source.protocol === "MJPEG" ? 800 : 1200,
        requires_proxy: source.protocol === "HLS" || source.url.includes("youtube.com"),
      };

      // Persist binding (admin/service policies allow insert)
      const { error: insertErr } = await supabase.from("demo_bindings").insert({
        demo_id: source.id,
        service,
        params: {
          session_id,
          camera_alias: body.camera_alias ?? null,
          protocol: source.protocol,
          url: source.url,
          ui_hint,
        },
      });
      if (insertErr) throw insertErr;

      // For now, stream_url is the original source; a proxy can be added later if needed
      const payload = {
        session_id,
        stream_url: source.url,
        protocol: source.protocol,
        source,
        ui_hint,
      };
      console.log("demo-router start:", payload);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "stop") {
      const { session_id } = body as StopBody;
      // Best-effort cleanup: delete bindings with this session_id in params
      const { error: delErr } = await supabase
        .from("demo_bindings")
        .delete()
        .eq("params->>session_id", session_id);
      if (delErr) {
        console.warn("demo-router stop delete warning:", delErr.message);
      }
      return new Response(JSON.stringify({ ok: true, session_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("demo-router error:", e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
