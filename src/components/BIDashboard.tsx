import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  BarChart3, 
  TrendingUp, 
  Download, 
  FileText, 
  Database,
  Clock,
  Users,
  Activity,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Service {
  id: string;
  name: string;
  start_time: string;
  end_time?: string;
  status: string;
}

interface SyncStatus {
  configurations: any[];
  recent_logs: any[];
  metrics: {
    total_syncs: number;
    success_rate: string;
    avg_latency_ms: number;
    last_sync: string;
  };
  data_freshness_seconds: number;
}

interface Report {
  id: string;
  report_type: string;
  report_name: string;
  status: string;
  created_at: string;
  file_path?: string;
  file_size_bytes?: number;
}

const BIDashboard = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [occupancyData, setOccupancyData] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState<any>(null);

  // Mock tenant API key for demo
  const mockApiKey = "vsk_demo_12345_abcdef";

  useEffect(() => {
    fetchServices();
    fetchReports();
    fetchSyncStatus();
  }, []);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('start_time', { ascending: false })
        .limit(20);

      if (error) throw error;
      setServices(data || []);
      if (data && data.length > 0 && !selectedService) {
        setSelectedService(data[0]);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar serviços",
        variant: "destructive"
      });
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bigquery-sync/status', {
        headers: { 'x-api-key': mockApiKey }
      });

      if (error) throw error;
      setSyncStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bi-reports/reports', {
        headers: { 'x-api-key': mockApiKey }
      });

      if (error) throw error;
      setReports(data.reports || []);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const syncToBigQuery = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('bigquery-sync/sync', {
        method: 'POST',
        headers: { 'x-api-key': mockApiKey }
      });

      if (error) throw error;

      toast({
        title: "Sincronização Iniciada",
        description: `${data.sync_result.events_inserted} eventos sincronizados em ${data.sync_result.latency_ms}ms`
      });

      fetchSyncStatus();
    } catch (error) {
      console.error('Error syncing to BigQuery:', error);
      toast({
        title: "Erro",
        description: "Erro ao sincronizar com BigQuery",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDFReport = async () => {
    if (!selectedService) {
      toast({
        title: "Erro",
        description: "Selecione um serviço primeiro",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('bi-reports/generate-pdf', {
        method: 'POST',
        body: { 
          service_id: selectedService.id,
          report_type: 'service_summary'
        },
        headers: { 'x-api-key': mockApiKey }
      });

      if (error) throw error;

      toast({
        title: "Relatório Gerado",
        description: `PDF em geração (ID: ${data.report_id})`
      });

      fetchReports();
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar relatório PDF",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = async (format: string) => {
    if (!selectedService) {
      toast({
        title: "Erro",
        description: "Selecione um serviço primeiro",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(`https://avbswnnywjyvqfxezgfl.supabase.co/functions/v1/bi-reports/export-csv?service_id=${selectedService.id}&format=${format}`, {
        headers: { 'x-api-key': mockApiKey }
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${format}_${selectedService.name.replace(/\s+/g, '_')}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Exportação Concluída",
        description: `Arquivo CSV baixado com sucesso`
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({
        title: "Erro",
        description: "Erro ao exportar CSV",
        variant: "destructive"
      });
    }
  };

  // Mock data for charts
  const mockOccupancyData = [
    { time: '09:00', count: 0 },
    { time: '09:15', count: 12 },
    { time: '09:30', count: 45 },
    { time: '09:45', count: 89 },
    { time: '10:00', count: 156 },
    { time: '10:15', count: 203 },
    { time: '10:30', count: 187 },
    { time: '10:45', count: 165 },
    { time: '11:00', count: 142 },
    { time: '11:15', count: 98 },
    { time: '11:30', count: 45 },
    { time: '11:45', count: 12 }
  ];

  const mockVisitorData = [
    { name: 'Membros', value: 75, color: '#8884d8' },
    { name: 'Visitantes Recorrentes', value: 15, color: '#82ca9d' },
    { name: 'Novos Visitantes', value: 10, color: '#ffc658' }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Concluído</Badge>;
      case 'generating':
        return <Badge variant="secondary">Gerando</Badge>;
      case 'failed':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">BI & Relatórios</h1>
          <p className="text-muted-foreground">
            BigQuery + Looker Studio + Geração de PDF
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Latência ≤ 60s
        </Badge>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard Pastor</TabsTrigger>
          <TabsTrigger value="bigquery">BigQuery Sync</TabsTrigger>
          <TabsTrigger value="reports">Relatórios PDF</TabsTrigger>
          <TabsTrigger value="export">Exportar Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Presentes Agora</span>
                </div>
                <div className="text-2xl font-bold">203</div>
                <p className="text-xs text-muted-foreground">+15% vs. semana passada</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Pico de Ocupação</span>
                </div>
                <div className="text-2xl font-bold">203</div>
                <p className="text-xs text-muted-foreground">às 10:15</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Novos Visitantes</span>
                </div>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">hoje</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">Incidentes</span>
                </div>
                <div className="text-2xl font-bold">0</div>
                <p className="text-xs text-muted-foreground">nenhum hoje</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Curva de Ocupação</CardTitle>
                <CardDescription>Fluxo de pessoas durante o culto</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={mockOccupancyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composição de Visitantes</CardTitle>
                <CardDescription>Distribuição por tipo de visitante</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={mockVisitorData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}%`}
                    >
                      {mockVisitorData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Acesso ao Looker Studio</CardTitle>
              <CardDescription>Dashboard interativo para análise avançada</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button variant="outline" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Abrir Dashboard do Pastor
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Dashboard de Analytics
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Mapa de Calor
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bigquery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Status do BigQuery Sync
              </CardTitle>
              <CardDescription>
                Sincronização em tempo quase real com latência ≤ 60s
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm font-medium">Taxa de Sucesso</div>
                  <div className="text-2xl font-bold text-green-600">
                    {syncStatus?.metrics.success_rate || 0}%
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm font-medium">Latência Média</div>
                  <div className="text-2xl font-bold">
                    {syncStatus?.metrics.avg_latency_ms || 0}ms
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm font-medium">Dados Atualizados</div>
                  <div className="text-2xl font-bold">
                    {syncStatus?.data_freshness_seconds || 0}s atrás
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={syncToBigQuery}
                  disabled={isLoading}
                  className="flex items-center gap-2"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Sincronizar Agora
                </Button>
                <Button variant="outline" onClick={fetchSyncStatus}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {syncStatus?.recent_logs && (
                <div>
                  <h4 className="font-semibold mb-2">Logs Recentes</h4>
                  <div className="space-y-2">
                    {syncStatus.recent_logs.slice(0, 5).map((log, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <span className="text-sm">{log.sync_type}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {log.records_processed} registros
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                            {log.status}
                          </Badge>
                          <span className="text-xs">{log.latency_ms}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Geração de Relatórios PDF
              </CardTitle>
              <CardDescription>
                Relatórios completos com 1 clique ao término do culto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select 
                  value={selectedService?.id || ""} 
                  onValueChange={(value) => {
                    const service = services.find(s => s.id === value);
                    setSelectedService(service || null);
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {new Date(service.start_time).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button 
                  onClick={generatePDFReport}
                  disabled={isLoading || !selectedService}
                  className="flex items-center gap-2"
                >
                  {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <FileText className="w-4 h-4" />
                  Gerar Relatório PDF
                </Button>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Relatórios Gerados</h4>
                <div className="grid gap-3">
                  {reports.map((report) => (
                    <Card key={report.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="font-medium">{report.report_name}</h5>
                            <p className="text-sm text-muted-foreground">
                              {new Date(report.created_at).toLocaleString()}
                            </p>
                            {report.file_size_bytes && (
                              <p className="text-xs text-muted-foreground">
                                {Math.round(report.file_size_bytes / 1024)} KB
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(report.status)}
                            {report.status === 'completed' && (
                              <Button size="sm" variant="outline">
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Exportação CSV
              </CardTitle>
              <CardDescription>
                Exporte dados por culto ou período via API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select 
                  value={selectedService?.id || ""} 
                  onValueChange={(value) => {
                    const service = services.find(s => s.id === value);
                    setSelectedService(service || null);
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {new Date(service.start_time).toLocaleDateString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => exportCSV('attendance')}
                  disabled={!selectedService}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar Presença
                </Button>
                <Button 
                  onClick={() => exportCSV('events')}
                  disabled={!selectedService}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar Eventos
                </Button>
                <Button 
                  onClick={() => exportCSV('visitors')}
                  disabled={!selectedService}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Exportar Visitantes
                </Button>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Conteúdo dos Relatórios PDF:</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Total de pessoas presentes</li>
                  <li>• Curvas de fluxo de entrada/saída</li>
                  <li>• Análise de visitantes (recorrência)</li>
                  <li>• Timeline de incidentes com links para clips</li>
                  <li>• Picos de chegada e ocupação máxima</li>
                  <li>• Mapa de calor (se câmera superior)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BIDashboard;