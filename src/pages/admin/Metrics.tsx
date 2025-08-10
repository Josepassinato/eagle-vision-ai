import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, AlertTriangle, Database, HardDrive } from "lucide-react";

interface MetricData {
  metric: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
}

interface AlertData {
  alertname: string;
  severity: string;
  summary: string;
  status: 'firing' | 'resolved';
}

export default function Metrics() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching metrics data
    const fetchMetrics = async () => {
      // In a real implementation, these would come from Prometheus API
      setMetrics([
        { metric: "FPS Médio", value: 24.5, unit: "fps", status: 'good' },
        { metric: "Latência P90", value: 850, unit: "ms", status: 'good' },
        { metric: "Eventos/min", value: 15, unit: "/min", status: 'good' },
        { metric: "CPU Total", value: 65, unit: "%", status: 'warning' },
        { metric: "Memória", value: 78, unit: "%", status: 'warning' },
        { metric: "GPU Utilização", value: 45, unit: "%", status: 'good' },
        { metric: "Queue Length", value: 12, unit: "items", status: 'good' },
        { metric: "Espaço em Disco", value: 15, unit: "GB livres", status: 'critical' }
      ]);

      setAlerts([
        { alertname: "DiskSpaceLow", severity: "critical", summary: "Espaço em disco baixo", status: 'firing' },
        { alertname: "MemoryUsageHigh", severity: "warning", summary: "Uso alto de memória", status: 'firing' }
      ]);
      
      setLoading(false);
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'bg-success/20 text-success border-success/30';
      case 'warning': return 'bg-warning/20 text-warning border-warning/30';
      case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Activity className="h-6 w-6 animate-pulse" />
              <span className="ml-2">Carregando métricas...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas Ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, index) => (
              <Alert key={index} className={alert.severity === 'critical' ? 'border-destructive' : 'border-warning'}>
                <AlertDescription className="flex items-center justify-between">
                  <span>{alert.summary}</span>
                  <Badge variant={getSeverityVariant(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Métricas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${getStatusColor(metric.status)}`}
              >
                <div className="text-sm font-medium">{metric.metric}</div>
                <div className="text-2xl font-bold">
                  {metric.value}
                  <span className="text-sm font-normal ml-1">{metric.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dashboards Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardContent className="p-6 text-center">
            <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Desempenho</h3>
            <p className="text-sm text-muted-foreground">Latência, FPS, Workers</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardContent className="p-6 text-center">
            <Database className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Fluxo</h3>
            <p className="text-sm text-muted-foreground">Pessoas, Veículos, Eventos</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
          <CardContent className="p-6 text-center">
            <HardDrive className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold">Sistema</h3>
            <p className="text-sm text-muted-foreground">CPU, Memória, GPU</p>
          </CardContent>
        </Card>
      </div>

      {/* Grafana Embed */}
      <Card>
        <CardHeader>
          <CardTitle>Grafana Dashboards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="aspect-video rounded-lg border bg-muted/20 flex items-center justify-center">
              <div className="text-center">
                <Database className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Acesse os dashboards do Grafana em:{" "}
                  <code className="bg-muted px-2 py-1 rounded">localhost:3001</code>
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
