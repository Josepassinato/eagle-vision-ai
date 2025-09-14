import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";
import SafetyVisionCard from "@/components/SafetyVisionCard";
import EduBehaviorCard from "@/components/EduBehaviorCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Car, Users, Church, Star, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const [isAuthed, setAuthed] = useState(false);
  const [testStatus, setTestStatus] = useState('');

  const testSystem = async () => {
    setTestStatus('Testando...');
    try {
      // Test MediaMTX health endpoint
      const healthResponse = await fetch('/health');
      const healthOk = healthResponse.ok;
      
      // Test demo router function
      const { data: demoData, error: demoError } = await supabase.functions.invoke('demo-router', {
        body: { action: 'start', analytic: 'people_count' }
      });
      
      if (healthOk && !demoError) {
        setTestStatus('✅ Sistema funcionando corretamente!');
      } else {
        setTestStatus('⚠️ Alguns componentes podem estar offline');
      }
    } catch (error) {
      console.error('Test error:', error);
      setTestStatus('❌ Erro no teste do sistema');
    }
  };

  useEffect(() => {
    console.log("Index page mounted successfully");
    
    // Check auth status
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log("Auth session check:", { session: !!session, error });
        setAuthed(!!session);
      } catch (error) {
        console.error("Auth check failed:", error);
      }
    };
    
    checkAuth();
  }, []);

  console.log("Index render - isAuthed:", isAuthed);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <Helmet>
        <title>Visão de Águia – Visão Computacional com IA | Inigrai.com</title>
        <meta name="description" content="Plataforma de visão computacional com IA da Inigrai. Detecção, análise e monitoramento em tempo real." />
        <link rel="canonical" href="https://inigrai.com/" />
        <meta property="og:url" content="https://inigrai.com/" />
        <meta property="og:title" content="Visão de Águia – Visão Computacional com IA | Inigrai.com" />
        <meta property="og:description" content="Plataforma de visão computacional com IA da Inigrai. Detecção, análise e monitoramento em tempo real." />
        <meta name="robots" content="index,follow" />
        <script type="application/ld+json">
          {`
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Inigrai",
            "url": "https://inigrai.com/",
            "logo": "https://inigrai.com/favicon.ico"
          }
          `}
        </script>
        <script type="application/ld+json">
          {`
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Visão de Águia",
            "description": "Plataforma de visão computacional com IA. Detecção, análise e monitoramento em tempo real.",
            "brand": { "@type": "Brand", "name": "Inigrai" }
          }
          `}
        </script>
      </Helmet>
      <div className="min-h-screen bg-background">
          <Navbar />
          
          {/* CTA para Login/Cadastro */}
          <div className="text-center py-12 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl mb-12 border border-primary/20">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">Teste Grátis Agora - Zero Risco</h2>
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl mb-2">📱</div>
                  <h4 className="font-semibold mb-1">Configuração em 5 minutos</h4>
                  <p className="text-sm text-muted-foreground">Setup automático das suas câmeras</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">⏱️</div>
                  <h4 className="font-semibold mb-1">7 dias totalmente grátis</h4>
                  <p className="text-sm text-muted-foreground">Cerca de 100 horas de monitoramento</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h4 className="font-semibold mb-1">Alertas inteligentes</h4>
                  <p className="text-sm text-muted-foreground">Só avisa quando é realmente importante</p>
                </div>
              </div>
              <div className="flex gap-4 justify-center">
                <Button asChild size="lg" className="text-lg px-8">
                  <a href="/auth">Começar Teste Grátis</a>
                </Button>
                <Button variant="outline" size="lg" asChild className="text-lg px-8">
                  <a href="/auth">Já Tenho Conta</a>
                </Button>
                <Button onClick={testSystem} variant="secondary" size="lg" className="text-lg px-8">
                  Testar Sistema
                </Button>
              </div>
              {testStatus && (
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">{testStatus}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                ✅ Sem cartão de crédito • ✅ Cancele quando quiser • ✅ Suporte brasileiro
              </p>
            </div>
          </div>
      <HeroSection />

      <section id="produtos" className="scroll-mt-24 container mx-auto px-4 py-16">
        <header className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Produtos</h2>
          <p className="text-muted-foreground mt-2 md:max-w-2xl">Conheça nossos módulos de visão computacional com IA, prontos para uso em tempo real.</p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Antifurto & Evasão</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Detecta comportamentos suspeitos e envia alertas imediatos por Telegram, e-mail ou webhook.</p>
              <div className="mt-4">
                <Button variant="accent" asChild>
                  <a href="#antifurto">Saiba mais</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-primary" />
                <CardTitle>Leitura de Placas (LPR)</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Identificação de placas para controle de acesso, auditoria e integração com ERPs.</p>
              <div className="mt-4">
                <Button variant="accent" asChild>
                  <a href="#lpr">Saiba mais</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Contagem de Pessoas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Métricas de fluxo em tempo real para otimizar operação, marketing e segurança.</p>
              <div className="mt-4">
                <Button variant="accent" asChild>
                  <a href="#contagem">Saiba mais</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Vision4Church Section */}
      <section className="scroll-mt-24 container mx-auto px-4 py-16 bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Church className="h-8 w-8 text-primary" />
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Vision4Church
            </h2>
            <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          </div>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            IA Especializada para Ambientes Religiosos - 100% Google Cloud
          </p>
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-8">
            <CheckCircle className="h-4 w-4" />
            Tecnologia Exclusiva para Igrejas
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <Card className="border-primary/20 bg-background/50 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">🙏</div>
              <h3 className="font-semibold text-lg mb-2">Privacidade Total</h3>
              <p className="text-sm text-muted-foreground">
                Respeito total à privacidade dos fiéis com anonimização automática e políticas de proteção de dados.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-background/50 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="font-semibold text-lg mb-2">Analytics Inteligente</h3>
              <p className="text-sm text-muted-foreground">
                Contagem de presença, análise de fluxo e insights para melhor gestão dos espaços sagrados.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-background/50 backdrop-blur">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="font-semibold text-lg mb-2">Segurança Discreta</h3>
              <p className="text-sm text-muted-foreground">
                Monitoramento de segurança não-invasivo que preserva o ambiente de paz e contemplação.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-background/80 backdrop-blur rounded-xl p-8 border border-primary/20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4">Por que igrejas escolhem o Vision4Church?</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">Configurado especificamente para ambientes religiosos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">Políticas de privacidade rigorosas e transparentes</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">Analytics para otimizar cultos e eventos especiais</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">Suporte técnico especializado em ambientes religiosos</span>
                </li>
              </ul>
            </div>
            <div className="text-center">
              <div className="bg-primary/10 rounded-xl p-6 mb-6">
                <div className="text-3xl font-bold text-primary mb-2">100%</div>
                <div className="text-sm text-muted-foreground">Compatível com Google Cloud</div>
              </div>
              <Button size="lg" asChild className="w-full">
                <a href="/auth">Teste Grátis por 7 Dias</a>
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                ✅ Instalação gratuita • ✅ Sem compromisso • ✅ Suporte especializado
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="antifurto" className="scroll-mt-24 container mx-auto px-4 py-12">
        <header className="mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold">Antifurto & Evasão — Como funciona</h2>
          <p className="text-muted-foreground mt-2 md:max-w-3xl">Detecta suspeitas de furto, não pagamento e comportamentos anômalos em tempo real. Envia alertas via Telegram, e-mail ou integrações.</p>
        </header>
      </section>

      <section id="lpr" className="scroll-mt-24 container mx-auto px-4 py-12">
        <header className="mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold">Leitura de Placas (LPR) — Como funciona</h2>
          <p className="text-muted-foreground mt-2 md:max-w-3xl">Reconhece placas de veículos para controle de acesso, auditoria e automações. Integra com ERPs e portarias.</p>
        </header>
      </section>

      <section id="contagem" className="scroll-mt-24 container mx-auto px-4 py-12">
        <header className="mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold">Contagem de Pessoas — Como funciona</h2>
          <p className="text-muted-foreground mt-2 md:max-w-3xl">Mede fluxo e permanência em áreas específicas, gerando métricas para operação, marketing e segurança em tempo real.</p>
        </header>
      </section>

      <section id="precos" className="scroll-mt-24 container mx-auto px-4 py-16">
        <header className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Preços</h2>
          <p className="text-muted-foreground mt-2 md:max-w-2xl">Planos flexíveis para começar pequeno e escalar conforme a necessidade.</p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Starter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ 199/mês</div>
              <p className="text-sm text-muted-foreground mt-2">1 câmera, alertas básicos, histórico de 7 dias.</p>
              <Button className="mt-4" variant="accent" asChild>
                <a href="/auth">Começar</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ 499/mês</div>
              <p className="text-sm text-muted-foreground mt-2">Até 5 câmeras, detecções avançadas, integrações.</p>
              <Button className="mt-4" variant="accent" asChild>
                <a href="/auth">Assinar Pro</a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">Sob consulta</div>
              <p className="text-sm text-muted-foreground mt-2">Número ilimitado de câmeras, SLA e suporte dedicado.</p>
              <Button className="mt-4" variant="accent" asChild>
                <a href="/auth">Falar com vendas</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="sobre" className="scroll-mt-24 container mx-auto px-4 py-16">
        <header className="mb-8">
          <h2 className="text-2xl md:text-3xl font-semibold">Quem somos</h2>
          <p className="text-muted-foreground mt-2 md:max-w-3xl">A Inigrai é uma equipe de engenheiros e cientistas de dados focada em transformar vídeo em decisões. Construímos soluções de visão computacional com IA para varejo, indústria e segurança — com implantação rápida, privacidade por padrão e resultados mensuráveis.</p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">
                Nosso foco é democratizar a visão computacional para negócios de todos os tamanhos. 
                Oferecemos soluções de IA que se integram facilmente às suas câmeras IP existentes, 
                transformando-as em sistemas inteligentes de análise e detecção.
              </p>
              <p className="text-sm mt-3">
                Operamos com segurança e privacidade: dados minimizados, criptografia em trânsito e retenção configurável.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium">O que entregamos:</p>
              <ul className="text-sm text-muted-foreground mt-2 list-disc pl-5 space-y-1">
                <li>Implantação rápida em câmeras IP e NVRs existentes</li>
                <li>Alertas em tempo real (Telegram, e-mail, webhooks)</li>
                <li>Integrações simples com ERPs e sistemas de acesso</li>
                <li>Métricas e painéis para tomada de decisão</li>
              </ul>
              <Button className="mt-4" variant="accent" asChild>
                <a href="/auth">Fale com a equipe</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <MediaGatewayCard />
      <SafetyVisionCard />
      <EduBehaviorCard />
    </div>
    </>
  );
};

export default Index;