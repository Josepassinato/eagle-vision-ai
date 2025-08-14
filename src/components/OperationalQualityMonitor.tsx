import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Clock, 
  Shield, 
  FileCheck, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Activity,
  Zap,
  Database,
  Mail,
  Download
} from 'lucide-react';
import { toast } from 'sonner';

interface LatencyMetric {
  service: string;
  p50: number;
  p95: number;
  p99: number;
  target_p95: number;
  status: 'good' | 'warning' | 'critical';
}

interface StabilityMetric {
  service: string;
  uptime_percentage: number;
  avg_recovery_time: number;
  circuit_breaker_state: 'closed' | 'open' | 'half_open';
  queue_size: number;
  queue_limit: number;
  last_failure: string | null;
}

interface AuditMetric {
  total_events: number;
  events_with_explain: number;
  clips_with_hash: number;
  retention_compliance: number;
  avg_clip_generation_time: number;
}

interface OperationalQuality {
  latency: LatencyMetric[];
  stability: StabilityMetric[];
  audit: AuditMetric;
  last_updated: string;
}

export const OperationalQualityMonitor: React.FC = () => {
  const [qualityData, setQualityData] = useState<OperationalQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    fetchQualityMetrics();
    const interval = setInterval(fetchQualityMetrics, 30000); // Update every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchQualityMetrics = async () => {
    try {
      const response = await fetch('/api/operational-quality/metrics');
      if (!response.ok) throw new Error('Failed to fetch metrics');
      
      const data = await response.json();
      setQualityData(data);
    } catch (error) {
      console.error('Error fetching quality metrics:', error);
      toast.error('Failed to fetch operational metrics');
    } finally {
      setLoading(false);
    }
  };

  const generateDailyReport = async () => {
    setGeneratingReport(true);
    try {
      const response = await fetch('/api/operational-quality/daily-report', {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      const result = await response.json();
      toast.success(`Daily report generated and sent to ${result.recipients} recipients`);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate daily report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadReport = async (format: 'csv' | 'pdf') => {
    try {
      const response = await fetch(`/api/operational-quality/export?format=${format}`);
      if (!response.ok) throw new Error('Failed to download report');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `operational-quality-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-accent rounded w-1/4"></div>
                <div className="h-8 bg-accent rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!qualityData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to load operational quality metrics. Please check your connection and try again.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Operational Quality Monitor</h1>
          <p className="text-muted-foreground mt-2">
            Real-time monitoring of system performance and operational requirements
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(qualityData.last_updated).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => downloadReport('csv')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
          <Button onClick={() => downloadReport('pdf')} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button 
            onClick={generateDailyReport} 
            disabled={generatingReport}
            size="sm"
          >
            <Mail className="h-4 w-4 mr-2" />
            {generatingReport ? 'Generating...' : 'Send Daily Report'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="latency" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="latency">Latency</TabsTrigger>
          <TabsTrigger value="stability">Stability</TabsTrigger>
          <TabsTrigger value="audit">Auditability</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Latency Tab */}
        <TabsContent value="latency" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Latency Performance
              </CardTitle>
              <CardDescription>
                Target: Detector p95 &lt; 120ms, Fusion p95 &lt; 600ms, Clip ready &lt; 10s
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {qualityData.latency.map((metric, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{metric.service}</span>
                        <Badge variant={metric.status === 'good' ? 'default' : metric.status === 'warning' ? 'secondary' : 'destructive'}>
                          {metric.status}
                        </Badge>
                      </div>
                      {getStatusIcon(metric.status)}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">P50</div>
                        <div className="font-mono">{metric.p50}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P95</div>
                        <div className={`font-mono ${metric.p95 > metric.target_p95 ? 'text-red-600' : 'text-green-600'}`}>
                          {metric.p95}ms
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">P99</div>
                        <div className="font-mono">{metric.p99}ms</div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Target P95: {metric.target_p95}ms</span>
                        <span>{((metric.target_p95 - metric.p95) / metric.target_p95 * 100).toFixed(1)}% margin</span>
                      </div>
                      <Progress 
                        value={Math.min(100, (metric.p95 / metric.target_p95) * 100)} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stability Tab */}
        <TabsContent value="stability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Stability
              </CardTitle>
              <CardDescription>
                Target: Stall recovery &lt; 10s, bounded queues, circuit breaker protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {qualityData.stability.map((metric, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold">{metric.service}</span>
                      <Badge variant={metric.uptime_percentage > 99.5 ? 'default' : metric.uptime_percentage > 95 ? 'secondary' : 'destructive'}>
                        {metric.uptime_percentage.toFixed(2)}% uptime
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Avg Recovery Time</div>
                        <div className={`font-mono ${metric.avg_recovery_time > 10 ? 'text-red-600' : 'text-green-600'}`}>
                          {metric.avg_recovery_time.toFixed(1)}s
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Circuit Breaker</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            metric.circuit_breaker_state === 'closed' ? 'bg-green-500' :
                            metric.circuit_breaker_state === 'half_open' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="capitalize">{metric.circuit_breaker_state.replace('_', '-')}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="text-muted-foreground text-xs mb-1">Queue Utilization</div>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(metric.queue_size / metric.queue_limit) * 100} 
                          className="flex-1 h-2"
                        />
                        <span className="text-xs font-mono">
                          {metric.queue_size}/{metric.queue_limit}
                        </span>
                      </div>
                    </div>
                    
                    {metric.last_failure && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Last failure: {new Date(metric.last_failure).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                Auditability & Compliance
              </CardTitle>
              <CardDescription>
                Event traceability, clip integrity, and retention compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Events with Explain Payload</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-2xl font-bold">
                        {((qualityData.audit.events_with_explain / qualityData.audit.total_events) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ({qualityData.audit.events_with_explain.toLocaleString()} / {qualityData.audit.total_events.toLocaleString()})
                      </div>
                    </div>
                    <Progress 
                      value={(qualityData.audit.events_with_explain / qualityData.audit.total_events) * 100} 
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Clips with Hash Verification</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-2xl font-bold">
                        {((qualityData.audit.clips_with_hash / qualityData.audit.total_events) * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ({qualityData.audit.clips_with_hash.toLocaleString()} clips)
                      </div>
                    </div>
                    <Progress 
                      value={(qualityData.audit.clips_with_hash / qualityData.audit.total_events) * 100} 
                      className="mt-2"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Retention Compliance</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="text-2xl font-bold">
                        {qualityData.audit.retention_compliance.toFixed(1)}%
                      </div>
                      <Badge variant={qualityData.audit.retention_compliance > 95 ? 'default' : 'destructive'}>
                        {qualityData.audit.retention_compliance > 95 ? 'Compliant' : 'Issues'}
                      </Badge>
                    </div>
                    <Progress 
                      value={qualityData.audit.retention_compliance} 
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <div className="text-sm text-muted-foreground">Avg Clip Generation Time</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={`text-2xl font-bold ${qualityData.audit.avg_clip_generation_time > 10 ? 'text-red-600' : 'text-green-600'}`}>
                        {qualityData.audit.avg_clip_generation_time.toFixed(1)}s
                      </div>
                      <Badge variant={qualityData.audit.avg_clip_generation_time <= 10 ? 'default' : 'destructive'}>
                        Target: &lt;10s
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Zap className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-semibold">Latency Health</h3>
                    <p className="text-sm text-muted-foreground">
                      {qualityData.latency.filter(m => m.status === 'good').length} / {qualityData.latency.length} services optimal
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="font-semibold">Stability Score</h3>
                    <p className="text-sm text-muted-foreground">
                      {(qualityData.stability.reduce((acc, s) => acc + s.uptime_percentage, 0) / qualityData.stability.length).toFixed(1)}% avg uptime
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Database className="h-8 w-8 text-purple-500" />
                  <div>
                    <h3 className="font-semibold">Audit Coverage</h3>
                    <p className="text-sm text-muted-foreground">
                      {((qualityData.audit.events_with_explain / qualityData.audit.total_events) * 100).toFixed(1)}% events traced
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Critical Issues Alert */}
          {(qualityData.latency.some(m => m.status === 'critical') || 
            qualityData.stability.some(s => s.uptime_percentage < 95) ||
            qualityData.audit.retention_compliance < 95) && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical issues detected:</strong> Some services are not meeting operational requirements. 
                Immediate attention required to ensure system reliability.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};