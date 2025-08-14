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
      case 'send_teams_notification': {
        const { webhook_url, title, message, color = 'accent', urgency = 'normal' } = data;
        
        const teamsPayload = {
          "@type": "MessageCard",
          "@context": "https://schema.org/extensions",
          "summary": title,
          "themeColor": color === 'danger' ? 'FF0000' : color === 'warning' ? 'FF8C00' : '0078D4',
          "sections": [{
            "activityTitle": title,
            "activitySubtitle": `Visão de Águia - ${new Date().toLocaleString('pt-BR')}`,
            "activityImage": "https://via.placeholder.com/64x64/0078D4/FFFFFF?text=VA",
            "text": message,
            "markdown": true
          }],
          "potentialAction": [{
            "@type": "OpenUri",
            "name": "Ver Dashboard",
            "targets": [{
              "os": "default",
              "uri": `${Deno.env.get('FRONTEND_URL') || 'https://app.example.com'}/admin/dashboard`
            }]
          }]
        };

        const response = await fetch(webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(teamsPayload)
        });

        const result = {
          success: response.ok,
          status: response.status,
          response_text: await response.text()
        };

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'send_slack_notification': {
        const { webhook_url, title, message, color = 'good', urgency = 'normal' } = data;
        
        const slackPayload = {
          "text": title,
          "attachments": [{
            "color": color === 'danger' ? 'danger' : color === 'warning' ? 'warning' : 'good',
            "title": title,
            "text": message,
            "footer": "Visão de Águia",
            "ts": Math.floor(Date.now() / 1000),
            "actions": [{
              "type": "button",
              "text": "Ver Dashboard",
              "url": `${Deno.env.get('FRONTEND_URL') || 'https://app.example.com'}/admin/dashboard`,
              "style": urgency === 'high' ? 'danger' : 'primary'
            }]
          }]
        };

        const response = await fetch(webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackPayload)
        });

        const result = {
          success: response.ok,
          status: response.status,
          response_text: await response.text()
        };

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'broadcast_notification': {
        const { title, message, notification_type = 'alert', urgency = 'normal' } = data;
        
        // Get all active notification channels for this org
        const { data: channels, error: channelsError } = await supabase
          .from('notification_channels')
          .select(`
            *,
            integration_configurations (
              integration_type,
              configuration
            )
          `)
          .eq('is_active', true)
          .contains('notification_types', [notification_type]);

        if (channelsError) throw channelsError;

        const results = [];
        
        for (const channel of channels) {
          try {
            let notificationResult;
            
            if (channel.channel_type === 'teams') {
              notificationResult = await sendTeamsNotification(
                channel.webhook_url,
                title,
                message,
                urgency === 'high' ? 'danger' : urgency === 'medium' ? 'warning' : 'accent'
              );
            } else if (channel.channel_type === 'slack') {
              notificationResult = await sendSlackNotification(
                channel.webhook_url,
                title,
                message,
                urgency === 'high' ? 'danger' : urgency === 'medium' ? 'warning' : 'good'
              );
            }

            results.push({
              channel_id: channel.id,
              channel_name: channel.channel_name,
              channel_type: channel.channel_type,
              success: notificationResult.success,
              status: notificationResult.status
            });

          } catch (error) {
            results.push({
              channel_id: channel.id,
              channel_name: channel.channel_name,
              channel_type: channel.channel_type,
              success: false,
              error: error.message
            });
          }
        }

        return new Response(
          JSON.stringify({ 
            message: `Notificação enviada para ${channels.length} canais`,
            results,
            total_channels: channels.length,
            successful_sends: results.filter(r => r.success).length
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_channel': {
        const { channel_id } = data;
        
        const { data: channel, error } = await supabase
          .from('notification_channels')
          .select('*')
          .eq('id', channel_id)
          .single();

        if (error) throw error;

        const testMessage = {
          title: '🧪 Teste de Notificação',
          message: `Teste de conectividade do canal ${channel.channel_name}. Se você recebeu esta mensagem, a integração está funcionando corretamente!`,
          urgency: 'normal'
        };

        let result;
        if (channel.channel_type === 'teams') {
          result = await sendTeamsNotification(
            channel.webhook_url,
            testMessage.title,
            testMessage.message,
            'accent'
          );
        } else if (channel.channel_type === 'slack') {
          result = await sendSlackNotification(
            channel.webhook_url,
            testMessage.title,
            testMessage.message,
            'good'
          );
        }

        return new Response(
          JSON.stringify({
            channel_name: channel.channel_name,
            channel_type: channel.channel_type,
            test_result: result
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_channel_stats': {
        const { data: stats, error } = await supabase
          .from('notification_channels')
          .select(`
            channel_type,
            is_active,
            integration_configurations (
              sync_status
            )
          `);

        if (error) throw error;

        const summary = {
          total_channels: stats.length,
          active_channels: stats.filter(s => s.is_active).length,
          by_type: stats.reduce((acc, stat) => {
            acc[stat.channel_type] = (acc[stat.channel_type] || 0) + 1;
            return acc;
          }, {}),
          health_status: stats.filter(s => 
            s.integration_configurations?.sync_status === 'success'
          ).length
        };

        return new Response(
          JSON.stringify(summary),
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
    console.error('Teams/Slack Notifications Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions
async function sendTeamsNotification(webhookUrl: string, title: string, message: string, color: string) {
  const teamsPayload = {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    "summary": title,
    "themeColor": color === 'danger' ? 'FF0000' : color === 'warning' ? 'FF8C00' : '0078D4',
    "sections": [{
      "activityTitle": title,
      "activitySubtitle": `Visão de Águia - ${new Date().toLocaleString('pt-BR')}`,
      "text": message,
      "markdown": true
    }]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(teamsPayload)
  });

  return {
    success: response.ok,
    status: response.status,
    response_text: await response.text()
  };
}

async function sendSlackNotification(webhookUrl: string, title: string, message: string, color: string) {
  const slackPayload = {
    "text": title,
    "attachments": [{
      "color": color,
      "title": title,
      "text": message,
      "footer": "Visão de Águia",
      "ts": Math.floor(Date.now() / 1000)
    }]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload)
  });

  return {
    success: response.ok,
    status: response.status,
    response_text: await response.text()
  };
}