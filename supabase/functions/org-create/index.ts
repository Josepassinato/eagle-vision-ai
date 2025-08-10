import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[ORG-CREATE] Starting organization creation");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { name, plan = "starter" } = await req.json();

    if (!name) {
      return new Response(JSON.stringify({ error: "Organization name is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = userData.user.id;
    console.log(`[ORG-CREATE] Creating org for user: ${userId}`);

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .insert({
        name,
        plan
      })
      .select()
      .single();

    if (orgError) {
      console.error("[ORG-CREATE] Failed to create organization:", orgError);
      return new Response(JSON.stringify({ error: "Failed to create organization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    console.log(`[ORG-CREATE] Created organization: ${org.id}`);

    // Add user as owner
    const { error: userRoleError } = await supabase
      .from('org_users')
      .insert({
        org_id: org.id,
        user_id: userId,
        role: 'owner'
      });

    if (userRoleError) {
      console.error("[ORG-CREATE] Failed to add user to organization:", userRoleError);
      return new Response(JSON.stringify({ error: "Failed to add user to organization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Create default quotas
    const { error: quotaError } = await supabase
      .from('quotas')
      .insert({
        org_id: org.id,
        max_streams: plan === 'starter' ? 2 : plan === 'pro' ? 10 : 50,
        max_storage_gb: plan === 'starter' ? 10 : plan === 'pro' ? 100 : 1000,
        max_minutes_month: plan === 'starter' ? 2000 : plan === 'pro' ? 20000 : 100000,
        overage_allowed: plan !== 'starter'
      });

    if (quotaError) {
      console.error("[ORG-CREATE] Failed to create quotas:", quotaError);
    }

    // Generate API key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .rpc('generate_api_key');

    if (apiKeyError) {
      console.error("[ORG-CREATE] Failed to generate API key:", apiKeyError);
      return new Response(JSON.stringify({ error: "Failed to generate API key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Store API key
    const { error: storeKeyError } = await supabase
      .from('org_api_keys')
      .insert({
        org_id: org.id,
        name: 'Default API Key',
        secret: apiKeyData
      });

    if (storeKeyError) {
      console.error("[ORG-CREATE] Failed to store API key:", storeKeyError);
    }

    console.log(`[ORG-CREATE] Organization created successfully: ${org.id}`);

    return new Response(JSON.stringify({
      success: true,
      org_id: org.id,
      name: org.name,
      plan: org.plan,
      api_key: apiKeyData,
      quotas: {
        max_streams: plan === 'starter' ? 2 : plan === 'pro' ? 10 : 50,
        max_storage_gb: plan === 'starter' ? 10 : plan === 'pro' ? 100 : 1000,
        max_minutes_month: plan === 'starter' ? 2000 : plan === 'pro' ? 20000 : 100000
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 201,
    });

  } catch (error) {
    console.error("[ORG-CREATE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});