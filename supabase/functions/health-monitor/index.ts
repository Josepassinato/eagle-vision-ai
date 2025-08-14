import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface HealthMetric {
  service_name: string;
  metric_name: string;
  metric_value: number;
  metric_type: 'gauge' | 'counter' | 'histogram';
  labels?: Record<string, string>;
}

interface ServiceHealthCheck {
  service_name: string;
  endpoint: string;
  timeout_ms: number;
}

const DEFAULT_SERVICES: ServiceHealthCheck[] = [
  { service_name: 'mediamtx', endpoint: 'http://mediamtx:9997/v3/config/global/get', timeout_ms: 5000 },
  { service_name: 'yolo-detection', endpoint: 'http://yolo-detection:8000/health', timeout_ms: 3000 },
  { service_name: 'face-service', endpoint: 'http://face-service:8000/health', timeout_ms: 3000 },
  { service_name: 'reid-service', endpoint: 'http://reid-service:8000/health', timeout_ms: 3000 },
  { service_name: 'fusion', endpoint: 'http://fusion:8000/health', timeout_ms: 3000 },
  { service_name: 'frame-puller', endpoint: 'http://frame-puller:8000/health', timeout_ms: 3000 },
  { service_name: 'enricher', endpoint: 'http://enricher:8000/health', timeout_ms: 3000 },
  { service_name: 'notifier', endpoint: 'http://notifier:8000/health', timeout_ms: 3000 }
];

async function checkServiceHealth(service: ServiceHealthCheck): Promise<{
  service_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  error_message?: string;
  metadata: any;
}> {
  const startTime = Date.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), service.timeout_ms);
    
    const response = await fetch(service.endpoint, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        service_name: service.service_name,
        status: 'healthy',
        response_time_ms: responseTime,
        metadata: data
      };
    } else {
      return {
        service_name: service.service_name,
        status: 'degraded',
        response_time_ms: responseTime,
        error_message: `HTTP ${response.status}: ${response.statusText}`,
        metadata: {}
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      service_name: service.service_name,
      status: 'unhealthy',
      response_time_ms: responseTime,
      error_message: error.message || 'Unknown error',
      metadata: {}
    };
  }
}

async function generateSyntheticMetrics(): Promise<HealthMetric[]> {
  const now = new Date();
  const metrics: HealthMetric[] = [];
  
  // Stream metrics
  const activeStreams = Math.floor(Math.random() * 10) + 5;
  const stallRate = Math.random() * 0.05; // 0-5% stall rate
  const reconnectionsPerMinute = Math.floor(Math.random() * 3);
  
  metrics.push(
    { service_name: 'mediamtx', metric_name: 'active_streams_count', metric_value: activeStreams, metric_type: 'gauge' },
    { service_name: 'mediamtx', metric_name: 'stream_stall_rate_percent', metric_value: stallRate * 100, metric_type: 'gauge' },
    { service_name: 'mediamtx', metric_name: 'stream_reconnections_per_minute', metric_value: reconnectionsPerMinute, metric_type: 'gauge' },
    { service_name: 'mediamtx', metric_name: 'stream_stall_duration_seconds', metric_value: Math.random() * 120, metric_type: 'gauge' }
  );
  
  // Pipeline latency metrics (p50, p95, p99)
  const stages = ['yolo-detection', 'face-service', 'reid-service', 'fusion'];
  stages.forEach(stage => {
    const baseLatency = Math.random() * 200 + 50; // 50-250ms base
    metrics.push(
      { service_name: stage, metric_name: 'pipeline_latency_p50_ms', metric_value: baseLatency, metric_type: 'gauge' },
      { service_name: stage, metric_name: 'pipeline_latency_p95_ms', metric_value: baseLatency * 2.5, metric_type: 'gauge' },
      { service_name: stage, metric_name: 'pipeline_latency_p99_ms', metric_value: baseLatency * 4, metric_type: 'gauge' },
      { service_name: stage, metric_name: 'error_rate_percent', metric_value: Math.random() * 2, metric_type: 'gauge' }
    );
  });
  
  // Event processing metrics
  const eventsPerHour = Math.floor(Math.random() * 500) + 100;
  const notifierErrorRate = Math.random() * 0.02; // 0-2% error rate
  
  metrics.push(
    { service_name: 'fusion', metric_name: 'events_processed_per_hour', metric_value: eventsPerHour, metric_type: 'gauge' },
    { service_name: 'fusion', metric_name: 'queue_saturation_duration_seconds', metric_value: Math.random() * 60, metric_type: 'gauge' },
    { service_name: 'fusion', metric_name: 'decision_latency_p95_ms', metric_value: Math.random() * 2000 + 500, metric_type: 'gauge' },
    { service_name: 'notifier', metric_name: 'notification_error_rate_percent', metric_value: notifierErrorRate * 100, metric_type: 'gauge' },
    { service_name: 'notifier', metric_name: 'notifications_sent_per_hour', metric_value: Math.floor(eventsPerHour * 0.1), metric_type: 'gauge' }
  );
  
  return metrics;
}

async function storeMetrics(metrics: HealthMetric[], orgId: string) {
  const { error } = await supabase
    .from('health_metrics')
    .insert(
      metrics.map(metric => ({
        ...metric,
        org_id: orgId
      }))
    );
    
  if (error) {
    console.error('Error storing metrics:', error);
    throw error;
  }
}

async function updateServiceStatus(healthChecks: Awaited<ReturnType<typeof checkServiceHealth>>[], orgId: string) {
  for (const check of healthChecks) {
    await supabase
      .from('service_status')
      .upsert({
        service_name: check.service_name,
        status: check.status,
        response_time_ms: check.response_time_ms,
        error_message: check.error_message,
        metadata: check.metadata,
        org_id: orgId,
        last_check: new Date().toISOString()
      }, {
        onConflict: 'service_name,org_id'
      });
  }
}

async function checkAlertRules(orgId: string) {
  // Get active alert rules
  const { data: rules, error: rulesError } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)
    .eq('org_id', orgId);
    
  if (rulesError || !rules) {
    console.error('Error fetching alert rules:', rulesError);
    return;
  }
  
  for (const rule of rules) {
    // Get latest metric value
    const { data: metrics, error: metricsError } = await supabase
      .from('health_metrics')
      .select('metric_value, timestamp')
      .eq('service_name', rule.service_name)
      .eq('metric_name', rule.metric_name)
      .eq('org_id', orgId)
      .gte('timestamp', new Date(Date.now() - rule.duration_seconds * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(1);
      
    if (metricsError || !metrics?.length) continue;
    
    const currentValue = metrics[0].metric_value;
    const isTriggered = 
      (rule.condition_type === 'gt' && currentValue > rule.threshold_value) ||
      (rule.condition_type === 'lt' && currentValue < rule.threshold_value) ||
      (rule.condition_type === 'eq' && currentValue === rule.threshold_value);
      
    if (isTriggered) {
      // Check if alert already exists
      const { data: existingAlert } = await supabase
        .from('active_alerts')
        .select('id')
        .eq('rule_id', rule.id)
        .eq('status', 'firing')
        .single();
        
      if (!existingAlert) {
        // Create new alert
        await supabase
          .from('active_alerts')
          .insert({
            rule_id: rule.id,
            service_name: rule.service_name,
            metric_name: rule.metric_name,
            current_value: currentValue,
            threshold_value: rule.threshold_value,
            severity: rule.severity,
            org_id: orgId
          });
          
        console.log(`Alert triggered: ${rule.rule_name} - ${currentValue} ${rule.condition_type} ${rule.threshold_value}`);
      }
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { action, orgId = 'default' } = await req.json().catch(() => ({ action: 'collect', orgId: 'default' }));
    
    console.log(`Health monitor action: ${action} for org: ${orgId}`);
    
    switch (action) {
      case 'collect': {
        // Generate synthetic metrics
        const metrics = await generateSyntheticMetrics();
        await storeMetrics(metrics, orgId);
        
        // Perform health checks
        const healthChecks = await Promise.all(
          DEFAULT_SERVICES.map(service => checkServiceHealth(service))
        );
        await updateServiceStatus(healthChecks, orgId);
        
        // Check alert rules
        await checkAlertRules(orgId);
        
        return new Response(JSON.stringify({
          success: true,
          metrics_collected: metrics.length,
          services_checked: healthChecks.length,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      case 'health': {
        // Return current system health status
        const { data: services } = await supabase
          .from('service_status')
          .select('*')
          .eq('org_id', orgId)
          .order('last_check', { ascending: false });
          
        const { data: alerts } = await supabase
          .from('active_alerts')
          .select('*')
          .eq('status', 'firing')
          .eq('org_id', orgId)
          .order('started_at', { ascending: false });
          
        const overallHealth = services?.every(s => s.status === 'healthy') ? 'healthy' : 
                             services?.some(s => s.status === 'unhealthy') ? 'unhealthy' : 'degraded';
        
        return new Response(JSON.stringify({
          status: overallHealth,
          services: services || [],
          active_alerts: alerts || [],
          last_updated: new Date().toISOString()
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
  } catch (error) {
    console.error('Error in health monitor:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

serve(handler);