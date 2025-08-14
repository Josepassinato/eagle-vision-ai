import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Settings,
  Eye,
  Cpu,
  Layers,
  Video,
  Clock,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Activity,
  Zap,
  Target,
  FileSearch
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SystemParameter {
  id: string;
  category: string;
  parameter_name: string;
  parameter_value: any;
  default_value: any;
  min_value?: any;
  max_value?: any;
  description: string;
  is_active: boolean;
}

interface SLAMetric {
  id: string;
  metric_name: string;
  current_value: number;
  target_value: number;
  threshold_type: string;
  measurement_window: string;
  status: string;
  last_measurement: string;
  metadata: any;
}

const SystemParametersManager: React.FC = () => {
  const [parameters, setParameters] = useState<SystemParameter[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, any>>({});

  const loadParameters = async () => {
    try {
      const { data, error } = await supabase
        .from('system_parameters')
        .select('*')
        .order('category', { ascending: true })
        .order('parameter_name', { ascending: true });

      if (error) throw error;
      setParameters(data || []);
    } catch (error) {
      console.error('Error loading parameters:', error);
      toast.error('Erro ao carregar parâmetros');
    }
  };

  const loadSLAMetrics = async () => {
    try {
      const { data, error } = await supabase
        .from('sla_metrics')
        .select('*')
        .order('metric_name');

      if (error) throw error;
      setSlaMetrics(data || []);
    } catch (error) {
      console.error('Error loading SLA metrics:', error);
      toast.error('Erro ao carregar métricas SLA');
    }
  };

  const updateParameter = (parameterId: string, newValue: any) => {
    setChanges(prev => ({
      ...prev,
      [parameterId]: newValue
    }));
  };

  const saveChanges = async () => {
    if (Object.keys(changes).length === 0) {
      toast.error('Nenhuma alteração para salvar');
      return;
    }

    setSaving(true);
    try {
      // Update each parameter individually
      for (const [id, value] of Object.entries(changes)) {
        const { error } = await supabase
          .from('system_parameters')
          .update({ 
            parameter_value: JSON.stringify(value),
            updated_at: new Date().toISOString()
          })
          .eq('id', id);
          
        if (error) throw error;
      }

      toast.success(`${Object.keys(changes).length} parâmetros atualizados com sucesso`);
      setChanges({});
      loadParameters();
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('Erro ao salvar parâmetros');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm('Tem certeza que deseja resetar todos os parâmetros para os valores padrão?')) {
      return;
    }

    setSaving(true);
    try {
      // Update each parameter individually to default values
      for (const param of parameters) {
        const { error } = await supabase
          .from('system_parameters')
          .update({ 
            parameter_value: param.default_value,
            updated_at: new Date().toISOString()
          })
          .eq('id', param.id);
          
        if (error) throw error;
      }

      toast.success('Parâmetros resetados para valores padrão');
      setChanges({});
      loadParameters();
    } catch (error) {
      console.error('Error resetting parameters:', error);
      toast.error('Erro ao resetar parâmetros');
    } finally {
      setSaving(false);
    }
  };

  const getParameterValue = (param: SystemParameter) => {
    const paramId = param.id;
    if (changes[paramId] !== undefined) {
      return changes[paramId];
    }
    return typeof param.parameter_value === 'string' 
      ? JSON.parse(param.parameter_value) 
      : param.parameter_value;
  };

  const renderParameterInput = (param: SystemParameter) => {
    const value = getParameterValue(param);
    const isBoolean = typeof value === 'boolean';
    const isNumber = typeof value === 'number';
    const hasMinMax = param.min_value && param.max_value;

    if (isBoolean) {
      return (
        <Switch
          checked={value}
          onCheckedChange={(checked) => updateParameter(param.id, checked)}
        />
      );
    }

    if (isNumber && hasMinMax) {
      const min = typeof param.min_value === 'string' ? JSON.parse(param.min_value) : param.min_value;
      const max = typeof param.max_value === 'string' ? JSON.parse(param.max_value) : param.max_value;
      
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <Slider
              value={[value]}
              onValueChange={(newValue) => updateParameter(param.id, newValue[0])}
              min={min}
              max={max}
              step={max > 10 ? 1 : 0.01}
              className="flex-1"
            />
            <Badge variant="outline" className="min-w-[60px] text-center">
              {value}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Min: {min} | Max: {max}
          </div>
        </div>
      );
    }

    return (
      <Input
        type={isNumber ? 'number' : 'text'}
        value={value}
        onChange={(e) => {
          const newValue = isNumber ? parseFloat(e.target.value) : e.target.value;
          updateParameter(param.id, newValue);
        }}
        className="w-full"
      />
    );
  };

  const getCategoryIcon = (category: string) => {
    const iconMap = {
      'yolo': Cpu,
      'face': Eye,
      'reid': Layers,
      'fusion': Zap,
      'clip': Video,
      'retention': Clock
    };
    return iconMap[category as keyof typeof iconMap] || Settings;
  };

  const getCategoryName = (category: string) => {
    const nameMap = {
      'yolo': 'YOLO Detection',
      'face': 'Face Recognition',
      'reid': 'Re-Identification',
      'fusion': 'Multi-Signal Fusion',
      'clip': 'Video Clips',
      'retention': 'Data Retention'
    };
    return nameMap[category as keyof typeof nameMap] || category;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'met': { variant: 'default' as const, icon: CheckCircle, text: 'Atendido' },
      'warning': { variant: 'secondary' as const, icon: AlertCircle, text: 'Atenção' },
      'failed': { variant: 'destructive' as const, icon: AlertCircle, text: 'Falhou' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.warning;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const formatMetricValue = (value: number, metricName: string) => {
    if (metricName.includes('percentage')) {
      return `${value.toFixed(1)}%`;
    }
    if (metricName.includes('latency') || metricName.includes('time')) {
      return value < 1 ? `${(value * 1000).toFixed(0)}ms` : `${value.toFixed(1)}s`;
    }
    if (metricName.includes('days')) {
      return `${value} dias`;
    }
    return value.toString();
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([loadParameters(), loadSLAMetrics()])
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(parameters.map(p => p.category))];
  const hasChanges = Object.keys(changes).length > 0;
  const slaCompliance = slaMetrics.filter(m => m.status === 'met').length / slaMetrics.length * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Parâmetros do Sistema</h1>
          <p className="text-muted-foreground">
            Configurações recomendadas e critérios de aceite (Definition of Done)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={resetToDefaults} variant="outline" disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetar Padrões
          </Button>
          <Button onClick={saveChanges} disabled={!hasChanges || saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Salvando...' : `Salvar ${Object.keys(changes).length} Alterações`}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <Alert>
          <Settings className="h-4 w-4" />
          <AlertDescription>
            Você tem {Object.keys(changes).length} alterações não salvas. Clique em "Salvar" para aplicar.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="parameters" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="parameters" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Parâmetros
          </TabsTrigger>
          <TabsTrigger value="sla" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Definition of Done
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parameters" className="space-y-4">
          {categories.map(category => {
            const categoryParams = parameters.filter(p => p.category === category);
            const Icon = getCategoryIcon(category);

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    {getCategoryName(category)}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {categoryParams.length} parâmetros configuráveis
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {categoryParams.map(param => (
                      <div key={param.id} className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 border rounded-lg">
                        <div>
                          <Label className="font-medium">{param.parameter_name}</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {param.description}
                          </p>
                        </div>
                        <div className="flex items-center">
                          {renderParameterInput(param)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {changes[param.id] !== undefined && (
                            <Badge variant="outline" className="mb-2">
                              Alterado
                            </Badge>
                          )}
                          <div>
                            Padrão: {typeof param.default_value === 'string' 
                              ? JSON.parse(param.default_value).toString() 
                              : param.default_value.toString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="sla" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Critérios de Aceite (Definition of Done)
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Compliance Geral: {slaCompliance.toFixed(1)}%
                </div>
                <Progress value={slaCompliance} className="flex-1 max-w-xs" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {/* Reliability Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Confiabilidade de Ingestão
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {slaMetrics
                      .filter(m => ['ingestion_drops_72h', 'stall_recovery_time_seconds', 'pipeline_frozen_incidents'].includes(m.metric_name))
                      .map(metric => (
                        <Card key={metric.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">
                                {metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              {getStatusBadge(metric.status)}
                            </div>
                            <div className="text-2xl font-bold">
                              {formatMetricValue(metric.current_value, metric.metric_name)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Target: {formatMetricValue(metric.target_value, metric.metric_name)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Latency Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Latência (1080p @ 15-20 FPS)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {slaMetrics
                      .filter(m => ['detection_latency_p95_ms', 'decision_latency_p95_ms', 'clip_availability_seconds'].includes(m.metric_name))
                      .map(metric => (
                        <Card key={metric.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">
                                {metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              {getStatusBadge(metric.status)}
                            </div>
                            <div className="text-2xl font-bold">
                              {formatMetricValue(metric.current_value, metric.metric_name)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Target: {formatMetricValue(metric.target_value, metric.metric_name)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Quality & Reports Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileSearch className="w-5 h-5" />
                    Qualidade & Relatórios
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {slaMetrics
                      .filter(m => ['relevant_events_percentage', 'daily_report_delivered', 'critical_alerts_count'].includes(m.metric_name))
                      .map(metric => (
                        <Card key={metric.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">
                                {metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              {getStatusBadge(metric.status)}
                            </div>
                            <div className="text-2xl font-bold">
                              {formatMetricValue(metric.current_value, metric.metric_name)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Target: {formatMetricValue(metric.target_value, metric.metric_name)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                  </div>
                </div>

                {/* Summary Table */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-4">Resumo Detalhado</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Métrica</TableHead>
                        <TableHead>Valor Atual</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Janela</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Última Medição</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slaMetrics.map((metric) => (
                        <TableRow key={metric.id}>
                          <TableCell className="font-medium">
                            {metric.metric_name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </TableCell>
                          <TableCell>
                            {formatMetricValue(metric.current_value, metric.metric_name)}
                          </TableCell>
                          <TableCell>
                            {formatMetricValue(metric.target_value, metric.metric_name)}
                          </TableCell>
                          <TableCell>{metric.measurement_window}</TableCell>
                          <TableCell>{getStatusBadge(metric.status)}</TableCell>
                          <TableCell>
                            {new Date(metric.last_measurement).toLocaleString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemParametersManager;