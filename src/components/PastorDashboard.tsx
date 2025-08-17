import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  Clock, 
  MapPin, 
  BarChart3, 
  Download, 
  AlertTriangle,
  Heart,
  BookOpen,
  Coffee,
  Car,
  Shield,
  Eye,
  Printer
} from 'lucide-react';
import { useChurchAnalytics } from '@/hooks/useChurchAnalytics';

interface PastorDashboardProps {
  cameraId?: string;
}

export const PastorDashboard: React.FC<PastorDashboardProps> = ({ cameraId }) => {
  const { getTodayStats, events, analytics } = useChurchAnalytics(cameraId);
  const todayStats = getTodayStats();

  // Mock data for pastor-specific metrics
  const pastoralMetrics = {
    weeklyAttendance: [
      { service: 'Domingo Manhã', attendance: 285, capacity: 350, growth: +8 },
      { service: 'Domingo Noite', attendance: 195, capacity: 350, growth: +12 },
      { service: 'Quarta-feira', attendance: 120, capacity: 200, growth: +5 },
      { service: 'Sábado Jovens', attendance: 85, capacity: 150, growth: +15 }
    ],
    monthlyTrends: {
      averageAttendance: 246,
      peakAttendance: 312,
      growthRate: 9.2,
      newVisitors: 28,
      returningVisitors: 42
    },
    serviceInsights: {
      optimalCapacity: '80-85%',
      busyPeriods: ['9h-10h30', '19h-20h30'],
      parkingUtilization: 75,
      accessibilityUsage: 12
    }
  };

  const generateWeeklyReport = () => {
    // Mock function - in real app would generate PDF
    console.log('Generating weekly report...');
  };

  const generateMonthlyReport = () => {
    // Mock function - in real app would generate PDF  
    console.log('Generating monthly report...');
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Presença Hoje</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{todayStats.attendance}</div>
              <p className="text-sm text-muted-foreground">pessoas identificadas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Crescimento</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-green-500">+{pastoralMetrics.monthlyTrends.growthRate}%</div>
              <p className="text-sm text-muted-foreground">vs mês anterior</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-red-500" />
              <h3 className="font-semibold">Novos Visitantes</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{pastoralMetrics.monthlyTrends.newVisitors}</div>
              <p className="text-sm text-muted-foreground">este mês</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Eventos Segurança</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{todayStats.safety}</div>
              <p className="text-sm text-muted-foreground">hoje</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="attendance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="attendance">Frequência</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="pastoral">Pastoral</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Frequência Semanal por Culto</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastoralMetrics.weeklyAttendance.map((service, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{service.service}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={service.growth > 0 ? "default" : "secondary"}>
                          {service.growth > 0 ? '+' : ''}{service.growth}%
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {service.attendance}/{service.capacity}
                        </span>
                      </div>
                    </div>
                    <Progress 
                      value={(service.attendance / service.capacity) * 100} 
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      {Math.round((service.attendance / service.capacity) * 100)}% da capacidade
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Picos de Movimento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pastoralMetrics.serviceInsights.busyPeriods.map((period, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm">{period}</span>
                      <Badge variant="outline">Alta</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Utilização de Espaços</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Car className="h-4 w-4" />
                    <span className="text-sm">Estacionamento</span>
                  </div>
                  <span className="text-sm font-medium">{pastoralMetrics.serviceInsights.parkingUtilization}%</span>
                </div>
                <Progress value={pastoralMetrics.serviceInsights.parkingUtilization} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Acessibilidade</span>
                  </div>
                  <span className="text-sm font-medium">{pastoralMetrics.serviceInsights.accessibilityUsage} pessoas</span>
                </div>
                <Progress value={(pastoralMetrics.serviceInsights.accessibilityUsage / 50) * 100} className="h-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Insights Pastorais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center space-x-2 text-green-700 dark:text-green-300">
                      <TrendingUp className="h-4 w-4" />
                      <span className="font-medium">Crescimento Positivo</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Frequência aumentou 9.2% no último mês, especialmente no culto jovem
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-300">
                      <Users className="h-4 w-4" />
                      <span className="font-medium">Novos Membros</span>
                    </div>
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                      28 novos visitantes identificados este mês
                    </p>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center space-x-2 text-orange-700 dark:text-orange-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Atenção</span>
                    </div>
                    <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                      Estacionamento próximo do limite nos domingos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recomendações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Expandir Culto Jovem</p>
                    <p className="text-xs text-muted-foreground">Alto crescimento (+15%) sugere necessidade de mais espaço</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Melhorar Sinalização</p>
                    <p className="text-xs text-muted-foreground">Facilitar acesso para novos visitantes</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Horários Alternativos</p>
                    <p className="text-xs text-muted-foreground">Considerar culto adicional para desafogar domingo</p>
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
                <BarChart3 className="w-5 h-5" />
                <span>Relatórios Executivos</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Semanais</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Frequência e Crescimento</p>
                        <p className="text-xs text-muted-foreground">Análise detalhada por culto</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateWeeklyReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Visitantes e Membros</p>
                        <p className="text-xs text-muted-foreground">Análise de engajamento</p>
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
                        <p className="font-medium text-sm">Relatório Executivo</p>
                        <p className="text-xs text-muted-foreground">Visão geral e tendências</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateMonthlyReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Análise de Capacidade</p>
                        <p className="text-xs text-muted-foreground">Planejamento de espaços</p>
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

        <TabsContent value="pastoral" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BookOpen className="w-5 h-5" />
                  <span>Ministérios e Atividades</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Escola Dominical</span>
                    <Badge>45 alunos</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ministério Jovem</span>
                    <Badge>85 participantes</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Círculo de Oração</span>
                    <Badge>32 participantes</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ministério Infantil</span>
                    <Badge>28 crianças</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Privacidade e Segurança</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Modo Privacidade</span>
                    <Badge variant="outline">Alto</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anonimização</span>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção de Dados</span>
                    <Badge variant="outline">7 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conformidade LGPD</span>
                    <Badge variant="default">100%</Badge>
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