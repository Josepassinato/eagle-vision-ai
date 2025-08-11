import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";
import { 
  CheckCircle, 
  Camera, 
  Users, 
  Shield, 
  Brain, 
  Gift,
  ArrowRight,
  Clock,
  CreditCard
} from "lucide-react";

interface TrialCredits {
  credits_remaining: number;
  trial_days_left: number;
  trial_active: boolean;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: string;
  completed?: boolean;
}

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUseCase, setSelectedUseCase] = useState<string>("");
  const [trialCredits, setTrialCredits] = useState<TrialCredits | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Bem-vindo! 🎉",
      description: "Sua conta foi criada com sucesso. Vamos configurar sua segurança inteligente em poucos cliques.",
      icon: <Gift className="h-8 w-8 text-primary" />,
    },
    {
      id: "use_case",
      title: "O que você quer proteger?",
      description: "Escolha seu tipo de negócio para configurarmos automaticamente os alertas certos para você.",
      icon: <Shield className="h-8 w-8 text-primary" />,
    },
    {
      id: "trial_info",
      title: "Seu Teste Gratuito",
      description: "7 dias totalmente grátis! Isso equivale a cerca de 100 horas de monitoramento contínuo.",
      icon: <Clock className="h-8 w-8 text-primary" />,
    },
    {
      id: "setup",
      title: "Conectar suas Câmeras",
      description: "Vamos encontrar e conectar suas câmeras automaticamente. Super simples!",
      icon: <Camera className="h-8 w-8 text-primary" />,
      action: "Buscar Câmeras",
    },
    {
      id: "complete",
      title: "Tudo Funcionando! ✅",
      description: "Sua segurança inteligente está ativa. Você receberá alertas apenas quando for realmente importante.",
      icon: <CheckCircle className="h-8 w-8 text-green-500" />,
      action: "Ver Meu Painel",
    },
  ];

  useEffect(() => {
    loadTrialCredits();
  }, []);

  const loadTrialCredits = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_trial_credits');
      if (error) throw error;
      if (data && data.length > 0) {
        setTrialCredits(data[0]);
      }
    } catch (error) {
      console.error('Error loading trial credits:', error);
    }
  };

  const markStepCompleted = async (stepId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { error } = await supabase
        .from('onboarding_steps')
        .upsert({
          user_id: user.id,
          step_name: stepId,
          completed: true,
          completed_at: new Date().toISOString(),
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error marking step as completed:', error);
    }
  };

  const handleNext = async () => {
    const currentStepData = steps[currentStep];
    await markStepCompleted(currentStepData.id);

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Onboarding complete
      localStorage.setItem('onboardingCompleted', 'true');
      navigate('/dashboard-simple');
    }
  };

  const handleSkipToConfig = () => {
    navigate('/setup');
  };

  const handleSkipToDashboard = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/dashboard-simple');
  };

  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentStepData = steps[currentStep];

  return (
    <>
      <Helmet>
        <title>Configuração Inicial - Visão de Águia</title>
        <meta name="description" content="Configure sua plataforma de monitoramento inteligente" />
      </Helmet>
      
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header with progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-foreground">Configuração Inicial</h1>
              <Badge variant="outline" className="px-3 py-1">
                Passo {currentStep + 1} de {steps.length}
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Trial Credits Card */}
          {trialCredits && (
            <Card className="mb-6 border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {trialCredits.credits_remaining} créditos restantes
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {trialCredits.trial_days_left} dias de teste
                      </p>
                    </div>
                  </div>
                  {!trialCredits.trial_active && (
                    <Button size="sm" variant="outline">
                      Comprar Créditos
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Card className="shadow-xl">
            <CardHeader className="text-center pb-8">
              <div className="mx-auto mb-4">
                {currentStepData.icon}
              </div>
              <CardTitle className="text-3xl mb-2">{currentStepData.title}</CardTitle>
              <CardDescription className="text-lg">
                {currentStepData.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Step-specific content */}
              {currentStep === 0 && (
                <div className="text-center space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-800 mb-2">🎉 Conta Criada com Sucesso!</h3>
                    <p className="text-green-700 text-sm">
                      Você ganhou 100 créditos gratuitos para testar todos os recursos da plataforma por 7 dias.
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-6">
                  <p className="text-center text-muted-foreground mb-6">
                    Escolha o que melhor descreve seu negócio para configurarmos automaticamente:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedUseCase("retail")}
                      className={`p-6 rounded-lg border-2 text-left transition-all ${
                        selectedUseCase === "retail" 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <div className="text-2xl mr-3">🏪</div>
                        <h3 className="font-semibold">Loja / Comércio</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Quero evitar furtos e controlar quem entra na minha loja
                      </p>
                      <div className="text-xs text-green-600">
                        ✅ Detecção de furtos • ✅ Controle de acesso • ✅ Contagem de pessoas
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedUseCase("office")}
                      className={`p-6 rounded-lg border-2 text-left transition-all ${
                        selectedUseCase === "office" 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <div className="text-2xl mr-3">🏢</div>
                        <h3 className="font-semibold">Escritório / Empresa</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Quero controlar acesso e monitorar áreas restritas
                      </p>
                      <div className="text-xs text-green-600">
                        ✅ Reconhecimento facial • ✅ Controle de acesso • ✅ Relatórios
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedUseCase("industry")}
                      className={`p-6 rounded-lg border-2 text-left transition-all ${
                        selectedUseCase === "industry" 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <div className="text-2xl mr-3">🏭</div>
                        <h3 className="font-semibold">Indústria / Fábrica</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Quero monitorar segurança do trabalho e uso de EPI
                      </p>
                      <div className="text-xs text-green-600">
                        ✅ Detecção de EPI • ✅ Zonas de risco • ✅ Comportamentos inseguros
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedUseCase("education")}
                      className={`p-6 rounded-lg border-2 text-left transition-all ${
                        selectedUseCase === "education" 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <div className="text-2xl mr-3">🎓</div>
                        <h3 className="font-semibold">Escola / Universidade</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Quero monitorar segurança e comportamento em salas
                      </p>
                      <div className="text-xs text-green-600">
                        ✅ Análise comportamental • ✅ Segurança escolar • ✅ Relatórios pedagógicos
                      </div>
                    </button>
                  </div>
                  
                  {selectedUseCase && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                      <h4 className="font-semibold text-blue-800 mb-2">✨ Configuração Automática</h4>
                      <p className="text-blue-700 text-sm">
                        Perfeito! Vamos configurar automaticamente os alertas e detecções 
                        mais importantes para {selectedUseCase === "retail" ? "comércio" : 
                        selectedUseCase === "office" ? "escritório" : 
                        selectedUseCase === "industry" ? "indústria" : "educação"}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">🎁</div>
                    <h3 className="text-2xl font-bold mb-2">Seu Teste Gratuito Está Ativo!</h3>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                      <div className="text-3xl mb-3">⏰</div>
                      <h4 className="font-semibold text-green-800 mb-2">7 Dias Completos</h4>
                      <p className="text-green-700 text-sm">
                        Tempo total para testar todas as funcionalidades sem pressa
                      </p>
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                      <div className="text-3xl mb-3">🔄</div>
                      <h4 className="font-semibold text-blue-800 mb-2">~100 Horas de Análise</h4>
                      <p className="text-blue-700 text-sm">
                        Suficiente para monitorar sua loja/empresa por uma semana inteira
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-800 mb-2">💡 Como Funciona</h4>
                    <p className="text-yellow-700 text-sm">
                      A cada pessoa detectada nas suas câmeras, nossa IA analisa se é alguém autorizado ou uma situação suspeita. 
                      Você só recebe alertas quando realmente importa!
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">📱</div>
                    <h3 className="text-xl font-bold mb-2">Vamos Conectar suas Câmeras</h3>
                    <p className="text-muted-foreground">
                      Super simples! Vamos encontrar suas câmeras automaticamente
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="font-semibold text-blue-800 mb-3">🔍 Busca Automática</h4>
                    <div className="space-y-2 text-blue-700 text-sm">
                      <p>✅ Detectamos câmeras IP na sua rede</p>
                      <p>✅ Configuramos automaticamente as melhores configurações</p>
                      <p>✅ Testamos se está funcionando em tempo real</p>
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">🏪 Câmeras Comuns</h4>
                      <p className="text-sm text-muted-foreground">
                        Hikvision, Dahua, Intelbras, Axis e outras marcas populares
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2">📞 Suporte Incluso</h4>
                      <p className="text-sm text-muted-foreground">
                        Nossa equipe te ajuda se precisar configurar manualmente
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button onClick={handleSkipToConfig} className="flex-1 text-lg py-6">
                      <Camera className="h-5 w-5 mr-2" />
                      Buscar Minhas Câmeras
                    </Button>
                    <Button variant="outline" onClick={handleSkipToDashboard} className="flex-1">
                      Fazer Depois
                    </Button>
                  </div>
                  
                  <div className="text-center text-xs text-muted-foreground">
                    💡 Dica: Se suas câmeras já estão funcionando no celular/computador, conseguimos conectar!
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="text-6xl mb-4">🎉</div>
                    <h3 className="text-2xl font-bold mb-2">Tudo Pronto! Sua Segurança Inteligente Está Ativa</h3>
                    <p className="text-muted-foreground">
                      Parabéns! Agora você tem proteção 24/7 com inteligência artificial
                    </p>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h4 className="font-semibold text-green-800 mb-3">✅ O que está funcionando agora:</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-green-700 text-sm">
                      <div>
                        <p>• Detecção automática de pessoas</p>
                        <p>• Reconhecimento de rostos autorizados</p>
                        <p>• Alertas em tempo real</p>
                      </div>
                      <div>
                        <p>• Gravações automáticas de eventos</p>
                        <p>• Relatórios detalhados</p>
                        <p>• Notificações personalizadas</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2">📱 Próximos Passos</h4>
                    <p className="text-blue-700 text-sm">
                      1. Acesse seu painel para ver os dados em tempo real<br/>
                      2. Configure pessoas autorizadas se necessário<br/>
                      3. Ajuste sensibilidade dos alertas conforme sua preferência
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <Button onClick={handleSkipToDashboard} size="lg" className="text-lg px-8 py-4">
                      🚀 Ver Meu Painel de Controle
                    </Button>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                  disabled={currentStep === 0}
                >
                  Anterior
                </Button>
                
                <Button 
                  onClick={handleNext} 
                  disabled={loading || (currentStep === 1 && !selectedUseCase)}
                >
                  {currentStep === steps.length - 1 ? (
                    "Finalizar"
                  ) : (
                    <>
                      Próximo
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="mt-6 text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSkipToDashboard}
              className="text-muted-foreground hover:text-foreground"
            >
              Pular configuração e ir direto para o dashboard
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;