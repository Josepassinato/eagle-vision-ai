import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, data } = await req.json();

    switch (action) {
      case 'create_webhook': {
        const { name, url, method = 'POST', headers = {}, auth_type, auth_config, event_types } = data;
        
        const { data: webhook, error } = await supabase
          .from('webhook_configurations')
          .insert({
            name,
            url,
            method,
            headers,
            auth_type,
            auth_config,
            event_types,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true,
            webhook,
            message: 'Webhook criado com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_webhook': {
        const { webhook_id, test_payload } = data;
        
        const { data: webhook, error } = await supabase
          .from('webhook_configurations')
          .select('*')
          .eq('id', webhook_id)
          .single();

        if (error) throw error;

        const testResult = await executeWebhook(webhook, 'test', test_payload || { 
          message: 'Teste de webhook',
          timestamp: new Date().toISOString()
        });

        // Log the test execution
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_id,
            event_type: 'test',
            payload: test_payload || { message: 'Teste de webhook' },
            response_status: testResult.status,
            response_body: testResult.response_text,
            response_time_ms: testResult.response_time,
            error_message: testResult.error
          });

        return new Response(
          JSON.stringify({
            webhook_name: webhook.name,
            test_result: testResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'trigger_webhook': {
        const { event_type, payload } = data;
        
        // Get all active webhooks for this event type
        const { data: webhooks, error } = await supabase
          .from('webhook_configurations')
          .select('*')
          .eq('is_active', true)
          .contains('event_types', [event_type]);

        if (error) throw error;

        const results = [];
        
        for (const webhook of webhooks) {
          const result = await executeWebhook(webhook, event_type, payload);
          
          // Log the execution
          await supabase
            .from('webhook_logs')
            .insert({
              webhook_id: webhook.id,
              event_type,
              payload,
              response_status: result.status,
              response_body: result.response_text,
              response_time_ms: result.response_time,
              error_message: result.error
            });

          // Update webhook stats
          if (result.success) {
            await supabase
              .from('webhook_configurations')
              .update({
                success_count: webhook.success_count + 1,
                last_triggered_at: new Date().toISOString()
              })
              .eq('id', webhook.id);
          } else {
            await supabase
              .from('webhook_configurations')
              .update({
                failure_count: webhook.failure_count + 1
              })
              .eq('id', webhook.id);
          }

          results.push({
            webhook_id: webhook.id,
            webhook_name: webhook.name,
            success: result.success,
            status: result.status,
            response_time: result.response_time
          });
        }

        return new Response(
          JSON.stringify({
            event_type,
            triggered_webhooks: webhooks.length,
            successful_executions: results.filter(r => r.success).length,
            results
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_webhook_logs': {
        const { webhook_id, limit = 50 } = data;
        
        let query = supabase
          .from('webhook_logs')
          .select('*')
          .order('triggered_at', { ascending: false })
          .limit(limit);

        if (webhook_id) {
          query = query.eq('webhook_id', webhook_id);
        }

        const { data: logs, error } = await query;
        if (error) throw error;

        return new Response(
          JSON.stringify({ logs }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_webhook_stats': {
        const { data: webhooks, error } = await supabase
          .from('webhook_configurations')
          .select('id, name, success_count, failure_count, is_active, last_triggered_at');

        if (error) throw error;

        const stats = {
          total_webhooks: webhooks.length,
          active_webhooks: webhooks.filter(w => w.is_active).length,
          total_executions: webhooks.reduce((sum, w) => sum + w.success_count + w.failure_count, 0),
          successful_executions: webhooks.reduce((sum, w) => sum + w.success_count, 0),
          failed_executions: webhooks.reduce((sum, w) => sum + w.failure_count, 0),
          webhooks_by_performance: webhooks.map(w => ({
            id: w.id,
            name: w.name,
            success_rate: w.success_count + w.failure_count > 0 
              ? (w.success_count / (w.success_count + w.failure_count) * 100).toFixed(1)
              : 0,
            total_executions: w.success_count + w.failure_count,
            last_triggered: w.last_triggered_at,
            is_active: w.is_active
          })).sort((a, b) => b.total_executions - a.total_executions)
        };

        return new Response(
          JSON.stringify(stats),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggle_webhook': {
        const { webhook_id, is_active } = data;
        
        const { data: webhook, error } = await supabase
          .from('webhook_configurations')
          .update({ is_active })
          .eq('id', webhook_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            webhook,
            message: `Webhook ${is_active ? 'ativado' : 'desativado'} com sucesso`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_webhook': {
        const { webhook_id, updates } = data;
        
        const { data: webhook, error } = await supabase
          .from('webhook_configurations')
          .update(updates)
          .eq('id', webhook_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            webhook,
            message: 'Webhook atualizado com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete_webhook': {
        const { webhook_id } = data;
        
        const { error } = await supabase
          .from('webhook_configurations')
          .delete()
          .eq('id', webhook_id);

        if (error) throw error;

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Webhook removido com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Webhook Manager Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to execute webhook
async function executeWebhook(webhook: any, eventType: string, payload: any) {
  const startTime = Date.now();
  
  try {
    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Visao-de-Aguia-Webhook/1.0',
      ...webhook.headers
    };

    // Add authentication if configured
    if (webhook.auth_type === 'bearer' && webhook.auth_config?.token) {
      headers['Authorization'] = `Bearer ${webhook.auth_config.token}`;
    } else if (webhook.auth_type === 'basic' && webhook.auth_config?.username && webhook.auth_config?.password) {
      const credentials = btoa(`${webhook.auth_config.username}:${webhook.auth_config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (webhook.auth_type === 'api_key' && webhook.auth_config?.key && webhook.auth_config?.value) {
      headers[webhook.auth_config.key] = webhook.auth_config.value;
    }

    // Prepare payload
    const webhookPayload = {
      event_type: eventType,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data: payload
    };

    const response = await fetch(webhook.url, {
      method: webhook.method,
      headers,
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(webhook.timeout_seconds * 1000)
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    return {
      success: response.ok,
      status: response.status,
      response_text: responseText,
      response_time: responseTime,
      error: null
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      status: null,
      response_text: null,
      response_time: responseTime,
      error: error.message
    };
  }
}