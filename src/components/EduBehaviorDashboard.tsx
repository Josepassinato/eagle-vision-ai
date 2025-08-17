import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  BarChart3, 
  Download, 
  AlertTriangle,
  BookOpen,
  GraduationCap,
  School,
  UserCheck,
  Brain,
  FileText,
  Clock,
  Award,
  Eye
} from 'lucide-react';

interface EduBehaviorDashboardProps {
  cameraId?: string;
}

export const EduBehaviorDashboard: React.FC<EduBehaviorDashboardProps> = ({ cameraId }) => {
  // Mock data específico para educação
  const educationMetrics = {
    dailyStats: {
      studentsPresent: 847,
      averageAttentionLevel: 78,
      behaviorAlerts: 3,
      attendanceRate: 94.2
    },
    classroomInsights: [
      { room: 'Sala 101 - Matemática', students: 32, attentionLevel: 85, engagement: 'Alto' },
      { room: 'Sala 202 - História', students: 28, attentionLevel: 72, engagement: 'Médio' },
      { room: 'Sala 303 - Ciências', students: 30, attentionLevel: 91, engagement: 'Alto' },
      { room: 'Auditório', students: 120, attentionLevel: 68, engagement: 'Médio' }
    ],
    behaviorAnalysis: {
      positiveInteractions: 89,
      needsAttention: 12,
      disruptiveBehavior: 3,
      participationRate: 76
    },
    weeklyTrends: {
      attendanceGrowth: 2.1,
      engagementImprovement: 5.8,
      behaviorScore: 8.4
    }
  };

  const generateEducationReport = () => {
    console.log('Generating education report...');
  };

  return (
    <div className="space-y-6">
      {/* Header com métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Estudantes Presentes</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{educationMetrics.dailyStats.studentsPresent}</div>
              <p className="text-sm text-muted-foreground">de 900 matriculados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Nível de Atenção</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{educationMetrics.dailyStats.averageAttentionLevel}%</div>
              <p className="text-sm text-muted-foreground">média geral</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-5 w-5 text-green-500" />
              <h3 className="font-semibold">Taxa Presença</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-green-500">{educationMetrics.dailyStats.attendanceRate}%</div>
              <p className="text-sm text-muted-foreground">hoje</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <h3 className="font-semibold">Alertas Comportamento</h3>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold">{educationMetrics.dailyStats.behaviorAlerts}</div>
              <p className="text-sm text-muted-foreground">requerem atenção</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="classrooms" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="classrooms">Salas de Aula</TabsTrigger>
          <TabsTrigger value="behavior">Comportamento</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="classrooms" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <School className="w-5 h-5" />
                <span>Monitoramento por Sala de Aula</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {educationMetrics.classroomInsights.map((classroom, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{classroom.room}</span>
                      <div className="flex items-center space-x-2">
                        <Badge variant={classroom.engagement === 'Alto' ? "default" : "secondary"}>
                          {classroom.engagement}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {classroom.students} estudantes
                        </span>
                      </div>
                    </div>
                    <Progress value={classroom.attentionLevel} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Nível de atenção: {classroom.attentionLevel}%
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tendências Semanais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Crescimento Presença</span>
                  <Badge variant="default">+{educationMetrics.weeklyTrends.attendanceGrowth}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Melhoria Engajamento</span>
                  <Badge variant="default">+{educationMetrics.weeklyTrends.engagementImprovement}%</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Score Comportamental</span>
                  <Badge variant="default">{educationMetrics.weeklyTrends.behaviorScore}/10</Badge>
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
                  <span className="text-sm">08h-10h</span>
                  <Badge variant="outline">Entrada</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">10h-12h</span>
                  <Badge variant="outline">Alto Engajamento</Badge>
                </div>
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">14h-16h</span>
                  <Badge variant="outline">Pós-Almoço</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Análise Comportamental</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center justify-between">
                      <span className="text-green-700 dark:text-green-300 font-medium">Interações Positivas</span>
                      <span className="text-green-600 dark:text-green-400 font-bold">{educationMetrics.behaviorAnalysis.positiveInteractions}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 dark:text-orange-300 font-medium">Precisam de Atenção</span>
                      <span className="text-orange-600 dark:text-orange-400 font-bold">{educationMetrics.behaviorAnalysis.needsAttention}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <span className="text-red-700 dark:text-red-300 font-medium">Comportamento Disruptivo</span>
                      <span className="text-red-600 dark:text-red-400 font-bold">{educationMetrics.behaviorAnalysis.disruptiveBehavior}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recomendações Pedagógicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Aumentar Interatividade</p>
                    <p className="text-xs text-muted-foreground">Salas com baixo engajamento se beneficiariam de atividades práticas</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Pausas Estratégicas</p>
                    <p className="text-xs text-muted-foreground">Implementar intervalos para manter atenção</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium">Acompanhamento Individual</p>
                    <p className="text-xs text-muted-foreground">3 estudantes precisam de atenção especial</p>
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
                <span>Relatórios Educacionais</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Relatórios Diários</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Presença e Comportamento</p>
                        <p className="text-xs text-muted-foreground">Análise por turma e horário</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={generateEducationReport}>
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Alertas e Intervenções</p>
                        <p className="text-xs text-muted-foreground">Situações que requerem atenção</p>
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
                        <p className="font-medium text-sm">Análise Pedagógica</p>
                        <p className="text-xs text-muted-foreground">Insights para corpo docente</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-sm">Métricas de Engajamento</p>
                        <p className="text-xs text-muted-foreground">Tendências e comparativos</p>
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
                <CardTitle>Configurações Educacionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detecção de Atenção</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Análise Comportamental</span>
                    <Badge>Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Alertas Automáticos</span>
                    <Badge variant="outline">Configurado</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Privacidade LGPD</span>
                    <Badge variant="default">100%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Eye className="w-5 h-5" />
                  <span>Privacidade e Proteção</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Anonimização Estudantes</span>
                    <Badge variant="default">Ativa</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Consentimento Pais</span>
                    <Badge variant="default">100%</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Retenção de Dados</span>
                    <Badge variant="outline">30 dias</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Conformidade Educacional</span>
                    <Badge variant="default">Total</Badge>
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