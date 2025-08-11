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
  const [trialCredits, setTrialCredits] = useState<TrialCredits | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const steps: OnboardingStep[] = [
    {
      id: "welcome",
      title: "Bem-vindo à Visão de Águia! 🦅",
      description: "Sua conta foi criada com sucesso. Vamos configurar sua plataforma de monitoramento inteligente em poucos passos.",
      icon: <Gift className="h-8 w-8 text-primary" />,
    },
    {
      id: "trial_info",
      title: "Seu Teste Gratuito",
      description: "Você tem 100 créditos gratuitos por 7 dias para explorar todos os recursos da plataforma.",
      icon: <Clock className="h-8 w-8 text-primary" />,
    },
    {
      id: "modules",
      title: "Módulos Disponíveis",
      description: "Conheça os módulos de IA que você pode usar para monitoramento inteligente.",
      icon: <Brain className="h-8 w-8 text-primary" />,
    },
    {
      id: "setup",
      title: "Configuração Inicial",
      description: "Configure suas primeiras câmeras e pessoas autorizadas.",
      icon: <Camera className="h-8 w-8 text-primary" />,
      action: "Configurar Agora",
    },
    {
      id: "complete",
      title: "Tudo Pronto!",
      description: "Sua plataforma está configurada. Você pode começar a monitorar agora mesmo.",
      icon: <CheckCircle className="h-8 w-8 text-green-500" />,
      action: "Ir para Dashboard",
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
      navigate('/admin/dashboard');
    }
  };

  const handleSkipToConfig = () => {
    navigate('/admin/config');
  };

  const handleSkipToDashboard = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/admin/dashboard');
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
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-800 mb-2">100 Créditos Gratuitos</h3>
                    <p className="text-blue-700 text-sm">
                      Cada análise de frame consome 1 crédito. Com 100 créditos você pode testar amplamente.
                    </p>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-800 mb-2">7 Dias de Teste</h3>
                    <p className="text-purple-700 text-sm">
                      Tempo suficiente para configurar e testar todos os módulos da plataforma.
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <Shield className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Antifurto</h3>
                    <p className="text-sm text-muted-foreground">
                      Detecção inteligente de comportamentos suspeitos
                    </p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Reconhecimento</h3>
                    <p className="text-sm text-muted-foreground">
                      Identificação facial e controle de acesso
                    </p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <Brain className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="font-semibold mb-1">Segurança</h3>
                    <p className="text-sm text-muted-foreground">
                      Monitoramento de EPI e comportamentos
                    </p>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-800 mb-2">💡 Próximos Passos</h3>
                    <ul className="text-yellow-700 text-sm space-y-1">
                      <li>• Configure suas câmeras RTSP/RTMP</li>
                      <li>• Cadastre pessoas autorizadas</li>
                      <li>• Defina zonas de monitoramento</li>
                      <li>• Configure alertas e notificações</li>
                    </ul>
                  </div>
                  <div className="flex space-x-3">
                    <Button onClick={handleSkipToConfig} className="flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      Configurar Câmeras
                    </Button>
                    <Button variant="outline" onClick={handleSkipToDashboard} className="flex-1">
                      Pular Configuração
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="text-center space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-green-800 text-lg mb-2">
                      Plataforma Configurada!
                    </h3>
                    <p className="text-green-700">
                      Você pode começar a usar todos os recursos da Visão de Águia agora mesmo.
                    </p>
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
                
                <Button onClick={handleNext} disabled={loading}>
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