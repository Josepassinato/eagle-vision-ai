import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Car, 
  Shield, 
  TrendingUp, 
  Download, 
  Camera,
  Activity,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  Building
} from 'lucide-react';

interface LPRDashboardProps {
  cameraId?: string;
}

export const LPRDashboard: React.FC<LPRDashboardProps> = ({ cameraId }) => {
  // Mock data específico para LPR (License Plate Recognition)
  const lprMetrics = {
    dailyStats: {
      vehiclesDetected: 892,
      platesRead: 847,
      accessGranted: 756,
      accessDenied: 91
    },
    accessAnalysis: [
      { gate: 'Portão Principal', vehicles: 423, readRate: 98.2, authorized: 387 },
      { gate: 'Portão Funcionários', vehicles: 234, readRate: 96.8, authorized: 229 },
      { gate: 'Portão Fornecedores', vehicles: 145, readRate: 94.5, authorized: 98 },
      { gate: 'Garagem VIP', vehicles: 90, readRate: 100, authorized: 90 }
    ],
    securityEvents: {
      unauthorizedAttempts: 12,
      blacklistedVehicles: 3,
      visitorOverstay: 8,
      emergencyAccess: 2
    },
    weeklyTrends: {
      readAccuracy: 97.8,
      accessEfficiency: 94.2,
      securityCompliance: 99.1
    }
  };

  const generateLPRReport = () => {
    console.log('Generating LPR report...');
  };

  const getReadRateColor = (rate: number) => {
    if (rate >= 98) return 'text-green-500';
    if (rate >= 95) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Car className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Veículos Detectados</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{lprMetrics.dailyStats.vehiclesDetected}</div>
              <p className="text-sm text-muted-foreground">passaram pelos portões</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Placas Lidas</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{lprMetrics.dailyStats.platesRead}</div>
              <p className="text-sm text-muted-foreground">identificação bem-sucedida</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Acessos Liberados</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-green-500">{lprMetrics.dailyStats.accessGranted}</div>
              <p className="text-sm text-muted-foreground">autorizações concedidas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold">Acessos Negados</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-red-500">{lprMetrics.dailyStats.accessDenied}</div>
              <p className="text-sm text-muted-foreground">tentativas bloqueadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="access" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="access">Controle de Acesso</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5" />
                <span>Performance por Portão de Acesso</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lprMetrics.accessAnalysis.map((gate, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{gate.gate}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={gate.readRate >= 98 ? "default" : "secondary"}>
                          {gate.readRate}% leitura
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {gate.vehicles} veículos
                        </span>
                      </div>
                    </div>
                    <Progress value={gate.readRate} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Taxa de leitura: {gate.readRate}%</span>
                      <span>Autorizados: {gate.authorized}/{gate.vehicles}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Métricas de Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Precisão de Leitura</span>
                  <Badge variant="default">{lprMetrics.weeklyTrends.readAccuracy}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Eficiência de Acesso</span>
                  <Badge variant="default">{lprMetrics.weeklyTrends.accessEfficiency}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Conformidade Segurança</span>
                  <Badge variant="default">{lprMetrics.weeklyTrends.securityCompliance}%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Horários de Pico</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">07h-09h</span>
                  <Badge variant="outline">Entrada Funcionários</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">12h-14h</span>
                  <Badge variant="outline">Almoço</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">17h-19h</span>
                  <Badge variant="outline">Saída Funcionários</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Eventos de Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <span className="text-red-700 dark:text-red-300 font-medium">Tentativas Não Autorizadas</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">{lprMetrics.securityEvents.unauthorizedAttempts}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-black dark:bg-gray-950 rounded-lg border border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-100 font-medium">Veículos na Lista Negra</span>
                      <span className="text-gray-100 font-bold">{lprMetrics.securityEvents.blacklistedVehicles}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 dark:text-orange-300 font-medium">Visitantes com Tempo Excedido</span>
                      <span className="text-orange-600 dark:text-orange-400 font-bold">{lprMetrics.securityEvents.visitorOverstay}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-700 dark:text-blue-300 font-medium">Acessos de Emergência</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">{lprMetrics.securityEvents.emergencyAccess}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações de Segurança</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Revisar Lista de Acesso</p>
                    <p className="text-xs text-muted-foreground">12 tentativas não autorizadas requerem análise</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Monitorar Veículos Suspeitos</p>
                    <p className="text-xs text-muted-foreground">3 veículos da lista negra detectados</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Otimizar Fluxo de Visitantes</p>
                    <p className="text-xs text-muted-foreground">Implementar notificações de tempo limite</p>
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
                <span>Relatórios de Controle de Acesso</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Diários</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Log de Acessos</p>
                        <p className="text-xs text-muted-foreground">Registro completo de entrada/saída</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateLPRReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Eventos de Segurança</p>
                        <p className="text-xs text-muted-foreground">Tentativas não autorizadas e alertas</p>
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
                        <p className="font-medium text-sm">Análise de Performance</p>
                        <p className="text-xs text-muted-foreground">Métricas de eficiência e precisão</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Auditoria de Acesso</p>
                        <p className="text-xs text-muted-foreground">Relatório para compliance</p>
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
                <CardTitle>Configurações de LPR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detecção de Placas</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">OCR Avançado</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Validação em Tempo Real</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alertas Automáticos</span>
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
                    <span className="text-sm">Anonimização Dados</span>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conformidade LGPD</span>
                    <Badge variant="default">100%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção de Logs</span>
                    <Badge variant="outline">90 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auditoria de Acesso</span>
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