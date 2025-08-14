import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailySummary {
  totalIncidents: number;
  incidentsByCamera: Record<string, number>;
  incidentsByType: Record<string, number>;
  peakHours: Array<{ hour: number; count: number }>;
  averageDuration: number;
  discardedPercentage: number;
  sampleEvents: Array<{
    id: string;
    type: string;
    camera_id: string;
    timestamp: string;
    severity: string;
    url?: string;
  }>;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);

async function generateDailySummary(reportDate: string, orgId: string): Promise<DailySummary> {
  console.log(`Generating daily summary for ${reportDate}, org: ${orgId}`);
  
  const startDate = `${reportDate} 00:00:00+00`;
  const endDate = `${reportDate} 23:59:59+00`;

  // Get antitheft incidents
  const { data: antitheftIncidents, error: antitheftError } = await supabase
    .from('antitheft_incidents')
    .select('id, camera_id, severity, ts, meta')
    .gte('ts', startDate)
    .lte('ts', endDate);

  if (antitheftError) {
    console.error('Error fetching antitheft incidents:', antitheftError);
  }

  // Get edu incidents
  const { data: eduIncidents, error: eduError } = await supabase
    .from('edu_incidents')
    .select('id, class_id, severity, first_ts, last_ts, status, signals_count')
    .gte('first_ts', startDate)
    .lte('first_ts', endDate);

  if (eduError) {
    console.error('Error fetching edu incidents:', eduError);
  }

  // Process antitheft incidents
  const allIncidents = [
    ...(antitheftIncidents || []).map(inc => ({
      id: inc.id,
      type: 'antitheft',
      camera_id: inc.camera_id,
      timestamp: inc.ts,
      severity: inc.severity,
      duration: 0, // Antitheft incidents don't have duration
      discarded: false
    })),
    ...(eduIncidents || []).map(inc => ({
      id: inc.id,
      type: 'education',
      camera_id: `class-${inc.class_id}`,
      timestamp: inc.first_ts,
      severity: inc.severity,
      duration: inc.last_ts ? new Date(inc.last_ts).getTime() - new Date(inc.first_ts).getTime() : 0,
      discarded: inc.status === 'dismissed'
    }))
  ];

  // Calculate statistics
  const totalIncidents = allIncidents.length;
  const validIncidents = allIncidents.filter(inc => !inc.discarded);
  
  // Incidents by camera
  const incidentsByCamera: Record<string, number> = {};
  allIncidents.forEach(inc => {
    incidentsByCamera[inc.camera_id] = (incidentsByCamera[inc.camera_id] || 0) + 1;
  });

  // Incidents by type
  const incidentsByType: Record<string, number> = {};
  allIncidents.forEach(inc => {
    incidentsByType[inc.type] = (incidentsByType[inc.type] || 0) + 1;
  });

  // Peak hours analysis
  const hourCounts: Record<number, number> = {};
  allIncidents.forEach(inc => {
    const hour = new Date(inc.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourCounts)
    .map(([hour, count]) => ({ hour: parseInt(hour), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Average duration (only for incidents with duration)
  const incidentsWithDuration = allIncidents.filter(inc => inc.duration > 0);
  const averageDuration = incidentsWithDuration.length > 0
    ? incidentsWithDuration.reduce((sum, inc) => sum + inc.duration, 0) / incidentsWithDuration.length / 1000 / 60 // Convert to minutes
    : 0;

  // Discarded percentage
  const discardedCount = allIncidents.filter(inc => inc.discarded).length;
  const discardedPercentage = totalIncidents > 0 ? (discardedCount / totalIncidents) * 100 : 0;

  // Sample events (3-5 most significant)
  const sampleEvents = allIncidents
    .filter(inc => !inc.discarded)
    .sort((a, b) => {
      const severityOrder = { 'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0 };
      return (severityOrder[b.severity as keyof typeof severityOrder] || 0) - 
             (severityOrder[a.severity as keyof typeof severityOrder] || 0);
    })
    .slice(0, 5)
    .map(inc => ({
      id: inc.id,
      type: inc.type,
      camera_id: inc.camera_id,
      timestamp: inc.timestamp,
      severity: inc.severity,
      url: `${Deno.env.get('SUPABASE_URL')}/rest/v1/${inc.type === 'antitheft' ? 'antitheft_incidents' : 'edu_incidents'}?id=eq.${inc.id}`
    }));

  return {
    totalIncidents,
    incidentsByCamera,
    incidentsByType,
    peakHours,
    averageDuration,
    discardedPercentage,
    sampleEvents
  };
}

function generateCSVContent(summary: DailySummary, reportDate: string): string {
  let csv = `Relatório Diário - ${reportDate}\n\n`;
  
  csv += `Resumo Geral\n`;
  csv += `Total de Incidentes,${summary.totalIncidents}\n`;
  csv += `Duração Média (min),${summary.averageDuration.toFixed(2)}\n`;
  csv += `% Descartados,${summary.discardedPercentage.toFixed(2)}%\n\n`;
  
  csv += `Incidentes por Câmera\n`;
  csv += `Câmera,Quantidade\n`;
  Object.entries(summary.incidentsByCamera).forEach(([camera, count]) => {
    csv += `${camera},${count}\n`;
  });
  
  csv += `\nIncidentes por Tipo\n`;
  csv += `Tipo,Quantidade\n`;
  Object.entries(summary.incidentsByType).forEach(([type, count]) => {
    csv += `${type},${count}\n`;
  });
  
  csv += `\nHorários de Pico\n`;
  csv += `Hora,Incidentes\n`;
  summary.peakHours.forEach(({ hour, count }) => {
    csv += `${hour}:00,${count}\n`;
  });
  
  csv += `\nAmostra de Eventos\n`;
  csv += `ID,Tipo,Câmera,Timestamp,Severidade,URL\n`;
  summary.sampleEvents.forEach(event => {
    csv += `${event.id},${event.type},${event.camera_id},${event.timestamp},${event.severity},${event.url || ''}\n`;
  });
  
  return csv;
}

function generateEmailHTML(summary: DailySummary, reportDate: string): string {
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; padding: 10px; background: #f9f9f9; border-radius: 4px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .metric-label { font-size: 14px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        .event-link { color: #2563eb; text-decoration: none; }
        .severity-critical { color: #dc2626; font-weight: bold; }
        .severity-high { color: #ea580c; font-weight: bold; }
        .severity-medium { color: #d97706; }
        .severity-low { color: #65a30d; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Relatório Diário de Segurança</h1>
        <p><strong>Data:</strong> ${new Date(reportDate).toLocaleDateString('pt-BR')}</p>
      </div>

      <div class="section">
        <h2>Resumo Executivo</h2>
        <div class="metric">
          <div class="metric-value">${summary.totalIncidents}</div>
          <div class="metric-label">Total de Incidentes</div>
        </div>
        <div class="metric">
          <div class="metric-value">${summary.averageDuration.toFixed(1)} min</div>
          <div class="metric-label">Duração Média</div>
        </div>
        <div class="metric">
          <div class="metric-value">${summary.discardedPercentage.toFixed(1)}%</div>
          <div class="metric-label">Taxa de Descarte</div>
        </div>
      </div>

      <div class="section">
        <h2>Incidentes por Câmera</h2>
        <table>
          <tr><th>Câmera</th><th>Quantidade</th></tr>
          ${Object.entries(summary.incidentsByCamera)
            .map(([camera, count]) => `<tr><td>${camera}</td><td>${count}</td></tr>`)
            .join('')}
        </table>
      </div>

      <div class="section">
        <h2>Distribuição por Tipo</h2>
        <table>
          <tr><th>Tipo</th><th>Quantidade</th></tr>
          ${Object.entries(summary.incidentsByType)
            .map(([type, count]) => `<tr><td>${type}</td><td>${count}</td></tr>`)
            .join('')}
        </table>
      </div>

      <div class="section">
        <h2>Horários de Pico</h2>
        <table>
          <tr><th>Horário</th><th>Incidentes</th></tr>
          ${summary.peakHours
            .map(({ hour, count }) => `<tr><td>${hour}:00 - ${hour + 1}:00</td><td>${count}</td></tr>`)
            .join('')}
        </table>
      </div>

      <div class="section">
        <h2>Amostra de Eventos Significativos</h2>
        <table>
          <tr><th>Tipo</th><th>Câmera</th><th>Timestamp</th><th>Severidade</th><th>Link</th></tr>
          ${summary.sampleEvents
            .map(event => `
              <tr>
                <td>${event.type}</td>
                <td>${event.camera_id}</td>
                <td>${formatDateTime(event.timestamp)}</td>
                <td class="severity-${event.severity.toLowerCase()}">${event.severity}</td>
                <td><a href="${event.url}" class="event-link">Ver Detalhes</a></td>
              </tr>
            `)
            .join('')}
        </table>
      </div>

      <div class="section">
        <p><em>Relatório gerado automaticamente em ${formatDateTime(new Date().toISOString())}</em></p>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reportDate, orgId } = await req.json();
    const targetDate = reportDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetOrgId = orgId || 'default';

    console.log(`Starting daily report generation for ${targetDate}, org: ${targetOrgId}`);

    // Create report job record
    const { data: reportJob, error: jobError } = await supabase
      .from('report_jobs')
      .insert({
        org_id: targetOrgId,
        report_type: 'daily',
        report_date: targetDate,
        status: 'generating'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating report job:', jobError);
      return new Response(JSON.stringify({ error: 'Failed to create report job' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate summary data
    const summary = await generateDailySummary(targetDate, targetOrgId);
    
    // Generate CSV content
    const csvContent = generateCSVContent(summary, targetDate);
    
    // Generate email HTML
    const emailHTML = generateEmailHTML(summary, targetDate);

    // Get recipients
    const { data: recipients, error: recipientsError } = await supabase
      .from('report_recipients')
      .select('email, phone')
      .eq('org_id', targetOrgId)
      .eq('is_active', true)
      .contains('report_types', ['daily']);

    if (recipientsError) {
      console.error('Error fetching recipients:', recipientsError);
    }

    const emailRecipients = recipients?.map(r => r.email).filter(Boolean) || [];
    
    if (emailRecipients.length === 0) {
      console.log('No email recipients found');
      
      // Update job status
      await supabase
        .from('report_jobs')
        .update({
          status: 'completed',
          generated_at: new Date().toISOString(),
          metadata: { summary, warning: 'No recipients found' }
        })
        .eq('id', reportJob.id);

      return new Response(JSON.stringify({ 
        message: 'Report generated but no recipients found',
        summary 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Send email with Resend
    const emailSubject = `Relatório Diário de Segurança - ${new Date(targetDate).toLocaleDateString('pt-BR')}`;
    
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'Eagle Vision <reports@eaglevision.com>',
      to: emailRecipients,
      subject: emailSubject,
      html: emailHTML,
      attachments: [
        {
          filename: `relatorio-diario-${targetDate}.csv`,
          content: btoa(csvContent)
        }
      ]
    });

    if (emailError) {
      console.error('Error sending email:', emailError);
      
      // Update job with error
      await supabase
        .from('report_jobs')
        .update({
          status: 'failed',
          error_message: emailError.message,
          metadata: { summary }
        })
        .eq('id', reportJob.id);

      return new Response(JSON.stringify({ error: 'Failed to send email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update job as completed
    await supabase
      .from('report_jobs')
      .update({
        status: 'completed',
        generated_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
        recipients_count: emailRecipients.length,
        metadata: { summary, emailResult }
      })
      .eq('id', reportJob.id);

    console.log(`Daily report sent successfully to ${emailRecipients.length} recipients`);

    return new Response(JSON.stringify({
      success: true,
      message: `Report sent to ${emailRecipients.length} recipients`,
      summary,
      jobId: reportJob.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in daily report generator:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);