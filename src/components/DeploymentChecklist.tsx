import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Clock, AlertCircle, Play, Pause, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  estimatedTime: string;
  dependencies?: string[];
  actions?: {
    label: string;
    action: () => Promise<void>;
  }[];
}

const DeploymentChecklist = () => {
  const { toast } = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    {
      id: 'dvr-setup',
      title: 'Configurar DVRs/Câmeras',
      description: 'Definir lista de DVRs/câmeras (RTSP, credenciais) e mapear zonas/regras no fusion',
      status: 'pending',
      estimatedTime: '30-45 min',
      actions: [
        {
          label: 'Configurar DVRs',
          action: async () => {
            // Navigate to DVR config page
            window.open('/admin/config', '_blank');
          }
        }
      ]
    },
    {
      id: 'stack-deploy',
      title: 'Deploy Stack v1',
      description: 'Subir stack v1 com constraints travados (parâmetros seguros)',
      status: 'pending',
      estimatedTime: '15-20 min',
      dependencies: ['dvr-setup'],
      actions: [
        {
          label: 'Verificar Parâmetros',
          action: async () => {
            window.open('/admin/system-parameters', '_blank');
          }
        }
      ]
    },
    {
      id: 'health-check',
      title: 'Validar Health Services',
      description: 'Validar /health de todos os serviços (UI mostra status)',
      status: 'pending',
      estimatedTime: '5-10 min',
      dependencies: ['stack-deploy'],
      actions: [
        {
          label: 'Verificar Health',
          action: async () => {
            window.open('/admin/health-monitoring', '_blank');
          }
        }
      ]
    },
    {
      id: 'load-test',
      title: 'Teste de Carga Leve',
      description: 'Executar teste de carga leve (2–4 câmeras) por 2 horas; checar métricas e latências',
      status: 'pending',
      estimatedTime: '2h 15min',
      dependencies: ['health-check']
    },
    {
      id: 'network-resilience',
      title: 'Teste de Resiliência',
      description: 'Simular queda de rede e garantir reconnect automático',
      status: 'pending',
      estimatedTime: '15-30 min',
      dependencies: ['load-test']
    },
    {
      id: 'event-testing',
      title: 'Teste de Eventos',
      description: 'Disparar eventos de teste e confirmar clipes/blur/notificações funcionando',
      status: 'pending',
      estimatedTime: '20-30 min',
      dependencies: ['network-resilience']
    },
    {
      id: 'daily-report',
      title: 'Validar Relatório Diário',
      description: 'Receber relatório do dia e validar números/métricas',
      status: 'pending',
      estimatedTime: '10-15 min',
      dependencies: ['event-testing']
    }
  ]);

  const [loadTestTimer, setLoadTestTimer] = useState(0);
  const [isLoadTestRunning, setIsLoadTestRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoadTestRunning && loadTestTimer < 7200) { // 2 hours = 7200 seconds
      interval = setInterval(() => {
        setLoadTestTimer(prev => prev + 1);
      }, 1000);
    } else if (loadTestTimer >= 7200) {
      setIsLoadTestRunning(false);
      completeItem('load-test');
    }
    return () => clearInterval(interval);
  }, [isLoadTestRunning, loadTestTimer]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: ChecklistItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: ChecklistItem['status']) => {
    const variants = {
      pending: 'secondary',
      running: 'default',
      completed: 'default',
      failed: 'destructive'
    } as const;

    const labels = {
      pending: 'Pendente',
      running: 'Executando',
      completed: 'Completo',
      failed: 'Falhou'
    };

    return (
      <Badge variant={variants[status]} className={
        status === 'completed' ? 'bg-green-500 hover:bg-green-600' : ''
      }>
        {labels[status]}
      </Badge>
    );
  };

  const canExecute = (item: ChecklistItem) => {
    if (!item.dependencies) return true;
    return item.dependencies.every(depId => 
      checklist.find(dep => dep.id === depId)?.status === 'completed'
    );
  };

  const completeItem = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: 'completed' as const } : item
    ));
    toast({
      title: "Etapa Concluída",
      description: "Item do checklist marcado como completo"
    });
  };

  const startItem = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: 'running' as const } : item
    ));
  };

  const failItem = (itemId: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, status: 'failed' as const } : item
    ));
  };

  const startLoadTest = () => {
    startItem('load-test');
    setIsLoadTestRunning(true);
    setLoadTestTimer(0);
    toast({
      title: "Teste de Carga Iniciado",
      description: "Executando teste por 2 horas. Monitore as métricas."
    });
  };

  const pauseLoadTest = () => {
    setIsLoadTestRunning(false);
    toast({
      title: "Teste de Carga Pausado",
      description: "Você pode retomar quando necessário."
    });
  };

  const completedItems = checklist.filter(item => item.status === 'completed').length;
  const totalItems = checklist.length;
  const progressPercentage = (completedItems / totalItems) * 100;

  const runHealthCheck = async () => {
    startItem('health-check');
    try {
      const services = [
        'fusion', 'yolo-detection', 'safetyvision', 'edubehavior', 
        'frame-puller', 'enricher', 'notifier'
      ];
      
      const healthChecks = await Promise.allSettled(
        services.map(async (service) => {
          const response = await fetch(`http://localhost:8080/health`);
          return { service, status: response.ok };
        })
      );

      const allHealthy = healthChecks.every(check => 
        check.status === 'fulfilled' && check.value.status
      );

      if (allHealthy) {
        completeItem('health-check');
      } else {
        failItem('health-check');
        toast({
          title: "Health Check Falhou",
          description: "Alguns serviços não estão respondendo",
          variant: "destructive"
        });
      }
    } catch (error) {
      failItem('health-check');
      toast({
        title: "Erro no Health Check",
        description: "Verifique se os serviços estão rodando",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Checklist de Implantação Operacional
            <Badge variant="outline">{completedItems}/{totalItems}</Badge>
          </CardTitle>
          <CardDescription>
            Siga este checklist para uma implantação segura em produção
          </CardDescription>
          <Progress value={progressPercentage} className="w-full" />
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {checklist.map((item) => (
          <Card key={item.id} className={`transition-all ${
            item.status === 'completed' ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' :
            item.status === 'running' ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' :
            item.status === 'failed' ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20' :
            !canExecute(item) ? 'opacity-60' : ''
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getStatusIcon(item.status)}
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Tempo estimado: {item.estimatedTime}
                    </div>
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              {item.dependencies && (
                <div className="mb-3">
                  <p className="text-sm font-medium mb-1">Dependências:</p>
                  <div className="flex gap-1 flex-wrap">
                    {item.dependencies.map(depId => {
                      const dep = checklist.find(d => d.id === depId);
                      return (
                        <Badge key={depId} variant="outline" className="text-xs">
                          {dep?.title}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {item.id === 'load-test' && item.status === 'running' && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">Progresso do Teste</span>
                    <span className="font-mono text-lg">{formatTime(loadTestTimer)}</span>
                  </div>
                  <Progress value={(loadTestTimer / 7200) * 100} className="w-full" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {7200 - loadTestTimer} segundos restantes
                  </p>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                {item.status === 'pending' && canExecute(item) && (
                  <>
                    {item.id === 'load-test' ? (
                      <Button onClick={startLoadTest} variant="default">
                        <Play className="h-4 w-4 mr-2" />
                        Iniciar Teste de Carga
                      </Button>
                    ) : item.id === 'health-check' ? (
                      <Button onClick={runHealthCheck} variant="default">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Executar Health Check
                      </Button>
                    ) : (
                      <Button onClick={() => completeItem(item.id)} variant="default">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Marcar como Completo
                      </Button>
                    )}
                  </>
                )}

                {item.id === 'load-test' && item.status === 'running' && (
                  <Button onClick={pauseLoadTest} variant="outline">
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar Teste
                  </Button>
                )}

                {item.status === 'failed' && (
                  <Button onClick={() => setChecklist(prev => prev.map(i => 
                    i.id === item.id ? { ...i, status: 'pending' as const } : i
                  ))} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                )}

                {item.actions?.map((action, index) => (
                  <Button 
                    key={index}
                    onClick={action.action} 
                    variant="outline"
                    size="sm"
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {progressPercentage === 100 && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
                Implantação Concluída!
              </h3>
              <p className="text-green-600 dark:text-green-300">
                Todos os itens do checklist foram completados com sucesso. 
                O sistema está pronto para produção.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeploymentChecklist;