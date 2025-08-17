import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Download, 
  HardHat,
  Activity,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  Factory
} from 'lucide-react';

interface SafetyVisionDashboardProps {
  cameraId?: string;
}

export const SafetyVisionDashboard: React.FC<SafetyVisionDashboardProps> = ({ cameraId }) => {
  // Mock data específico para segurança industrial
  const safetyMetrics = {
    dailyStats: {
      workersPresent: 156,
      ppeCompliance: 94.2,
      safetyIncidents: 2,
      riskLevel: 'Baixo'
    },
    ppeAnalysis: [
      { area: 'Zona Industrial A', workers: 45, compliance: 98, missing: 'Capacete' },
      { area: 'Zona Industrial B', workers: 38, compliance: 89, missing: 'Óculos' },
      { area: 'Área de Soldagem', workers: 22, compliance: 100, missing: 'N/A' },
      { area: 'Depósito', workers: 51, compliance: 92, missing: 'Colete' }
    ],
    incidentTypes: {
      noHardHat: 3,
      noSafetyGlasses: 5,
      noReflectiveVest: 2,
      improperProcedure: 1
    },
    weeklyTrends: {
      complianceImprovement: 3.2,
      incidentReduction: 15.5,
      safetyScore: 9.1
    }
  };

  const generateSafetyReport = () => {
    console.log('Generating safety report...');
  };

  const getRiskLevelColor = (level: string) => {
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
              <HardHat className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Trabalhadores</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{safetyMetrics.dailyStats.workersPresent}</div>
              <p className="text-sm text-muted-foreground">ativos na área</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Conformidade EPI</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-green-500">{safetyMetrics.dailyStats.ppeCompliance}%</div>
              <p className="text-sm text-muted-foreground">meta: &gt;95%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Incidentes Hoje</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{safetyMetrics.dailyStats.safetyIncidents}</div>
              <p className="text-sm text-muted-foreground">não conformidades</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Nível de Risco</h3>
            </div>
            <div className="mt-2">
              <Badge className={getRiskLevelColor(safetyMetrics.dailyStats.riskLevel)}>
                {safetyMetrics.dailyStats.riskLevel}
              </Badge>
              <p className="text-sm text-muted-foreground mt-1">avaliação geral</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="compliance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compliance">Conformidade EPI</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
          <TabsTrigger value="reports">Relatórios HST</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Factory className="w-5 h-5" />
                <span>Conformidade EPI por Área</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {safetyMetrics.ppeAnalysis.map((area, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{area.area}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={area.compliance >= 95 ? "default" : "secondary"}>
                          {area.compliance}%
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {area.workers} trabalhadores
                        </span>
                      </div>
                    </div>
                    <Progress value={area.compliance} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {area.missing !== 'N/A' ? `Principal não conformidade: ${area.missing}` : 'Área em total conformidade'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tendências de Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Melhoria Conformidade</span>
                  <Badge variant="default">+{safetyMetrics.weeklyTrends.complianceImprovement}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Redução Incidentes</span>
                  <Badge variant="default">-{safetyMetrics.weeklyTrends.incidentReduction}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Score de Segurança</span>
                  <Badge variant="default">{safetyMetrics.weeklyTrends.safetyScore}/10</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horários de Maior Risco</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">06h-08h</span>
                  <Badge variant="outline">Troca de Turno</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-red-500" />
                  <span className="text-sm">14h-16h</span>
                  <Badge variant="destructive">Pico de Risco</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">22h-00h</span>
                  <Badge variant="outline">Fim de Turno</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Não Conformidade</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <span className="text-red-700 dark:text-red-300 font-medium">Sem Capacete</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">{safetyMetrics.incidentTypes.noHardHat}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 dark:text-orange-300 font-medium">Sem Óculos de Proteção</span>
                      <span className="text-orange-600 dark:text-orange-400 font-bold">{safetyMetrics.incidentTypes.noSafetyGlasses}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center justify-between">
                      <span className="text-yellow-700 dark:text-yellow-300 font-medium">Sem Colete Refletivo</span>
                      <span className="text-yellow-600 dark:text-yellow-400 font-bold">{safetyMetrics.incidentTypes.noReflectiveVest}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-700 dark:text-purple-300 font-medium">Procedimento Inadequado</span>
                      <span className="text-purple-600 dark:text-purple-400 font-bold">{safetyMetrics.incidentTypes.improperProcedure}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações de Melhoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Reforçar Treinamento EPI</p>
                    <p className="text-xs text-muted-foreground">Foco em uso correto de óculos de proteção</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Supervisão Intensiva</p>
                    <p className="text-xs text-muted-foreground">Período 14h-16h requer acompanhamento</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Auditoria de Procedimentos</p>
                    <p className="text-xs text-muted-foreground">Revisar protocolos de segurança</p>
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
                <span>Relatórios HST (Higiene, Segurança e Trabalho)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Diários</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Conformidade EPI</p>
                        <p className="text-xs text-muted-foreground">Status por área e turno</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateSafetyReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Incidentes e Não Conformidades</p>
                        <p className="text-xs text-muted-foreground">Registro detalhado com imagens</p>
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
                        <p className="font-medium text-sm">Análise de Segurança</p>
                        <p className="text-xs text-muted-foreground">KPIs e tendências HST</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Auditoria de Conformidade</p>
                        <p className="text-xs text-muted-foreground">Relatório para órgãos reguladores</p>
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
                <CardTitle>Configurações de Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detecção de Capacete</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detecção de Óculos</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detecção de Colete</span>
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
                    <span className="text-sm">Anonimização Trabalhadores</span>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conformidade NR-12</span>
                    <Badge variant="default">100%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção de Dados</span>
                    <Badge variant="outline">60 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auditoria HST</span>
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