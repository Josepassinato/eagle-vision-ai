import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MetricRequest {
  action: 'stream_metrics' | 'get_dashboard_data' | 'publish_metric';
  org_id?: string;
  metric_data?: {
    metric_type: string;
    metric_name: string;
    value: number;
    camera_id?: string;
    device_id?: string;
    metadata?: Record<string, any>;
  };
  timeframe?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle WebSocket upgrade for real-time streaming
  const upgradeHeader = req.headers.get("upgrade");
  if (upgradeHeader?.toLowerCase() === "websocket") {
    return handleWebSocketConnection(req);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as MetricRequest;
    const { action } = body;

    console.log(`Real-time Analytics API called with action: ${action}`);

    switch (action) {
      case 'get_dashboard_data':
        return await getDashboardData(supabase, body);
      case 'publish_metric':
        return await publishMetric(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in real-time-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function handleWebSocketConnection(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req);
  
  const clients = new Set<WebSocket>();
  clients.add(socket);

  socket.onopen = () => {
    console.log("WebSocket connection opened for real-time analytics");
    
    // Send initial connection confirmation
    socket.send(JSON.stringify({
      type: 'connection_established',
      timestamp: new Date().toISOString()
    }));

    // Simulate real-time metrics (in production, this would come from actual data)
    const metricsInterval = setInterval(() => {
      const metrics = generateMockRealTimeMetrics();
      socket.send(JSON.stringify({
        type: 'metrics_update',
        data: metrics,
        timestamp: new Date().toISOString()
      }));
    }, 2000); // Send updates every 2 seconds

    // Store interval reference for cleanup
    (socket as any).metricsInterval = metricsInterval;
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
    clients.delete(socket);
    
    // Clear interval when connection closes
    if ((socket as any).metricsInterval) {
      clearInterval((socket as any).metricsInterval);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
}

async function getDashboardData(supabase: any, body: MetricRequest) {
  const timeframe = body.timeframe || '1h';
  const timeAgo = getTimeAgo(timeframe);

  // Get recent metrics
  const { data: metrics, error: metricsError } = await supabase
    .from('real_time_metrics')
    .select('*')
    .gte('timestamp', timeAgo)
    .order('timestamp', { ascending: false });

  if (metricsError) {
    throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
  }

  // Get camera status
  const { data: cameras, error: camerasError } = await supabase
    .from('cameras')
    .select('id, name, online, last_seen');

  if (camerasError) {
    throw new Error(`Failed to fetch cameras: ${camerasError.message}`);
  }

  // Generate dashboard summary
  const dashboardData = {
    realTimeMetrics: {
      totalCameras: cameras.length,
      onlineCameras: cameras.filter((c: any) => c.online).length,
      totalEvents: metrics.length,
      avgResponseTime: calculateAvgResponseTime(metrics),
      currentThroughput: calculateThroughput(metrics)
    },
    metricsHistory: metrics,
    cameraStatus: cameras,
    trends: generateTrendData(metrics),
    alerts: generateActiveAlerts(metrics),
    performance: {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      networkBandwidth: Math.random() * 1000,
      storageUsed: Math.random() * 100
    }
  };

  return new Response(
    JSON.stringify({ success: true, data: dashboardData }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function publishMetric(supabase: any, body: MetricRequest) {
  const { metric_data } = body;
  
  if (!metric_data) {
    throw new Error('Metric data is required');
  }

  const { data, error } = await supabase
    .from('real_time_metrics')
    .insert({
      org_id: body.org_id,
      ...metric_data,
      timestamp: new Date().toISOString()
    });

  if (error) {
    throw new Error(`Failed to publish metric: ${error.message}`);
  }

  return new Response(
    JSON.stringify({ success: true, metric: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function generateMockRealTimeMetrics() {
  return {
    frameProcessingRate: Math.floor(Math.random() * 30) + 15, // 15-45 FPS
    detectionAccuracy: (Math.random() * 0.15 + 0.85).toFixed(3), // 85-100%
    networkLatency: Math.floor(Math.random() * 50) + 10, // 10-60ms
    systemLoad: Math.floor(Math.random() * 100),
    activeStreams: Math.floor(Math.random() * 8) + 2, // 2-10 streams
    errorRate: (Math.random() * 0.05).toFixed(3), // 0-5%
    storageUsage: Math.floor(Math.random() * 100),
    alertsTriggered: Math.floor(Math.random() * 5),
    peopleDetected: Math.floor(Math.random() * 50),
    incidentsReported: Math.floor(Math.random() * 3)
  };
}

function getTimeAgo(timeframe: string): string {
  const now = new Date();
  const timeMap: { [key: string]: number } = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const timeMs = timeMap[timeframe] || timeMap['1h'];
  return new Date(now.getTime() - timeMs).toISOString();
}

function calculateAvgResponseTime(metrics: any[]): number {
  const responseTimes = metrics
    .filter(m => m.metric_name === 'response_time')
    .map(m => m.value);
  
  if (responseTimes.length === 0) return 0;
  return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
}

function calculateThroughput(metrics: any[]): number {
  const recentMetrics = metrics.filter(m => 
    new Date(m.timestamp).getTime() > Date.now() - 5 * 60 * 1000 // Last 5 minutes
  );
  return recentMetrics.length;
}

function generateTrendData(metrics: any[]) {
  return {
    detectionTrend: 'increasing',
    alertTrend: 'stable',
    performanceTrend: 'improving',
    usageTrend: 'increasing'
  };
}

function generateActiveAlerts(metrics: any[]) {
  return [
    {
      id: '1',
      type: 'warning',
      message: 'High CPU usage detected on Camera 3',
      timestamp: new Date().toISOString(),
      severity: 'medium'
    },
    {
      id: '2',
      type: 'info',
      message: 'System performing optimally',
      timestamp: new Date().toISOString(),
      severity: 'low'
    }
  ];
}