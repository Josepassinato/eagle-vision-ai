import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function DemoPublic() {
  const { toast } = useToast();
  const [analytic, setAnalytic] = useState<"people_count" | "vehicle_count" | "safety" | "airport">("people_count");
  const [sources, setSources] = useState<any[]>([]);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ url: string; protocol: string; ui_hint?: any } | null>(null);

  const fetchSources = async () => {
    const { data, error } = await supabase
      .from("demo_sources")
      .select("*")
      .eq("active", true)
      .eq("analytic", analytic)
      .order("confidence", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar fontes", description: error.message, variant: "destructive" });
      setSources([]);
      return;
    }
    setSources(data || []);
    setDemoId(data && data.length ? data[0].id : null);
  };

  useEffect(() => {
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytic]);

  const startDemo = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("demo-router", {
      body: { action: "start", analytic, demo_id: demoId },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao iniciar", description: error.message, variant: "destructive" });
      return;
    }
    const d = data as any;
    setSessionId(d.session_id);
    setStreamInfo({ url: d.stream_url, protocol: d.protocol, ui_hint: d.ui_hint });
    toast({
      title: "Fonte iniciada",
      description: `Protocolo: ${d.protocol} | URL: ${d.stream_url}${d.ui_hint?.requires_proxy ? " (pode requerer proxy)" : ""}`,
    });
  };

  const stopDemo = async () => {
    if (!sessionId) return;
    setLoading(true);
    const { error } = await supabase.functions.invoke("demo-router", {
      body: { action: "stop", session_id: sessionId },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao parar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fonte parada", description: "Sessão encerrada." });
    setSessionId(null);
    setStreamInfo(null);
  };

  return (
    <main className="container mx-auto px-6 py-10 space-y-6">
      <Helmet>
        <title>Demonstração pública | Visão de Águia</title>
        <meta name="description" content="Teste fontes públicas de vídeo e analytics, sem login." />
        <link rel="canonical" href={`${window.location.origin}/demo`} />
      </Helmet>

      <header>
        <h1 className="font-display text-2xl">Demonstração pública</h1>
        <p className="text-muted-foreground">Inicie uma fonte de demonstração pública e visualize o stream.</p>
      </header>

      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Fontes de Demonstração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <section className="flex flex-col md:flex-row gap-3">
            <div className="w-full md:w-1/3">
              <label className="text-sm text-muted-foreground">Analítico</label>
              <Select value={analytic} onValueChange={(v) => setAnalytic(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o analítico" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="people_count">Pessoas / Ocupação</SelectItem>
                  <SelectItem value="vehicle_count">Veículos</SelectItem>
                  <SelectItem value="safety">Segurança do Trabalho</SelectItem>
                  <SelectItem value="airport">Aeroporto / Transporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-full md:w-2/3">
              <label className="text-sm text-muted-foreground">Fonte</label>
              <Select value={demoId ?? undefined} onValueChange={(v) => setDemoId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder={sources.length ? "Escolha uma fonte" : "Carregando..."} />
                </SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} • {s.location} • {s.protocol} • conf {s.confidence}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="flex gap-3 flex-wrap">
            <Button onClick={startDemo} disabled={!demoId || loading}>
              {loading ? "Iniciando..." : sessionId ? "Reiniciar" : "Iniciar fonte"}
            </Button>
            <Button variant="secondary" onClick={stopDemo} disabled={!sessionId || loading}>
              Parar fonte
            </Button>
          </section>

          {streamInfo && (
            <section className="space-y-3">
              <div className="text-sm text-muted-foreground">
                URL do stream ({streamInfo.protocol}): {" "}
                <a href={streamInfo.url} target="_blank" rel="noreferrer" className="underline">
                  abrir em nova aba
                </a>
                {streamInfo.ui_hint?.requires_proxy && (
                  <span> • Pode requerer proxy para tocar embutido.</span>
                )}
              </div>
              {streamInfo.protocol === "MJPEG" && (
                <img
                  src={streamInfo.url}
                  alt="Stream MJPEG de demonstração"
                  loading="lazy"
                  className="w-full max-h-[60vh] rounded-lg border border-border object-contain bg-background"
                />
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
