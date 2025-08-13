import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Helmet } from "react-helmet-async";
import { 
  Camera, 
  Users, 
  Shield, 
  Activity,
  Clock,
  CheckCircle,
  Settings,
  BarChart3,
  Bell,
  Eye,
  TrendingUp
} from "lucide-react";

const SimpleDashboard = () => {
  const [isLive, setIsLive] = useState(true);
  const [stats, setStats] = useState({
    camerasOnline: 2,
    totalCameras: 3,
    peopleToday: 127,
    alertsToday: 3,
    lastActivity: "2 min atrás"
  });

  const navigate = useNavigate();

  // Simular dados em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        peopleToday: prev.peopleToday + Math.random() > 0.7 ? 1 : 0,
        alertsToday: prev.alertsToday + Math.random() > 0.95 ? 1 : 0,
        lastActivity: Math.random() > 0.8 ? "Agora" : "2 min atrás"
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const recentEvents = [
    { time: "14:23", type: "person", message: "Pessoa detectada - Entrada Principal", status: "normal" },
    { time: "14:20", type: "alert", message: "Movimento em área restrita", status: "warning" },
    { time: "14:18", type: "person", message: "Cliente reconhecido - Maria Silva", status: "success" },
    { time: "14:15", type: "person", message: "Funcionário detectado - João Costa", status: "success" },
  ];

  return (
    <>
      <Helmet>
        <title>Painel de Monitoramento - Visão de Águia</title>
        <meta name="description" content="Acompanhe sua segurança em tempo real" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        {/* Header */}
        <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Shield className="h-8 w-8 text-primary" />
                  <h1 className="text-2xl font-bold">Visão de Águia</h1>
                </div>
                <Badge variant={isLive ? "default" : "destructive"} className="animate-pulse">
                  {isLive ? "🔴 AO VIVO" : "⚫ OFFLINE"}
                </Badge>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm" onClick={() => navigate('/setup')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/app/dashboard')}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Modo Avançado
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Bem-vindo ao seu Painel! 👋</h2>
            <p className="text-muted-foreground text-lg">
              Sua segurança inteligente está funcionando. Aqui você vê tudo em tempo real.
            </p>
          </div>

          {/* Status Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Câmeras Online</p>
                    <p className="text-3xl font-bold text-green-700">
                      {stats.camerasOnline}/{stats.totalCameras}
                    </p>
                  </div>
                  <Camera className="h-8 w-8 text-green-600" />
                </div>
                <Progress value={(stats.camerasOnline / stats.totalCameras) * 100} className="mt-3" />
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Pessoas Hoje</p>
                    <p className="text-3xl font-bold text-blue-700">{stats.peopleToday}</p>
                  </div>
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <p className="text-xs text-blue-600 mt-2">↗️ +12% vs ontem</p>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Alertas Hoje</p>
                    <p className="text-3xl font-bold text-orange-700">{stats.alertsToday}</p>
                  </div>
                  <Bell className="h-8 w-8 text-orange-600" />
                </div>
                <p className="text-xs text-orange-600 mt-2">Todos verificados ✅</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Última Atividade</p>
                    <p className="text-lg font-bold text-purple-700">{stats.lastActivity}</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-600" />
                </div>
                <p className="text-xs text-purple-600 mt-2">Sistema ativo</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Live View */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Eye className="h-5 w-5 mr-2" />
                  Visualização ao Vivo
                </CardTitle>
                <CardDescription>
                  Stream das suas câmeras em tempo real
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-700 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="text-center text-white">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                      <Shield className="h-8 w-8 text-green-400" />
                    </div>
                    <p className="text-lg font-semibold">IA Monitorando</p>
                    <p className="text-gray-300 text-sm">Entrada Principal</p>
                  </div>
                  
                  {/* Overlay info */}
                  <div className="absolute top-3 left-3 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    Cam 01 - Entrada
                  </div>
                  <div className="absolute top-3 right-3 bg-green-500 text-white px-2 py-1 rounded text-xs">
                    ✅ IA Ativa
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/50 text-white px-2 py-1 rounded text-xs">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
                
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate('/live')} variant="outline">
                    <Camera className="h-4 w-4 mr-2" />
                    Ver Todas as Câmeras
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Eventos Recentes
                </CardTitle>
                <CardDescription>
                  Últimas atividades detectadas pela IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentEvents.map((event, index) => (
                    <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-full ${
                        event.status === 'success' ? 'bg-green-100' :
                        event.status === 'warning' ? 'bg-orange-100' : 'bg-blue-100'
                      }`}>
                        {event.type === 'person' ? (
                          <Users className={`h-4 w-4 ${
                            event.status === 'success' ? 'text-green-600' :
                            event.status === 'warning' ? 'text-orange-600' : 'text-blue-600'
                          }`} />
                        ) : (
                          <Bell className="h-4 w-4 text-orange-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.message}</p>
                        <p className="text-xs text-muted-foreground">{event.time}</p>
                      </div>
                      {event.status === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate('/events')} variant="outline" size="sm">
                    Ver Todos os Eventos
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold mb-2">🎯 Próximos Passos Sugeridos</h3>
                  <p className="text-muted-foreground">
                    Maximize sua segurança com estas configurações
                  </p>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/people')}
                  >
                    <Users className="h-6 w-6" />
                    <span className="font-semibold">Cadastrar Pessoas</span>
                    <span className="text-xs text-muted-foreground">
                      Adicione funcionários e clientes conhecidos
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/config')}
                  >
                    <Settings className="h-6 w-6" />
                    <span className="font-semibold">Ajustar Alertas</span>
                    <span className="text-xs text-muted-foreground">
                      Configure quando receber notificações
                    </span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-auto p-4 flex-col space-y-2"
                    onClick={() => navigate('/app/metrics')}
                  >
                    <TrendingUp className="h-6 w-6" />
                    <span className="font-semibold">Ver Relatórios</span>
                    <span className="text-xs text-muted-foreground">
                      Analise dados e estatísticas
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default SimpleDashboard;