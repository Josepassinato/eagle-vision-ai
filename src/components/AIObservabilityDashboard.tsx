import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart
} from 'recharts';
import { 
  Activity, Brain, Camera, Clock, Target, Zap, AlertTriangle, TrendingUp,
  Cpu, MemoryStick, HardDrive, Network, Eye, Filter
} from 'lucide-react';

interface AIMetrics {
  id: string;
  timestamp: string;
  camera_id: string;
  processing_latency_ms: number;
  inference_latency_ms: number;
  fps_actual: number;
  fps_target: number;
  confidence_avg: number;
  confidence_p50: number;
  confidence_p95: number;
  detection_count: number;
  false_positive_rate: number;
  class_distribution: any;
  zone_coverage: any;
  motion_activity: number;
  confidence_drift: number;
  distribution_shift: number;
  cpu_usage_percent: number;
  memory_usage_mb: number;
  gpu_usage_percent: number;
  aggregation_period: string;
}

interface Camera {
  id: string;
  name: string;
  online: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function AIObservabilityDashboard() {
  const [metrics, setMetrics] = useState<AIMetrics[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCameras();
    loadMetrics();
  }, [selectedCamera, timeRange]);

  const loadCameras = async () => {
    try {
      const { data, error } = await supabase
        .from('cameras')
        .select('id, name, online')
        .order('name');
      
      if (error) throw error;
      setCameras(data || []);
    } catch (error) {
      console.error('Error loading cameras:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      
      let query = supabase
        .from('ai_metrics')
        .select('*')
        .order('timestamp', { ascending: false });

      if (selectedCamera !== 'all') {
        query = query.eq('camera_id', selectedCamera);
      }

      // Time range filtering
      const timeRangeHours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
      const cutoffTime = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000).toISOString();
      query = query.gte('timestamp', cutoffTime);

      const { data, error } = await query.limit(1000);
      
      if (error) throw error;
      setMetrics(data || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate summary statistics
  const summaryStats = metrics.length > 0 ? {
    avgLatency: metrics.reduce((acc, m) => acc + (m.processing_latency_ms || 0), 0) / metrics.length,
    avgFPS: metrics.reduce((acc, m) => acc + (m.fps_actual || 0), 0) / metrics.length,
    avgConfidence: metrics.reduce((acc, m) => acc + (m.confidence_avg || 0), 0) / metrics.length,
    totalDetections: metrics.reduce((acc, m) => acc + (m.detection_count || 0), 0),
    avgFPRate: metrics.reduce((acc, m) => acc + (m.false_positive_rate || 0), 0) / metrics.length,
    avgCPU: metrics.reduce((acc, m) => acc + (m.cpu_usage_percent || 0), 0) / metrics.length,
    avgMemory: metrics.reduce((acc, m) => acc + (m.memory_usage_mb || 0), 0) / metrics.length,
    avgDrift: metrics.reduce((acc, m) => acc + (m.confidence_drift || 0), 0) / metrics.length
  } : null;

  // Prepare chart data
  const latencyData = metrics.slice(-50).map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    processing: m.processing_latency_ms,
    inference: m.inference_latency_ms,
    fps: m.fps_actual
  }));

  const confidenceData = metrics.slice(-50).map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    avg: m.confidence_avg,
    p50: m.confidence_p50,
    p95: m.confidence_p95,
    drift: m.confidence_drift
  }));

  // Class distribution aggregation
  const classDistribution = metrics.reduce((acc, m) => {
    const distribution = m.class_distribution as Record<string, number> || {};
    Object.entries(distribution).forEach(([cls, count]) => {
      acc[cls] = (acc[cls] || 0) + (typeof count === 'number' ? count : 0);
    });
    return acc;
  }, {} as Record<string, number>);

  const classChartData = Object.entries(classDistribution).map(([name, value]) => ({
    name,
    value
  }));

  const resourceData = metrics.slice(-50).map(m => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    cpu: m.cpu_usage_percent,
    memory: m.memory_usage_mb,
    gpu: m.gpu_usage_percent
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-6 w-6" />
          <h2 className="text-2xl font-bold">AI Observability Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <Select value={selectedCamera} onValueChange={setSelectedCamera}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cameras</SelectItem>
              {cameras.map((camera) => (
                <SelectItem key={camera.id} value={camera.id}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${camera.online ? 'bg-green-500' : 'bg-red-500'}`} />
                    {camera.name || camera.id}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.avgLatency.toFixed(0)}ms</div>
              <p className="text-xs text-muted-foreground">Processing time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg FPS</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summaryStats.avgFPS.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">Frames per second</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summaryStats.avgConfidence * 100).toFixed(1)}%</div>
              <Badge variant={summaryStats.avgDrift > 0.1 ? 'destructive' : 'default'}>
                Drift: {(summaryStats.avgDrift * 100).toFixed(1)}%
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summaryStats.avgFPRate * 100).toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {summaryStats.totalDetections} total detections
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Latency Trends
                </CardTitle>
                <CardDescription>Processing and inference latency over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={latencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="processing" stroke="#8884d8" name="Processing (ms)" />
                    <Line type="monotone" dataKey="inference" stroke="#82ca9d" name="Inference (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  FPS Performance
                </CardTitle>
                <CardDescription>Actual frames processed per second</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={latencyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="fps" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Confidence Metrics
                </CardTitle>
                <CardDescription>Detection confidence distribution and drift</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avg" stroke="#8884d8" name="Average" />
                    <Line type="monotone" dataKey="p50" stroke="#82ca9d" name="P50" />
                    <Line type="monotone" dataKey="p95" stroke="#ffc658" name="P95" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Model Drift
                </CardTitle>
                <CardDescription>Confidence drift indicating model degradation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={confidenceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="drift" 
                      stroke="#ff7300" 
                      fill="#ff7300" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Class Distribution
                </CardTitle>
                <CardDescription>Detected object classes over time period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={classChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {classChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Detection Volume
                </CardTitle>
                <CardDescription>Total detections by class type</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={classChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  CPU Usage
                </CardTitle>
                <CardDescription>Processor utilization over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={resourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="cpu" stroke="#8884d8" fill="#8884d8" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MemoryStick className="h-5 w-5" />
                  Memory Usage
                </CardTitle>
                <CardDescription>Memory consumption in MB</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={resourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="memory" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  GPU Usage
                </CardTitle>
                <CardDescription>Graphics processor utilization</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={resourceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="gpu" stroke="#ffc658" fill="#ffc658" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {summaryStats && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Cpu className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-2xl font-bold">{summaryStats.avgCPU.toFixed(1)}%</div>
                    <p className="text-sm text-muted-foreground">Average CPU</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <MemoryStick className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-2xl font-bold">{(summaryStats.avgMemory / 1024).toFixed(1)}GB</div>
                    <p className="text-sm text-muted-foreground">Average Memory</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <HardDrive className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                    <div className="text-2xl font-bold">N/A</div>
                    <p className="text-sm text-muted-foreground">GPU Usage</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}