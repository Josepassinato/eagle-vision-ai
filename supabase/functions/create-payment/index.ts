import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PACKAGES: Record<string, { credits: number; amount: number; name: string }>
  = {
    CREDITS_1000: { credits: 1000, amount: 5000, name: "Pacote 1.000 créditos" },
    CREDITS_5000: { credits: 5000, amount: 25000, name: "Pacote 5.000 créditos" },
    CREDITS_20000: { credits: 20000, amount: 100000, name: "Pacote 20.000 créditos" },
  };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const { sku } = await req.json();
    const pack = PACKAGES[sku as string];
    if (!pack) {
      return new Response(JSON.stringify({ error: "SKU inválida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabase.auth.getUser(token);
    const user = userRes.user;
    if (!user?.email) throw new Error("Usuário não autenticado");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const origin = req.headers.get("origin") || "https://";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "brl",
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: { name: pack.name },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/app/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/credits`,
      metadata: {
        user_id: user.id,
        user_email: user.email,
        credits: String(pack.credits),
        amount: String(pack.amount),
        currency: "BRL",
        sku,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
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
