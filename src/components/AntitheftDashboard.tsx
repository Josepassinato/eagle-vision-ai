import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  ShoppingCart, 
  AlertTriangle, 
  TrendingDown, 
  Download, 
  Eye,
  Activity,
  FileText,
  Clock,
  DollarSign,
  Camera,
  Target,
  Settings
} from 'lucide-react';

interface AntitheftDashboardProps {
  cameraId?: string;
}

export const AntitheftDashboard: React.FC<AntitheftDashboardProps> = ({ cameraId }) => {
  // Mock data específico para antifurto no varejo
  const antitheftMetrics = {
    dailyStats: {
      customersToday: 1247,
      suspiciousActivities: 8,
      preventedLosses: 1250.00,
      detectionAccuracy: 96.8
    },
    behaviorAnalysis: [
      { behavior: 'Procurar na Bolsa', incidents: 12, riskLevel: 'Médio' },
      { behavior: 'Permanência Excessiva', incidents: 5, riskLevel: 'Baixo' },
      { behavior: 'Movimentação Suspeita', incidents: 3, riskLevel: 'Alto' },
      { behavior: 'Pessoa Correndo', incidents: 2, riskLevel: 'Alto' }
    ],
    lossPreventionStats: {
      weeklyLosses: 2840.50,
      preventionRate: 78,
      averageIncidentValue: 95.80,
      roiImprovement: 23.5
    },
    timeAnalysis: {
      peakRiskHours: ['10h-12h', '14h-16h', '18h-20h'],
      lowRiskHours: ['08h-10h', '12h-14h', '20h-22h']
    }
  };

  const generateAntitheftReport = () => {
    console.log('Generating antitheft report...');
  };

  const getRiskColor = (level: string) => {
    const colors = {
      'Baixo': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Médio': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Alto': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[level as keyof typeof colors] || colors['Baixo'];
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Clientes Hoje</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{antitheftMetrics.dailyStats.customersToday}</div>
              <p className="text-sm text-muted-foreground">visitaram a loja</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Atividades Suspeitas</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{antitheftMetrics.dailyStats.suspiciousActivities}</div>
              <p className="text-sm text-muted-foreground">detectadas hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Perdas Evitadas</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-green-500">R$ {antitheftMetrics.dailyStats.preventedLosses.toFixed(2)}</div>
              <p className="text-sm text-muted-foreground">economia hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Precisão</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-blue-500">{antitheftMetrics.dailyStats.detectionAccuracy}%</div>
              <p className="text-sm text-muted-foreground">detecção IA</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="behavior" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="behavior">Comportamentos</TabsTrigger>
          <TabsTrigger value="losses">Perdas & ROI</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="behavior" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5" />
                <span>Análise de Comportamentos Suspeitos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {antitheftMetrics.behaviorAnalysis.map((behavior, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{behavior.behavior}</span>
                      <div className="flex items-center space-x-2">
                        <Badge className={getRiskColor(behavior.riskLevel)}>
                          {behavior.riskLevel}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {behavior.incidents} ocorrências
                        </span>
                      </div>
                    </div>
                    <Progress value={(behavior.incidents / 15) * 100} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Frequência: {behavior.incidents} detecções hoje
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Horários de Maior Risco</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {antitheftMetrics.timeAnalysis.peakRiskHours.map((hour, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 text-red-500" />
                    <span className="text-sm">{hour}</span>
                    <Badge variant="destructive">Alto Risco</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horários de Menor Risco</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {antitheftMetrics.timeAnalysis.lowRiskHours.map((hour, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Clock className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{hour}</span>
                    <Badge variant="outline">Baixo Risco</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="losses" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Prevenção de Perdas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 dark:text-green-300 font-medium">Perdas Semanais</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">R$ {antitheftMetrics.lossPreventionStats.weeklyLosses}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Taxa de Prevenção</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{antitheftMetrics.lossPreventionStats.preventionRate}%</span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-700 dark:text-purple-300 font-medium">Valor Médio Incidente</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold">R$ {antitheftMetrics.lossPreventionStats.averageIncidentValue}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ROI e Melhorias</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg">
                  <TrendingDown className="h-12 w-12 text-primary mx-auto mb-4" />
                  <div className="text-3xl font-bold text-primary mb-2">
                    +{antitheftMetrics.lossPreventionStats.roiImprovement}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Melhoria no ROI desde implementação
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Redução 23% em Perdas</p>
                      <p className="text-xs text-muted-foreground">Comparado ao período anterior</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Detecção Mais Rápida</p>
                      <p className="text-xs text-muted-foreground">Tempo médio de resposta: 45 segundos</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Relatórios de Prevenção de Perdas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Diários</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Incidentes e Comportamentos</p>
                        <p className="text-xs text-muted-foreground">Análise detalhada com evidências</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateAntitheftReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Perdas Evitadas</p>
                        <p className="text-xs text-muted-foreground">Cálculo de ROI e economia</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Mensais</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Análise Estratégica</p>
                        <p className="text-xs text-muted-foreground">Tendências e padrões de furto</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">ROI e Performance</p>
                        <p className="text-xs text-muted-foreground">Métricas executivas</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Detecção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Procurar na Bolsa</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Movimentação Suspeita</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Permanência Excessiva</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alertas em Tempo Real</span>
                    <Badge variant="outline">Configurado</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Privacidade e Conformidade</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anonimização Clientes</span>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conformidade LGPD</span>
                    <Badge variant="default">100%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção de Dados</span>
                    <Badge variant="outline">30 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auditoria Forense</span>
                    <Badge variant="default">Habilitada</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};