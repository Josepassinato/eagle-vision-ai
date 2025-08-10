import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { session_id } = await req.json().catch(() => ({ session_id: undefined }));
  if (!session_id) {
    return new Response(JSON.stringify({ error: "session_id ausente" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2023-10-16",
  });

  const supabaseAnon = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseService = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: session?.payment_status || "unpaid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const metadata = session.metadata || {};
    const user_id = metadata.user_id;
    const credits = Number(metadata.credits || 0);
    const amount = Number(metadata.amount || 0);
    const currency = String(metadata.currency || "BRL");

    if (!user_id || !credits) throw new Error("Metadados insuficientes para crédito");

    // Idempotência: já processado?
    const { data: existing } = await supabaseService
      .from("payment_sessions")
      .select("stripe_session_id, status")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    if (existing && existing.status === "paid") {
      return new Response(JSON.stringify({ credited: false, already: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Upsert session
    await supabaseService.from("payment_sessions").upsert({
      stripe_session_id: session.id,
      user_id,
      credits,
      amount,
      currency,
      status: "paid",
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_session_id" });

    // Credit the user
    const { error: ledgerErr } = await supabaseService.from("credit_ledger").insert({
      user_id,
      delta: credits,
      reason: "purchase",
      metadata: { session_id: session.id, amount, currency },
    });
    if (ledgerErr) throw ledgerErr;

    return new Response(JSON.stringify({ credited: true, credits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
