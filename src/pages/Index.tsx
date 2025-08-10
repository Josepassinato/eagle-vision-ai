import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send, Shield, Car, Users } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const [diag, setDiag] = useState<string>("");




  const handleTestSupabase = async () => {
    const ts = new Date().toISOString();
    try {
      const { data, error } = await supabase.functions.invoke("send_telegram", {
        body: { text: `[Visão de Águia] Teste via Supabase - ${ts}` },
      });
      if (error) throw new Error(error.message || String(error));
      setDiag(
        JSON.stringify({ action: "send_telegram", ok: true, response: data }, null, 2)
      );
      toast({
        title: "Notificação via Supabase enviada",
        description: `Chats: ${data?.chat_ids?.length ?? "?"} (latência ${data?.latency_ms}ms)`,
      });
    } catch (e: any) {
      setDiag(
        JSON.stringify(
          { action: "send_telegram", ok: false, error: e?.message || String(e) },
          null,
          2
        )
      );
      toast({
        title: "Falha via Supabase",
        description: "Verifique o token do bot e se enviou /start para ele.",
        variant: "destructive",
      });
    }
  }; 

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
                  <a href="/auth">Saiba mais / Começar</a>
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
                  <a href="/auth">Saiba mais / Começar</a>
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
                  <a href="/auth">Saiba mais / Começar</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
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
          <p className="text-muted-foreground mt-2 md:max-w-2xl">A Inigrai desenvolve soluções de visão computacional com IA para varejo, indústria e segurança, focando em resultados práticos e implantação rápida.</p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">Nossa missão é transformar vídeo em dados acionáveis, com privacidade e confiabilidade. Trabalhamos com pipelines escaláveis e integrações simples.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm">Tem interesse em um piloto? Entre em contato e lhe ajudamos a validar o ROI em poucos dias.</p>
              <Button className="mt-4" variant="accent" asChild>
                <a href="/auth">Entrar / Criar conta</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <MediaGatewayCard />

      <section className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Notificação Telegram (Supabase)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground md:max-w-xl">
              Envie um teste via função Edge do Supabase (não precisa configurar URL).
            </p>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleTestSupabase} variant="accent">
                <Send className="mr-2 h-4 w-4" /> Testar via Supabase
              </Button>
            </div>

            <div className="rounded-md bg-muted/30 p-3 w-full md:max-w-xl">
              <Label>Diagnóstico</Label>
              <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">{diag || "Sem dados ainda. Clique em “Testar via Supabase”."}</pre>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
    </>
  );
};

export default Index;
