import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function validateTenantApiKey(apiKey: string, supabase: any) {
  const { data, error } = await supabase.rpc('validate_tenant_api_key', { api_key: apiKey });
  if (error || !data) {
    throw new Error('Invalid API key');
  }
  return data;
}

async function generateServicePDF(serviceId: string, tenantId: string, supabase: any) {
  // Get service data
  const { data: service, error: serviceError } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .single();

  if (serviceError || !service) {
    throw new Error('Service not found');
  }

  // Get attendance data
  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      *,
      visitor:visitors(*)
    `)
    .eq('service_id', serviceId);

  // Get events data
  const { data: events } = await supabase
    .from('church_events')
    .select('*')
    .eq('org_id', tenantId)
    .gte('timestamp', service.start_time)
    .lte('timestamp', service.end_time || new Date().toISOString())
    .order('timestamp', { ascending: true });

  // Calculate metrics
  const totalAttendance = attendance?.length || 0;
  const uniqueVisitors = new Set(attendance?.map(a => a.visitor_id).filter(Boolean)).size;
  const newVisitors = attendance?.filter(a => a.visitor?.visit_count === 1).length || 0;
  
  // Generate occupancy curve data
  const occupancyCurve = events
    ?.filter(e => e.event_type === 'attendance' || e.event_type === 'entry')
    ?.map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString(),
      count: e.person_count || 0
    })) || [];

  const peakOccupancy = Math.max(...occupancyCurve.map(p => p.count), 0);

  // Get incidents with clips
  const incidents = events
    ?.filter(e => ['safety_incident', 'security_alert', 'emergency'].includes(e.event_type))
    ?.map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString(),
      type: e.event_type,
      description: e.metadata?.description || 'Incident detected',
      clip_url: e.clip_uri,
      confidence: e.confidence
    })) || [];

  // Generate visitor analysis
  const returningVisitors = attendance?.filter(a => a.visitor && a.visitor.visit_count > 1).length || 0;
  const visitorRecurrence = totalAttendance > 0 ? (returningVisitors / totalAttendance * 100).toFixed(1) : '0';

  // Create PDF content (simplified HTML for demonstration)
  const pdfContent = {
    service: {
      name: service.name,
      date: new Date(service.start_time).toLocaleDateString(),
      start_time: new Date(service.start_time).toLocaleTimeString(),
      end_time: service.end_time ? new Date(service.end_time).toLocaleTimeString() : 'Em andamento',
      duration_minutes: service.end_time 
        ? Math.round((new Date(service.end_time).getTime() - new Date(service.start_time).getTime()) / 60000)
        : null
    },
    attendance: {
      total_people: totalAttendance,
      unique_visitors: uniqueVisitors,
      new_visitors: newVisitors,
      returning_visitors: returningVisitors,
      visitor_recurrence_percentage: visitorRecurrence,
      peak_occupancy: peakOccupancy
    },
    flow_analysis: {
      occupancy_curve: occupancyCurve,
      peak_time: occupancyCurve.length > 0 
        ? occupancyCurve.reduce((max, current) => current.count > max.count ? current : max).time
        : null
    },
    incidents: {
      total_incidents: incidents.length,
      incidents_list: incidents
    },
    visitors_detail: attendance?.map(a => ({
      name: a.visitor?.name || 'Visitante',
      entry_time: new Date(a.entry_time).toLocaleTimeString(),
      exit_time: a.exit_time ? new Date(a.exit_time).toLocaleTimeString() : null,
      visit_count: a.visitor?.visit_count || 1,
      method: a.method
    })) || []
  };

  // Generate file path
  const { data: filePath } = await supabase.rpc('generate_report_path', {
    tenant_id: tenantId,
    report_type: 'service_summary',
    service_id: serviceId
  });

  // Simulate PDF generation (in real implementation, use PDF library)
  const pdfSize = JSON.stringify(pdfContent).length * 2; // Estimate PDF size

  return {
    file_path: filePath,
    file_size_bytes: pdfSize,
    content: pdfContent
  };
}

async function exportServiceCSV(serviceId: string, tenantId: string, format: string, supabase: any) {
  // Get service data
  const { data: service } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .single();

  // Get attendance data with visitor details
  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      *,
      visitor:visitors(*),
      service:services(name)
    `)
    .eq('service_id', serviceId);

  if (format === 'attendance') {
    const csvData = attendance?.map(record => ({
      service_name: record.service?.name,
      visitor_name: record.visitor?.name || 'Não identificado',
      visitor_code: record.visitor?.visitor_code,
      member_status: record.visitor?.member_status,
      entry_time: record.entry_time,
      exit_time: record.exit_time,
      duration_minutes: record.exit_time 
        ? Math.round((new Date(record.exit_time).getTime() - new Date(record.entry_time).getTime()) / 60000)
        : null,
      method: record.method,
      confidence: record.confidence,
      camera_id: record.camera_id,
      zone_name: record.zone_name
    })) || [];

    // Convert to CSV format
    const headers = Object.keys(csvData[0] || {});
    const csvRows = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ];

    return {
      content: csvRows.join('\n'),
      filename: `attendance_${service?.name?.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`,
      content_type: 'text/csv'
    };
  }

  return null;
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tenantId = await validateTenantApiKey(apiKey, supabase);
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname.includes('/generate-pdf')) {
      const payload = await req.json();
      const { service_id, report_type = 'service_summary' } = payload;

      if (!service_id) {
        return new Response(JSON.stringify({ error: 'service_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create report record
      const { data: reportRecord, error: reportError } = await supabase
        .from('bi_reports')
        .insert({
          tenant_id: tenantId,
          report_type,
          service_id,
          report_name: `Relatório de Culto - ${new Date().toLocaleDateString()}`,
          status: 'generating'
        })
        .select()
        .single();

      if (reportError) {
        throw new Error(`Failed to create report record: ${reportError.message}`);
      }

      // Generate PDF
      EdgeRuntime.waitUntil(
        (async () => {
          try {
            const pdfResult = await generateServicePDF(service_id, tenantId, supabase);
            
            // Update report record with completion
            await supabase
              .from('bi_reports')
              .update({
                status: 'completed',
                file_path: pdfResult.file_path,
                file_size_bytes: pdfResult.file_size_bytes,
                metadata: { generated_content: pdfResult.content }
              })
              .eq('id', reportRecord.id);

          } catch (error) {
            // Update report record with error
            await supabase
              .from('bi_reports')
              .update({
                status: 'failed',
                error_message: error.message
              })
              .eq('id', reportRecord.id);
          }
        })()
      );

      const response = {
        success: true,
        report_id: reportRecord.id,
        status: 'generating',
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/export-csv')) {
      const serviceId = url.searchParams.get('service_id');
      const format = url.searchParams.get('format') || 'attendance';

      if (!serviceId) {
        return new Response(JSON.stringify({ error: 'service_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const csvResult = await exportServiceCSV(serviceId, tenantId, format, supabase);

      if (!csvResult) {
        return new Response(JSON.stringify({ error: 'Invalid format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(csvResult.content, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': csvResult.content_type,
          'Content-Disposition': `attachment; filename="${csvResult.filename}"`
        }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/reports')) {
      // List reports for tenant
      const { data: reports } = await supabase
        .from('bi_reports')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50);

      return new Response(JSON.stringify({ reports }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});