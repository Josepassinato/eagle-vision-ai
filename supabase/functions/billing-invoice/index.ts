import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    console.log("[BILLING-INVOICE] Starting monthly billing job");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth() - 1, 1); // First day of previous month

    console.log(`[BILLING-INVOICE] Processing billing period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);

    // Get all organizations with usage
    const { data: orgs, error: orgsError } = await supabase
      .from('orgs')
      .select('id, name');

    if (orgsError) {
      throw new Error(`Failed to fetch organizations: ${orgsError.message}`);
    }

    console.log(`[BILLING-INVOICE] Processing ${orgs?.length || 0} organizations`);

    for (const org of orgs || []) {
      console.log(`[BILLING-INVOICE] Processing organization: ${org.name} (${org.id})`);

      // Aggregate usage events for this org
      const { data: usageData, error: usageError } = await supabase
        .from('usage_events')
        .select('metric_type, quantity')
        .eq('org_id', org.id)
        .gte('period_start', periodStart.toISOString())
        .lt('period_end', periodEnd.toISOString());

      if (usageError) {
        console.error(`[BILLING-INVOICE] Failed to fetch usage for org ${org.id}:`, usageError);
        continue;
      }

      // Aggregate by metric type
      const usage = (usageData || []).reduce((acc, event) => {
        acc[event.metric_type] = (acc[event.metric_type] || 0) + event.quantity;
        return acc;
      }, {} as Record<string, number>);

      const totalMinutes = Math.round(usage.stream_minutes || 0);
      const totalStorageGB = Number((usage.storage_gb || 0).toFixed(2));
      const totalAnalytics = Math.round(usage.analytics || 0);

      console.log(`[BILLING-INVOICE] Usage for ${org.name}: ${totalMinutes} minutes, ${totalStorageGB} GB, ${totalAnalytics} analytics`);

      if (totalMinutes === 0 && totalStorageGB === 0 && totalAnalytics === 0) {
        console.log(`[BILLING-INVOICE] No usage for ${org.name}, skipping invoice`);
        continue;
      }

      // Get billing rates
      const { data: rates, error: ratesError } = await supabase
        .from('billing_rates')
        .select('*')
        .lte('effective_from', periodEnd.toISOString())
        .or('effective_until.is.null,effective_until.gte.' + periodEnd.toISOString());

      if (ratesError) {
        console.error(`[BILLING-INVOICE] Failed to fetch billing rates:`, ratesError);
        continue;
      }

      const rateMap = (rates || []).reduce((acc, rate) => {
        acc[rate.metric_type] = rate.unit_price;
        return acc;
      }, {} as Record<string, number>);

      // Calculate amounts
      const minuteRate = rateMap.stream_minutes || 0.10; // R$ 0.10 per minute
      const storageRate = rateMap.storage_gb || 2.00; // R$ 2.00 per GB
      const analyticsRate = rateMap.analytics || 50.00; // R$ 50.00 per analytics per month

      const minuteAmount = totalMinutes * minuteRate;
      const storageAmount = totalStorageGB * storageRate;
      const analyticsAmount = totalAnalytics * analyticsRate;
      const subtotal = minuteAmount + storageAmount + analyticsAmount;
      const totalAmount = subtotal; // No tax for now

      console.log(`[BILLING-INVOICE] Calculated amounts for ${org.name}: Minutes R$ ${minuteAmount.toFixed(2)}, Storage R$ ${storageAmount.toFixed(2)}, Analytics R$ ${analyticsAmount.toFixed(2)}, Total R$ ${totalAmount.toFixed(2)}`);

      // Create invoice in Supabase
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          org_id: org.id,
          invoice_number: `INV-${org.id.slice(-8)}-${periodStart.getFullYear()}${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          total_minutes: totalMinutes,
          total_storage_gb: totalStorageGB,
          total_analytics: totalAnalytics,
          subtotal_amount: subtotal,
          total_amount: totalAmount,
          currency: 'BRL',
          status: 'draft',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
        })
        .select()
        .single();

      if (invoiceError) {
        console.error(`[BILLING-INVOICE] Failed to create invoice for org ${org.id}:`, invoiceError);
        continue;
      }

      console.log(`[BILLING-INVOICE] Created invoice ${invoice.invoice_number} for ${org.name}`);

      // Create line items
      const lineItems = [];
      if (totalMinutes > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          metric_type: 'stream_minutes',
          description: `Processamento de vídeo - ${totalMinutes} minutos`,
          quantity: totalMinutes,
          unit_price: minuteRate,
          amount: minuteAmount
        });
      }

      if (totalStorageGB > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          metric_type: 'storage_gb',
          description: `Armazenamento - ${totalStorageGB} GB`,
          quantity: totalStorageGB,
          unit_price: storageRate,
          amount: storageAmount
        });
      }

      if (totalAnalytics > 0) {
        lineItems.push({
          invoice_id: invoice.id,
          metric_type: 'analytics',
          description: `Analíticos habilitados - ${totalAnalytics} serviços`,
          quantity: totalAnalytics,
          unit_price: analyticsRate,
          amount: analyticsAmount
        });
      }

      if (lineItems.length > 0) {
        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(lineItems);

        if (lineItemsError) {
          console.error(`[BILLING-INVOICE] Failed to create line items for invoice ${invoice.id}:`, lineItemsError);
        }
      }

      console.log(`[BILLING-INVOICE] Invoice ${invoice.invoice_number} completed with ${lineItems.length} line items`);
    }

    console.log("[BILLING-INVOICE] Monthly billing job completed successfully");

    return new Response(JSON.stringify({ 
      success: true,
      processed_orgs: orgs?.length || 0,
      period: { start: periodStart.toISOString(), end: periodEnd.toISOString() }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("[BILLING-INVOICE] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});