import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Activity, 
  BarChart3, 
  PieChart as PieChartIcon,
  Download,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';

interface KPI {
  name: string;
  value: number;
  unit: string;
  trend: number;
  target?: number;
  status: 'good' | 'warning' | 'critical';
}

interface DashboardData {
  kpis: KPI[];
  detectionTrends: Array<{
    timestamp: string;
    detections: number;
    incidents: number;
    accuracy: number;
  }>;
  performanceMetrics: Array<{
    metric: string;
    current: number;
    target: number;
    trend: number;
  }>;
  alerts: Array<{
    id: string;
    title: string;
    severity: 'high' | 'medium' | 'low';
    timestamp: string;
  }>;
}

export default function ExecutiveDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = () => {
      // Simulate API call
      setTimeout(() => {
        setDashboardData({
          kpis: [
            {
              name: 'Total Detections',
              value: 45231,
              unit: 'today',
              trend: 12.5,
              target: 40000,
              status: 'good'
            },
            {
              name: 'System Accuracy',
              value: 94.2,
              unit: '%',
              trend: 2.3,
              target: 95,
              status: 'warning'
            },
            {
              name: 'Response Time',
              value: 847,
              unit: 'ms',
              trend: -8.1,
              target: 1000,
              status: 'good'
            },
            {
              name: 'Active Incidents',
              value: 7,
              unit: 'open',
              trend: -15.3,
              target: 5,
              status: 'warning'
            },
            {
              name: 'Camera Uptime',
              value: 99.1,
              unit: '%',
              trend: 0.5,
              target: 99.5,
              status: 'warning'
            },
            {
              name: 'Processing Cost',
              value: 1.24,
              unit: '$/hour',
              trend: -5.2,
              target: 1.50,
              status: 'good'
            }
          ],
          detectionTrends: Array.from({ length: 24 }, (_, i) => ({
            timestamp: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
            detections: Math.floor(Math.random() * 2000) + 1500,
            incidents: Math.floor(Math.random() * 50) + 10,
            accuracy: 90 + Math.random() * 8
          })),
          performanceMetrics: [
            { metric: 'Frame Processing', current: 15.2, target: 15.0, trend: 1.3 },
            { metric: 'Model Inference', current: 45.7, target: 50.0, trend: -8.2 },
            { metric: 'Alert Generation', current: 2.1, target: 3.0, trend: -30.0 },
            { metric: 'Storage Usage', current: 78.5, target: 80.0, trend: 5.4 }
          ],
          alerts: [
            { id: '1', title: 'Camera CAM-12 offline for 15 minutes', severity: 'high', timestamp: '2024-01-15T10:30:00Z' },
            { id: '2', title: 'High detection volume in Zone A', severity: 'medium', timestamp: '2024-01-15T10:25:00Z' },
            { id: '3', title: 'Model accuracy below threshold', severity: 'medium', timestamp: '2024-01-15T10:20:00Z' },
            { id: '4', title: 'Storage capacity at 85%', severity: 'low', timestamp: '2024-01-15T10:15:00Z' }
          ]
        });
        setIsLoading(false);
      }, 1000);
    };

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [selectedPeriod]);

  const chartConfig = {
    detections: { label: "Detections", color: "hsl(var(--primary))" },
    incidents: { label: "Incidents", color: "hsl(var(--destructive))" },
    accuracy: { label: "Accuracy %", color: "hsl(var(--chart-1))" },
    performance: { label: "Performance", color: "hsl(var(--chart-2))" }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (isLoading || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading executive dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Executive Dashboard</h1>
          <p className="text-muted-foreground">Strategic insights and KPIs for decision making</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            {selectedPeriod}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dashboardData.kpis.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.name}</CardTitle>
              {getStatusIcon(kpi.status)}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {kpi.value.toLocaleString()} 
                <span className="text-sm font-normal text-muted-foreground ml-1">{kpi.unit}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className={`text-xs flex items-center ${kpi.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  <TrendingUp className={`h-3 w-3 mr-1 ${kpi.trend < 0 ? 'rotate-180' : ''}`} />
                  {Math.abs(kpi.trend)}%
                </div>
                {kpi.target && (
                  <div className="text-xs text-muted-foreground">
                    Target: {kpi.target.toLocaleString()}
                  </div>
                )}
              </div>
              {kpi.target && (
                <Progress 
                  value={(kpi.value / kpi.target) * 100} 
                  className="mt-2" 
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Detection Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detection Volume Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Detection Volume (24h)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <AreaChart data={dashboardData.detectionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).getHours() + ':00'} 
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area 
                      type="monotone" 
                      dataKey="detections" 
                      stroke="var(--color-detections)" 
                      fill="var(--color-detections)"
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Accuracy Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>System Accuracy</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <LineChart data={dashboardData.detectionTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).getHours() + ':00'} 
                    />
                    <YAxis domain={[85, 100]} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="accuracy" 
                      stroke="var(--color-accuracy)" 
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance vs Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <BarChart data={dashboardData.performanceMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="current" fill="var(--color-performance)" />
                    <Bar dataKey="target" fill="var(--color-performance)" fillOpacity={0.3} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Performance Metrics Table */}
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData.performanceMetrics.map((metric, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{metric.metric}</div>
                        <div className="text-sm text-muted-foreground">
                          Target: {metric.target}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{metric.current}</div>
                        <div className={`text-sm flex items-center ${metric.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <TrendingUp className={`h-3 w-3 mr-1 ${metric.trend < 0 ? 'rotate-180' : ''}`} />
                          {Math.abs(metric.trend)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Active Alerts</span>
                <Badge variant="outline">{dashboardData.alerts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge variant={getSeverityColor(alert.severity)}>
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <div>
                        <div className="font-medium">{alert.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI-Generated Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">📈 Performance Trend</h4>
                  <p className="text-sm text-muted-foreground">
                    Detection accuracy has improved by 2.3% over the last 24 hours, primarily due to 
                    optimized model parameters. Consider maintaining current configuration.
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">⚠️ Attention Required</h4>
                  <p className="text-sm text-muted-foreground">
                    Camera CAM-12 has been offline for 15 minutes. This may impact coverage in 
                    Zone C. Recommend immediate maintenance check.
                  </p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">💡 Optimization Opportunity</h4>
                  <p className="text-sm text-muted-foreground">
                    Processing costs can be reduced by 12% by implementing smart frame sampling 
                    during low-activity periods (2-6 AM).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Immediate Actions</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1">
                    <li>• Check camera CAM-12 connectivity</li>
                    <li>• Review model accuracy threshold settings</li>
                    <li>• Schedule storage cleanup for next maintenance window</li>
                  </ul>
                </div>
                <div className="p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-950">
                  <h4 className="font-medium text-green-900 dark:text-green-100">Strategic Improvements</h4>
                  <ul className="text-sm text-green-800 dark:text-green-200 mt-2 space-y-1">
                    <li>• Implement dynamic frame sampling</li>
                    <li>• Deploy additional cameras in high-traffic zones</li>
                    <li>• Consider edge processing for critical areas</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}