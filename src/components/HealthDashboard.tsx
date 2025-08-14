import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  TrendingUp,
  Server,
  AlertCircle,
  Wifi,
  Timer,
  BarChart3,
  RefreshCw,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ServiceStatus {
  service_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms: number;
  error_message?: string;
  uptime_percentage: number;
  last_check: string;
  metadata: any;
}

interface HealthMetric {
  id: string;
  service_name: string;
  metric_name: string;
  metric_value: number;
  timestamp: string;
  labels: any;
}

interface ActiveAlert {
  id: string;
  service_name: string;
  metric_name: string;
  current_value: number;
  threshold_value: number;
  severity: 'critical' | 'warning' | 'info';
  started_at: string;
  rule_name?: string;
}

const HealthDashboard: React.FC = () => {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const loadHealthData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('health-monitor', {
        body: { action: 'health' }
      });

      if (error) throw error;

      setServices(data.services || []);
      setAlerts(data.active_alerts || []);
      setLastUpdated(data.last_updated);

      // Load recent metrics
      const { data: metricsData, error: metricsError } = await supabase
        .from('health_metrics')
        .select('*')
        .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('timestamp', { ascending: false })
        .limit(500);

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

    } catch (error) {
      console.error('Error loading health data:', error);
      toast.error('Erro ao carregar dados de saúde');
    } finally {
      setLoading(false);
    }
  };

  const triggerHealthCheck = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('health-monitor', {
        body: { action: 'collect' }
      });

      if (error) throw error;

      toast.success('Verificação de saúde executada com sucesso');
      loadHealthData();
    } catch (error) {
      console.error('Error triggering health check:', error);
      toast.error('Erro ao executar verificação de saúde');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'healthy': { variant: 'default' as const, icon: CheckCircle, text: 'Saudável' },
      'degraded': { variant: 'secondary' as const, icon: AlertTriangle, text: 'Degradado' },
      'unhealthy': { variant: 'destructive' as const, icon: AlertCircle, text: 'Não Saudável' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.degraded;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    const severityConfig = {
      'critical': { variant: 'destructive' as const, text: 'Crítico' },
      'warning': { variant: 'secondary' as const, text: 'Aviso' },
      'info': { variant: 'outline' as const, text: 'Info' }
    };

    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;

    return (
      <Badge variant={config.variant}>
        {config.text}
      </Badge>
    );
  };

  const getMetricsByType = (metricName: string) => {
    return metrics
      .filter(m => m.metric_name === metricName)
      .slice(-20)
      .map(m => ({
        timestamp: new Date(m.timestamp).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        value: m.metric_value,
        service: m.service_name
      }));
  };

  const getOverallHealth = () => {
    if (services.length === 0) return 'unknown';
    if (services.every(s => s.status === 'healthy')) return 'healthy';
    if (services.some(s => s.status === 'unhealthy')) return 'unhealthy';
    return 'degraded';
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  useEffect(() => {
    loadHealthData();
    const interval = setInterval(loadHealthData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const overallHealth = getOverallHealth();
  const healthyServices = services.filter(s => s.status === 'healthy').length;
  const totalServices = services.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Painel de Saúde & Alertas</h1>
          <p className="text-muted-foreground">
            Monitoramento em tempo real da infraestrutura e alertas operacionais
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={triggerHealthCheck} disabled={loading} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Badge variant={overallHealth === 'healthy' ? 'default' : 'destructive'} className="text-sm">
            {overallHealth === 'healthy' ? 'Sistema Saudável' : 'Sistema com Problemas'}
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saúde Geral</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthyServices}/{totalServices}
            </div>
            <Progress value={(healthyServices / totalServices) * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              Serviços saudáveis
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas Ativos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {alerts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {alerts.filter(a => a.severity === 'critical').length} críticos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streams Ativas</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.find(m => m.metric_name === 'active_streams_count')?.metric_value || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Transmissões em tempo real
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Atualização</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {lastUpdated ? formatDateTime(lastUpdated) : 'Carregando...'}
            </div>
            <p className="text-xs text-muted-foreground">
              Dados coletados automaticamente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{alerts.length} alertas ativos</strong> - {alerts.filter(a => a.severity === 'critical').length} críticos, {alerts.filter(a => a.severity === 'warning').length} avisos
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Latência do Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getMetricsByType('pipeline_latency_p95_ms')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="w-5 h-5" />
                  Taxa de Stall de Streams
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={getMetricsByType('stream_stall_rate_percent')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#82ca9d" fill="#82ca9d" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status dos Serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo de Resposta</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Última Verificação</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.service_name}>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>{getStatusBadge(service.status)}</TableCell>
                      <TableCell>{service.response_time_ms}ms</TableCell>
                      <TableCell>{service.uptime_percentage.toFixed(2)}%</TableCell>
                      <TableCell>{formatDateTime(service.last_check)}</TableCell>
                      <TableCell className="text-red-500 text-sm">
                        {service.error_message || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Eventos por Hora</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={getMetricsByType('events_processed_per_hour')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Erro</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={getMetricsByType('error_rate_percent')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#ff6b6b" fill="#ff6b6b" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alertas Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>Nenhum alerta ativo no momento</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Métrica</TableHead>
                      <TableHead>Valor Atual</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Iniciado em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                        <TableCell>{alert.service_name}</TableCell>
                        <TableCell>{alert.metric_name}</TableCell>
                        <TableCell className="font-mono">
                          {alert.current_value.toFixed(2)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {alert.threshold_value.toFixed(2)}
                        </TableCell>
                        <TableCell>{formatDateTime(alert.started_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default HealthDashboard;