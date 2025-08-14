import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DailyReportData {
  camera_stats: {
    camera_id: string;
    camera_name: string;
    total_events: number;
    avg_latency: number;
    uptime_percentage: number;
    errors_count: number;
  }[];
  system_performance: {
    avg_detection_latency: number;
    avg_fusion_latency: number;
    avg_clip_generation_time: number;
    total_processed_frames: number;
    error_rate: number;
  };
  event_breakdown: {
    event_type: string;
    count: number;
    peak_hour: string;
  }[];
  alerts_summary: {
    total_alerts: number;
    critical_alerts: number;
    resolved_alerts: number;
    avg_resolution_time: number;
  };
}

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

    const { report_date, email_recipients, format = 'both' } = await req.json();
    
    if (!report_date) {
      throw new Error('report_date is required');
    }

    console.log(`Generating daily report for ${report_date}`);

    // Get date range for the report
    const reportDate = new Date(report_date);
    const startDate = new Date(reportDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(reportDate);
    endDate.setHours(23, 59, 59, 999);

    // Fetch camera performance data
    const { data: cameraStats } = await supabase
      .from('performance_metrics')
      .select(`
        camera_id,
        detection_latency,
        fusion_latency,
        clip_generation_time,
        error_count,
        timestamp
      `)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    // Fetch system health data
    const { data: systemHealth } = await supabase
      .from('system_health_metrics')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString());

    // Fetch events data
    const { data: events } = await supabase
      .from('audit_events')
      .select('event_type, created_at, camera_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Process camera statistics
    const cameraStatsMap = new Map();
    cameraStats?.forEach(metric => {
      if (!cameraStatsMap.has(metric.camera_id)) {
        cameraStatsMap.set(metric.camera_id, {
          camera_id: metric.camera_id,
          camera_name: `Camera ${metric.camera_id}`,
          latencies: [],
          errors: 0,
          total_measurements: 0
        });
      }
      const stats = cameraStatsMap.get(metric.camera_id);
      stats.latencies.push(metric.detection_latency);
      stats.errors += metric.error_count || 0;
      stats.total_measurements++;
    });

    const processedCameraStats = Array.from(cameraStatsMap.values()).map(stats => ({
      camera_id: stats.camera_id,
      camera_name: stats.camera_name,
      total_events: stats.total_measurements,
      avg_latency: stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length || 0,
      uptime_percentage: Math.max(0, 100 - (stats.errors / stats.total_measurements * 100)) || 100,
      errors_count: stats.errors
    }));

    // Process system performance
    const avgDetectionLatency = cameraStats?.reduce((sum, m) => sum + (m.detection_latency || 0), 0) / (cameraStats?.length || 1);
    const avgFusionLatency = cameraStats?.reduce((sum, m) => sum + (m.fusion_latency || 0), 0) / (cameraStats?.length || 1);
    const avgClipTime = cameraStats?.reduce((sum, m) => sum + (m.clip_generation_time || 0), 0) / (cameraStats?.length || 1);
    const totalFrames = cameraStats?.length || 0;
    const totalErrors = cameraStats?.reduce((sum, m) => sum + (m.error_count || 0), 0) || 0;

    // Process event breakdown
    const eventBreakdown = new Map();
    events?.forEach(event => {
      const hour = new Date(event.created_at).getHours();
      const key = event.event_type;
      if (!eventBreakdown.has(key)) {
        eventBreakdown.set(key, { count: 0, hours: new Map() });
      }
      const breakdown = eventBreakdown.get(key);
      breakdown.count++;
      breakdown.hours.set(hour, (breakdown.hours.get(hour) || 0) + 1);
    });

    const processedEventBreakdown = Array.from(eventBreakdown.entries()).map(([type, data]) => {
      const peakHour = Array.from(data.hours.entries()).sort((a, b) => b[1] - a[1])[0];
      return {
        event_type: type,
        count: data.count,
        peak_hour: peakHour ? `${peakHour[0]}:00` : 'N/A'
      };
    });

    // Generate report data
    const reportData: DailyReportData = {
      camera_stats: processedCameraStats,
      system_performance: {
        avg_detection_latency: Math.round(avgDetectionLatency),
        avg_fusion_latency: Math.round(avgFusionLatency),
        avg_clip_generation_time: Math.round(avgClipTime),
        total_processed_frames: totalFrames,
        error_rate: totalFrames > 0 ? Math.round((totalErrors / totalFrames) * 100 * 100) / 100 : 0
      },
      event_breakdown: processedEventBreakdown,
      alerts_summary: {
        total_alerts: events?.length || 0,
        critical_alerts: events?.filter(e => e.event_type === 'SECURITY_ALERT')?.length || 0,
        resolved_alerts: events?.filter(e => e.event_type === 'ALERT_RESOLVED')?.length || 0,
        avg_resolution_time: 0 // Would need additional tracking
      }
    };

    // Generate CSV content
    const csvContent = generateCSV(reportData, reportDate);
    
    // Generate PDF content (HTML that can be converted to PDF)
    const htmlContent = generateHTML(reportData, reportDate);

    // Store report in database
    const { data: reportRecord } = await supabase
      .from('operational_reports')
      .insert({
        report_date: reportDate.toISOString().split('T')[0],
        report_type: 'daily',
        content: reportData,
        generated_at: new Date().toISOString(),
        csv_content: format === 'csv' || format === 'both' ? csvContent : null,
        html_content: format === 'pdf' || format === 'both' ? htmlContent : null
      })
      .select()
      .single();

    // Send email if recipients provided
    if (email_recipients && email_recipients.length > 0) {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey) {
        await sendEmailReport(resendApiKey, email_recipients, reportData, reportDate, csvContent, htmlContent);
      } else {
        console.warn('RESEND_API_KEY not found, skipping email sending');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report_id: reportRecord?.id,
        report_data: reportData,
        csv_content: format === 'csv' || format === 'both' ? csvContent : null,
        html_content: format === 'pdf' || format === 'both' ? htmlContent : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error generating daily report:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

function generateCSV(data: DailyReportData, reportDate: Date): string {
  const dateStr = reportDate.toISOString().split('T')[0];
  let csv = `Eagle Vision - Relatório Diário,${dateStr}\n\n`;
  
  // Camera stats
  csv += "Estatísticas por Câmera\n";
  csv += "ID,Nome,Total Eventos,Latência Média (ms),Uptime (%),Erros\n";
  data.camera_stats.forEach(cam => {
    csv += `${cam.camera_id},${cam.camera_name},${cam.total_events},${cam.avg_latency},${cam.uptime_percentage},${cam.errors_count}\n`;
  });
  
  // System performance
  csv += "\nPerformance do Sistema\n";
  csv += "Métrica,Valor\n";
  csv += `Latência Detecção Média (ms),${data.system_performance.avg_detection_latency}\n`;
  csv += `Latência Fusão Média (ms),${data.system_performance.avg_fusion_latency}\n`;
  csv += `Tempo Geração Clipe Médio (s),${data.system_performance.avg_clip_generation_time}\n`;
  csv += `Total Frames Processados,${data.system_performance.total_processed_frames}\n`;
  csv += `Taxa de Erro (%),${data.system_performance.error_rate}\n`;
  
  // Event breakdown
  csv += "\nEventos por Tipo\n";
  csv += "Tipo,Quantidade,Horário Pico\n";
  data.event_breakdown.forEach(event => {
    csv += `${event.event_type},${event.count},${event.peak_hour}\n`;
  });
  
  return csv;
}

function generateHTML(data: DailyReportData, reportDate: Date): string {
  const dateStr = reportDate.toLocaleDateString('pt-BR');
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Eagle Vision - Relatório Diário ${dateStr}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .section { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Eagle Vision - Relatório Diário</h1>
        <h2>${dateStr}</h2>
      </div>
      
      <div class="section">
        <h3>Performance do Sistema</h3>
        <div class="metric">
          <strong>Latência Detecção:</strong> ${data.system_performance.avg_detection_latency}ms
        </div>
        <div class="metric">
          <strong>Latência Fusão:</strong> ${data.system_performance.avg_fusion_latency}ms
        </div>
        <div class="metric">
          <strong>Tempo Geração Clipe:</strong> ${data.system_performance.avg_clip_generation_time}s
        </div>
        <div class="metric">
          <strong>Taxa de Erro:</strong> ${data.system_performance.error_rate}%
        </div>
      </div>
      
      <div class="section">
        <h3>Estatísticas por Câmera</h3>
        <table>
          <tr><th>ID</th><th>Nome</th><th>Eventos</th><th>Latência Média</th><th>Uptime</th><th>Erros</th></tr>
          ${data.camera_stats.map(cam => `
            <tr>
              <td>${cam.camera_id}</td>
              <td>${cam.camera_name}</td>
              <td>${cam.total_events}</td>
              <td>${cam.avg_latency}ms</td>
              <td>${cam.uptime_percentage}%</td>
              <td>${cam.errors_count}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <div class="section">
        <h3>Eventos por Tipo</h3>
        <table>
          <tr><th>Tipo</th><th>Quantidade</th><th>Horário Pico</th></tr>
          ${data.event_breakdown.map(event => `
            <tr>
              <td>${event.event_type}</td>
              <td>${event.count}</td>
              <td>${event.peak_hour}</td>
            </tr>
          `).join('')}
        </table>
      </div>
      
      <div class="section">
        <h3>Resumo de Alertas</h3>
        <div class="metric">
          <strong>Total:</strong> ${data.alerts_summary.total_alerts}
        </div>
        <div class="metric">
          <strong>Críticos:</strong> ${data.alerts_summary.critical_alerts}
        </div>
        <div class="metric">
          <strong>Resolvidos:</strong> ${data.alerts_summary.resolved_alerts}
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendEmailReport(
  apiKey: string, 
  recipients: string[], 
  data: DailyReportData, 
  reportDate: Date,
  csvContent: string,
  htmlContent: string
) {
  const dateStr = reportDate.toLocaleDateString('pt-BR');
  
  const emailBody = `
    <h1>Eagle Vision - Relatório Diário ${dateStr}</h1>
    
    <h2>Resumo Executivo</h2>
    <ul>
      <li><strong>Latência Média de Detecção:</strong> ${data.system_performance.avg_detection_latency}ms</li>
      <li><strong>Latência Média de Fusão:</strong> ${data.system_performance.avg_fusion_latency}ms</li>
      <li><strong>Taxa de Erro:</strong> ${data.system_performance.error_rate}%</li>
      <li><strong>Total de Eventos:</strong> ${data.alerts_summary.total_alerts}</li>
    </ul>
    
    <h2>Status das Câmeras</h2>
    <p>Monitorando ${data.camera_stats.length} câmeras com uptime médio de ${
      Math.round(data.camera_stats.reduce((sum, cam) => sum + cam.uptime_percentage, 0) / data.camera_stats.length)
    }%</p>
    
    <p>Relatórios detalhados em CSV e PDF anexados.</p>
    
    <p><em>Gerado automaticamente pelo Eagle Vision</em></p>
  `;

  const payload = {
    from: 'noreply@eaglevision.com',
    to: recipients,
    subject: `Eagle Vision - Relatório Diário ${dateStr}`,
    html: emailBody,
    attachments: [
      {
        filename: `eagle-vision-daily-report-${reportDate.toISOString().split('T')[0]}.csv`,
        content: btoa(csvContent),
        content_type: 'text/csv'
      },
      {
        filename: `eagle-vision-daily-report-${reportDate.toISOString().split('T')[0]}.html`,
        content: btoa(htmlContent),
        content_type: 'text/html'
      }
    ]
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send email:', error);
    throw new Error(`Failed to send email: ${error}`);
  }

  console.log('Daily report email sent successfully');
}