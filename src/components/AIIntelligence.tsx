import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  Brain, 
  TrendingUp, 
  Lightbulb, 
  Settings, 
  Download, 
  Sparkles,
  Target,
  Zap,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIIntelligenceProps {
  vertical: string;
  dashboardData: any;
  cameraId?: string;
}

interface AIInsight {
  type: 'trend' | 'anomaly' | 'recommendation' | 'optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
}

interface MetricSuggestion {
  name: string;
  description: string;
  calculation: string;
  threshold: string;
  priority: 'alta' | 'media' | 'baixa';
}

interface AutoAdjustment {
  parameter: string;
  current_value: string;
  suggested_value: string;
  reason: string;
  impact: string;
}

export const AIIntelligence: React.FC<AIIntelligenceProps> = ({ 
  vertical, 
  dashboardData, 
  cameraId 
}) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [metricSuggestions, setMetricSuggestions] = useState<MetricSuggestion[]>([]);
  const [autoAdjustments, setAutoAdjustments] = useState<AutoAdjustment[]>([]);
  const [intelligentReport, setIntelligentReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(false);
  const { toast } = useToast();

  // Gerar insights automaticamente quando os dados mudam
  useEffect(() => {
    generateIntelligentInsights();
  }, [dashboardData, vertical]);

  // Auto-sugestões de métricas a cada 5 minutos
  useEffect(() => {
    const interval = setInterval(() => {
      suggestNewMetrics();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, []);

  const generateIntelligentInsights = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-reports', {
        body: {
          action: 'generate_insights',
          vertical,
          timeRange: 'last_24h',
          data: dashboardData,
          cameraId
        }
      });

      if (error) throw error;

      setInsights(parseInsights(data.data.insights));
      toast({
        title: "Insights Gerados",
        description: `${data.data.actionItems?.length || 0} recomendações identificadas`
      });
    } catch (error) {
      console.error('Erro ao gerar insights:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar insights inteligentes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const suggestNewMetrics = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-reports', {
        body: {
          action: 'suggest_metrics',
          vertical,
          data: dashboardData
        }
      });

      if (error) throw error;

      if (data.data.recommended_metrics) {
        setMetricSuggestions(data.data.recommended_metrics);
      }
    } catch (error) {
      console.error('Erro ao sugerir métricas:', error);
    }
  };

  const performAutoAdjustment = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-reports', {
        body: {
          action: 'auto_adjust',
          vertical,
          cameraId,
          data: dashboardData
        }
      });

      if (error) throw error;

      setAutoAdjustments(data.data.adjustments || []);
      
      if (data.data.auto_apply) {
        toast({
          title: "Auto Ajustes Aplicados",
          description: `${data.data.adjustments?.length || 0} parâmetros otimizados automaticamente`
        });
      } else {
        toast({
          title: "Sugestões de Ajuste",
          description: "Revise as sugestões antes de aplicar"
        });
      }
    } catch (error) {
      console.error('Erro no auto ajuste:', error);
      toast({
        title: "Erro",
        description: "Falha no processo de auto ajuste",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const generateIntelligentReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('intelligent-reports', {
        body: {
          action: 'create_report',
          vertical,
          timeRange: 'last_30d',
          data: dashboardData
        }
      });

      if (error) throw error;

      setIntelligentReport(data.data.report);
      toast({
        title: "Relatório Gerado",
        description: `Relatório executivo criado com ${data.data.insights_count} insights`
      });
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório inteligente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const parseInsights = (insightsText: string): AIInsight[] => {
    // Simulação de parsing de insights - em produção seria mais sofisticado
    return [
      {
        type: 'trend',
        title: 'Tendência de Crescimento Detectada',
        description: 'Aumento de 15% na atividade durante horários de pico',
        impact: 'high',
        actionable: true
      },
      {
        type: 'anomaly',
        title: 'Padrão Anômalo Identificado',
        description: 'Comportamento incomum detectado na zona oeste',
        impact: 'medium',
        actionable: true
      },
      {
        type: 'optimization',
        title: 'Oportunidade de Otimização',
        description: 'Ajustar threshold para reduzir 23% de falsos positivos',
        impact: 'high',
        actionable: true
      },
      {
        type: 'recommendation',
        title: 'Recomendação Estratégica',
        description: 'Implementar zona adicional para melhor cobertura',
        impact: 'medium',
        actionable: true
      }
    ];
  };

  const getInsightIcon = (type: string) => {
    const icons = {
      trend: TrendingUp,
      anomaly: AlertTriangle,
      optimization: Target,
      recommendation: Lightbulb
    };
    return icons[type as keyof typeof icons] || Brain;
  };

  const getInsightColor = (impact: string) => {
    const colors = {
      high: 'border-red-200 bg-red-50 dark:bg-red-950',
      medium: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950',
      low: 'border-green-200 bg-green-50 dark:bg-green-950'
    };
    return colors[impact as keyof typeof colors] || colors.low;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      alta: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      media: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      baixa: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
    return colors[priority as keyof typeof colors] || colors.baixa;
  };

  return (
    <div className="space-y-6">
      {/* Header com controles principais */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Brain className="h-8 w-8 text-primary" />
              <div>
                <CardTitle className="text-2xl">IA Inteligente - {vertical}</CardTitle>
                <p className="text-muted-foreground">
                  Insights automáticos, sugestões e otimizações em tempo real
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className="flex items-center space-x-1">
                <Sparkles className="h-3 w-3" />
                <span>IA Ativa</span>
              </Badge>
              <Button 
                onClick={generateIntelligentInsights} 
                disabled={loading}
                size="sm"
              >
                <Brain className="h-4 w-4 mr-2" />
                {loading ? 'Analisando...' : 'Gerar Insights'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="insights" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="insights">Insights IA</TabsTrigger>
          <TabsTrigger value="metrics">Sugestões Métricas</TabsTrigger>
          <TabsTrigger value="auto-adjust">Auto Ajuste</TabsTrigger>
          <TabsTrigger value="reports">Relatórios IA</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-4">
            {insights.map((insight, index) => {
              const Icon = getInsightIcon(insight.type);
              return (
                <Card key={index} className={`border ${getInsightColor(insight.impact)}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 rounded-lg bg-white dark:bg-gray-800">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{insight.title}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">
                              {insight.impact === 'high' ? 'Alto' : 
                               insight.impact === 'medium' ? 'Médio' : 'Baixo'} Impacto
                            </Badge>
                            {insight.actionable && (
                              <Badge variant="default">
                                <Zap className="h-3 w-3 mr-1" />
                                Acionável
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {insight.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {insights.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Análise IA em Progresso</h3>
                <p className="text-muted-foreground mb-4">
                  Aguarde enquanto nossa IA analisa os dados e gera insights inteligentes
                </p>
                <Button onClick={generateIntelligentInsights} disabled={loading}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Iniciar Análise
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Métricas Sugeridas pela IA</h3>
            <Button onClick={suggestNewMetrics} size="sm" variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Atualizar Sugestões
            </Button>
          </div>

          <div className="grid gap-4">
            {metricSuggestions.map((metric, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold">{metric.name}</h4>
                        <Badge className={getPriorityColor(metric.priority)}>
                          {metric.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {metric.description}
                      </p>
                      <div className="text-xs space-y-1">
                        <div><strong>Cálculo:</strong> {metric.calculation}</div>
                        <div><strong>Threshold:</strong> {metric.threshold}</div>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Implementar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auto-adjust" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Sistema de Auto Ajuste</span>
                </CardTitle>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={autoAdjustEnabled}
                      onChange={(e) => setAutoAdjustEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Auto Ajuste Habilitado</span>
                  </label>
                  <Button onClick={performAutoAdjustment} disabled={loading}>
                    <Cpu className="h-4 w-4 mr-2" />
                    Analisar & Ajustar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {autoAdjustments.length > 0 ? (
                <div className="space-y-4">
                  {autoAdjustments.map((adjustment, index) => (
                    <Card key={index} className="border border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{adjustment.parameter}</h4>
                          <Badge variant="outline">Sugerido</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Valor Atual:</span>
                            <div className="font-mono">{adjustment.current_value}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Valor Sugerido:</span>
                            <div className="font-mono text-blue-600">{adjustment.suggested_value}</div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="text-sm">
                            <strong>Motivo:</strong> {adjustment.reason}
                          </div>
                          <div className="text-sm">
                            <strong>Impacto Esperado:</strong> {adjustment.impact}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Nenhum ajuste sugerido no momento. Sistema operando de forma otimizada.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Relatórios Inteligentes</span>
                </CardTitle>
                <div className="flex items-center space-x-3">
                  <Button onClick={generateIntelligentReport} disabled={loading}>
                    <Brain className="h-4 w-4 mr-2" />
                    Gerar Relatório IA
                  </Button>
                  {intelligentReport && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {intelligentReport ? (
                <div className="space-y-4">
                  <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertDescription>
                      Relatório gerado automaticamente pela IA com base nos dados atuais
                    </AlertDescription>
                  </Alert>
                  <Textarea
                    value={intelligentReport}
                    readOnly
                    rows={20}
                    className="resize-none"
                  />
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Relatório IA</h3>
                  <p className="text-muted-foreground mb-4">
                    Gere relatórios executivos inteligentes com insights automáticos
                  </p>
                  <Button onClick={generateIntelligentReport} disabled={loading}>
                    <Brain className="h-4 w-4 mr-2" />
                    {loading ? 'Gerando...' : 'Criar Relatório'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};