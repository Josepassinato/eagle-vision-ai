import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function Demo() {
  const { toast } = useToast();
  const [analytic, setAnalytic] = useState<"people_count" | "vehicle_count" | "safety" | "airport">("people_count");
  const [sources, setSources] = useState<any[]>([]);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const call = async (action: "start" | "reset") => {
    const { data, error } = await supabase.functions.invoke("simulate-demo", { body: { action } });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const d = data as any;
      toast({
        title: action === "start" ? "Demonstração iniciada" : "Demonstração limpa",
        description: action === "start"
          ? `Câmeras: ${d.cameras} | Eventos: ${d.events} | Veículos: ${d.vehicleEvents} | Créditos +${d.grant} / -${d.consumption}`
          : "Todos os dados de demo foram removidos",
      });
    }
  };

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
    toast({
      title: "Fonte iniciada",
      description: `Protocolo: ${d.protocol} | URL: ${d.stream_url}${d.ui_hint?.requires_proxy ? " (requer proxy)" : ""}`,
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
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Demonstração | Visão de Águia</title>
        <meta name="description" content="Gere dados de demonstração: câmeras, eventos, veículos e consumo de créditos." />
        <link rel="canonical" href={`${window.location.origin}/app/demo`} />
      </Helmet>

      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Modo Demonstração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Gere um cenário realista com 3 câmeras, eventos dos últimos 120 minutos e veículos aleatórios.
            Também será adicionado um crédito de demonstração e consumo proporcional aos eventos.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={() => call("start")}>Iniciar demonstração</Button>
            <Button variant="secondary" onClick={() => call("reset")}>Limpar demonstração</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Fontes de Demonstração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
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
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button onClick={startDemo} disabled={!demoId || loading}>
              {loading ? "Iniciando..." : sessionId ? "Reiniciar" : "Iniciar fonte"}
            </Button>
            <Button variant="secondary" onClick={stopDemo} disabled={!sessionId || loading}>
              Parar fonte
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dica: fontes HLS/YouTube podem requerer proxy (FFmpeg/MediaMTX) para RTSP/HLS interno.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
