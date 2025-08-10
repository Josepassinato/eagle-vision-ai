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
    case "edubehavior":
      return "edubehavior";
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

  // Service-role client for privileged operations (bypasses RLS)
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = serviceKey
    ? createClient(supabaseUrl, serviceKey)
    : null;

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

      // Base UI hint
      let ui_hint: any = {
        expected_fps: source.protocol === "MJPEG" ? 10 : 15,
        latency_ms: source.protocol === "MJPEG" ? 800 : 1200,
        requires_proxy: source.protocol === "HLS" || source.url.includes("youtube.com"),
      };

      // Convert RTSP to HLS when public MediaMTX base is configured
      let stream_url = source.url as string;
      let protocolOut = source.protocol as string;
      if (source.protocol === "RTSP") {
        const base = Deno.env.get("MEDIAMTX_PUBLIC_BASE"); // e.g., https://stream.example.com:8888
        try {
          const u = new URL(source.url);
          const path = u.pathname.replace(/^\//, "");
          if (base) {
            const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
            stream_url = `${trimmed}/${path}/index.m3u8`;
            protocolOut = "HLS";
            ui_hint = { ...ui_hint, requires_proxy: false, expected_fps: 15, latency_ms: 1200 };
          } else {
            // No public base configured; keep RTSP and mark as requiring proxy
            ui_hint = { ...ui_hint, requires_proxy: true };
          }
        } catch (_) {
          // Fallback: keep original
        }
      }

      // Compute 3-minute expiry and cleanup expired bindings
      const now = new Date();
      const expires_at = new Date(now.getTime() + 3 * 60 * 1000).toISOString();
      const clientForMaintenance = supabaseAdmin ?? supabase;
      try {
        await clientForMaintenance
          .from("demo_bindings")
          .delete()
          .lt("params->>expires_at", now.toISOString());
      } catch (_) {
        // best-effort cleanup
      }

      // Persist binding (use service role to bypass RLS)
      const clientForInsert = supabaseAdmin ?? supabase;
      const { error: insertErr } = await clientForInsert.from("demo_bindings").insert({
        demo_id: source.id,
        service,
        params: {
          session_id,
          camera_alias: body.camera_alias ?? null,
          protocol: protocolOut,
          url: stream_url,
          ui_hint,
          expires_at,
          analytic: source.analytic,
        },
      });
      if (insertErr) throw insertErr;

      // Return computed stream URL
      const payload = {
        session_id,
        stream_url,
        protocol: protocolOut,
        source,
        ui_hint,
        expires_at,
      };
      console.log("demo-router start:", payload);
      return new Response(JSON.stringify(payload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "stop") {
      const { session_id } = body as StopBody;
      // Best-effort cleanup: delete bindings with this session_id in params
      const clientForDelete = supabaseAdmin ?? supabase;
      const { error: delErr } = await clientForDelete
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
