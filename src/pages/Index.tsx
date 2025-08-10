import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
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
      </Helmet>
      <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
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
