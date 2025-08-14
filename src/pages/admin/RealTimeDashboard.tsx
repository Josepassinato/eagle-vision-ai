import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Activity, Camera, Cpu, AlertTriangle, TrendingUp, Clock, Users, Shield } from 'lucide-react';

interface SystemMetrics {
  timestamp: string;
  fps: number;
  latency_p95: number;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage: number;
  active_cameras: number;
  queue_depth: number;
  error_rate: number;
  detections_per_min: number;
  incidents_count: number;
}

interface AlertData {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  service: string;
}

export default function RealTimeDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate real-time metrics updates
    const updateMetrics = () => {
      const now = new Date();
      const newMetric: SystemMetrics = {
        timestamp: now.toISOString(),
        fps: 15 + Math.random() * 10,
        latency_p95: 800 + Math.random() * 400,
        cpu_usage: 40 + Math.random() * 30,
        memory_usage: 60 + Math.random() * 20,
        gpu_usage: 70 + Math.random() * 25,
        active_cameras: 8 + Math.floor(Math.random() * 4),
        queue_depth: Math.floor(Math.random() * 100),
        error_rate: Math.random() * 5,
        detections_per_min: 50 + Math.random() * 100,
        incidents_count: Math.floor(Math.random() * 3)
      };

      setMetrics(prev => {
        const updated = [...prev, newMetric];
        return updated.slice(-50); // Keep last 50 data points
      });
    };

    // Simulate alerts
    const simulateAlerts = () => {
      const alertTypes = [
        { severity: 'critical' as const, title: 'Camera Offline', message: 'Camera CAM-01 has been offline for 5 minutes', service: 'frame-puller' },
        { severity: 'warning' as const, title: 'High Latency', message: 'P95 latency exceeded 2s threshold', service: 'fusion' },
        { severity: 'warning' as const, title: 'Queue Backlog', message: 'Processing queue has 150+ items', service: 'analytics' },
        { severity: 'info' as const, title: 'System Update', message: 'New AI model deployed successfully', service: 'safetyvision' }
      ];

      if (Math.random() < 0.1) { // 10% chance of new alert
        const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
        setAlerts(prev => [{
          id: Math.random().toString(36),
          ...alert,
          timestamp: new Date().toISOString()
        }, ...prev].slice(0, 10));
      }
    };

    setIsConnected(true);
    updateMetrics(); // Initial data
    
    const metricsInterval = setInterval(updateMetrics, 2000);
    const alertsInterval = setInterval(simulateAlerts, 5000);

    return () => {
      clearInterval(metricsInterval);
      clearInterval(alertsInterval);
      setIsConnected(false);
    };
  }, []);

  const chartConfig = {
    fps: { label: "FPS", color: "hsl(var(--primary))" },
    latency: { label: "Latency (ms)", color: "hsl(var(--destructive))" },
    cpu: { label: "CPU %", color: "hsl(var(--chart-1))" },
    memory: { label: "Memory %", color: "hsl(var(--chart-2))" },
    gpu: { label: "GPU %", color: "hsl(var(--chart-3))" },
    detections: { label: "Detections/min", color: "hsl(var(--chart-4))" }
  };

  const latestMetrics = metrics[metrics.length - 1] || {} as SystemMetrics;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Real-Time Dashboard</h1>
          <p className="text-muted-foreground">Live system performance and monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
          <span className="text-sm text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average FPS</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestMetrics.fps?.toFixed(1) || '--'}</div>
            <Progress value={(latestMetrics.fps || 0) / 30 * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestMetrics.latency_p95?.toFixed(0) || '--'}ms</div>
            <div className={`text-xs mt-1 ${(latestMetrics.latency_p95 || 0) > 1500 ? 'text-destructive' : 'text-muted-foreground'}`}>
              Target: &lt;1500ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cameras</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{latestMetrics.active_cameras || '--'}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Queue: {latestMetrics.queue_depth || 0} items
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(latestMetrics.error_rate || 0) < 1 ? 'Healthy' : 'Degraded'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Error Rate: {(latestMetrics.error_rate || 0).toFixed(2)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="fps" 
                  stroke="var(--color-fps)" 
                  strokeWidth={2}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="latency_p95" 
                  stroke="var(--color-latency)" 
                  strokeWidth={2}
                  dot={false}
                  yAxisId="right"
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Resource Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                />
                <YAxis domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone" 
                  dataKey="cpu_usage" 
                  stackId="1"
                  stroke="var(--color-cpu)" 
                  fill="var(--color-cpu)"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="memory_usage" 
                  stackId="2"
                  stroke="var(--color-memory)" 
                  fill="var(--color-memory)"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="gpu_usage" 
                  stackId="3"
                  stroke="var(--color-gpu)" 
                  fill="var(--color-gpu)"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Detections Volume */}
        <Card>
          <CardHeader>
            <CardTitle>Detection Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={metrics.slice(-20)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()} 
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="detections_per_min" 
                  fill="var(--color-detections)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5" />
              <span>Active Alerts</span>
              <Badge variant="outline">{alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No active alerts
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Badge variant={getSeverityColor(alert.severity)} className="mt-0.5">
                      {alert.severity}
                    </Badge>
                    <div className="flex-1 space-y-1">
                      <div className="font-medium text-sm">{alert.title}</div>
                      <div className="text-xs text-muted-foreground">{alert.message}</div>
                      <div className="text-xs text-muted-foreground">
                        {alert.service} • {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>System Statistics (Last 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">1.2M</div>
              <div className="text-sm text-muted-foreground">Frames Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-chart-1">45,231</div>
              <div className="text-sm text-muted-foreground">Detections</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-chart-2">127</div>
              <div className="text-sm text-muted-foreground">Incidents</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-chart-3">99.8%</div>
              <div className="text-sm text-muted-foreground">Uptime</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}