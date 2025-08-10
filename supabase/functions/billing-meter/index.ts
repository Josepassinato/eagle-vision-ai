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
    console.log("[BILLING-METER] Starting billing meter job");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const tsEnd = now;
    const tsStart = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

    console.log(`[BILLING-METER] Processing period: ${tsStart.toISOString()} to ${tsEnd.toISOString()}`);

    // Get active streams
    const { data: streams, error: streamsError } = await supabase
      .from('cameras')
      .select('id, org_id, online')
      .eq('online', true);

    if (streamsError) {
      throw new Error(`Failed to fetch streams: ${streamsError.message}`);
    }

    console.log(`[BILLING-METER] Found ${streams?.length || 0} active streams`);

    // Calculate usage for each active stream
    for (const stream of streams || []) {
      const minutes = 5; // 5-minute billing window
      const storageEstimate = 0.1; // Estimate 0.1 GB per 5 minutes
      
      // Insert usage event
      const { error: usageError } = await supabase
        .from('usage_events')
        .insert({
          org_id: stream.org_id,
          stream_id: stream.id,
          metric_type: 'stream_minutes',
          quantity: minutes,
          period_start: tsStart.toISOString(),
          period_end: tsEnd.toISOString()
        });

      if (usageError) {
        console.error(`[BILLING-METER] Failed to insert usage for stream ${stream.id}:`, usageError);
        continue;
      }

      // Insert storage usage
      const { error: storageError } = await supabase
        .from('usage_events')
        .insert({
          org_id: stream.org_id,
          stream_id: stream.id,
          metric_type: 'storage_gb',
          quantity: storageEstimate,
          period_start: tsStart.toISOString(),
          period_end: tsEnd.toISOString()
        });

      if (storageError) {
        console.error(`[BILLING-METER] Failed to insert storage usage for stream ${stream.id}:`, storageError);
      }

      console.log(`[BILLING-METER] Recorded usage for stream ${stream.id}: ${minutes} minutes, ${storageEstimate} GB`);
    }

    // Check if we need to run monthly billing
    const currentDay = now.getDate();
    if (currentDay === 1 && now.getHours() === 0 && now.getMinutes() < 5) {
      console.log("[BILLING-METER] Triggering monthly billing");
      
      // Trigger billing-invoice function
      const { error: invoiceError } = await supabase.functions.invoke('billing-invoice');
      if (invoiceError) {
        console.error("[BILLING-METER] Failed to trigger monthly billing:", invoiceError);
      }
    }

    console.log("[BILLING-METER] Billing meter job completed successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      processed_streams: streams?.length || 0,
      period: { start: tsStart.toISOString(), end: tsEnd.toISOString() }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[BILLING-METER] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});