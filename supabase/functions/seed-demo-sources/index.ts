import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Curated public demo sources (stable samples and public cams)
const curated = [
  // Pessoas / Ocupação
  {
    analytic: "people_count",
    name: "LPL Library",
    url: "https://webcam1.lpl.org/mjpg/video.mjpg",
    protocol: "MJPEG",
    location: "Lobby de biblioteca",
    confidence: 85,
  },
  {
    analytic: "people_count",
    name: "Sparkassenplatz",
    url: "https://webcam.sparkassenplatz.info/cgi-bin/faststream.jpg?stream=full&fps=25",
    protocol: "JPEG_STREAM",
    location: "Praça urbana",
    confidence: 80,
  },
  {
    analytic: "people_count",
    name: "MVCC RomeCam",
    url: "https://romecam.mvcc.edu/mjpg/video.mjpg",
    protocol: "MJPEG",
    location: "Campus/Hall",
    confidence: 70,
  },

  // Veículos / Tráfego
  {
    analytic: "vehicle_count",
    name: "Anklam City",
    url: "https://webcam.anklam.de/axis-cgi/mjpg/video.cgi?resolution=CIF&clock=1&date=1",
    protocol: "MJPEG",
    location: "Centro urbano",
    confidence: 70,
  },
  {
    analytic: "vehicle_count",
    name: "Vliegveld Zeeland",
    url: "https://webcam.vliegveldzeeland.nl:7171/axis-cgi/mjpg/video.cgi",
    protocol: "MJPEG",
    location: "Aeródromo",
    confidence: 65,
  },
  {
    analytic: "vehicle_count",
    name: "Larimer Lot",
    url: "https://htadmcam01.larimer.org/mjpg/video.mjpg",
    protocol: "MJPEG",
    location: "Estacionamento/via",
    confidence: 65,
  },

  // Pátio industrial / Obra
  {
    analytic: "safety",
    name: "Lafarge Yard",
    url: "http://lafarge.sarl2e.fr:3100/mjpg/video.mjpg",
    protocol: "MJPEG",
    location: "Pátio industrial",
    confidence: 60,
  },

  // HLS de teste para transporte/airport (útil para validar HLS)
  {
    analytic: "airport",
    name: "Mux Test (HLS)",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    protocol: "HLS",
    location: "HLS de teste",
    confidence: 50,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Deactivate clearly broken patterns (e.g., YouTube watch links which won't HLS directly)
    await admin.from("demo_sources").update({ active: false }).ilike("url", "%youtube%");

    let inserted = 0;
    let updated = 0;

    for (const s of curated) {
      const { data: existing } = await admin
        .from("demo_sources")
        .select("id")
        .eq("analytic", s.analytic)
        .eq("name", s.name)
        .maybeSingle();

      if (existing?.id) {
        const { error: upErr } = await admin
          .from("demo_sources")
          .update({
            url: s.url,
            protocol: s.protocol,
            location: s.location,
            confidence: s.confidence,
            active: true,
          })
          .eq("id", existing.id);
        if (!upErr) updated += 1;
      } else {
        const { error: insErr } = await admin.from("demo_sources").insert({
          analytic: s.analytic,
          name: s.name,
          url: s.url,
          protocol: s.protocol,
          location: s.location,
          confidence: s.confidence,
          active: true,
        });
        if (!insErr) inserted += 1;
      }
    }

    const body = { ok: true, curated: curated.length, inserted, updated };
    console.log("seed-demo-sources:", body);
    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("seed-demo-sources error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
