import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Hls from "hls.js";
import OverlayCanvas from "@/components/OverlayCanvas";
import { useBrowserDetection } from "@/hooks/useBrowserDetection";
import type { RealtimeEvent } from "@/hooks/useRealtimeEvents";

export default function DemoPublic() {
  const { toast } = useToast();
  const [analytic, setAnalytic] = useState<"people_count" | "vehicle_count" | "safety" | "airport" | "edubehavior">("people_count");
  const [sources, setSources] = useState<any[]>([]);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamInfo, setStreamInfo] = useState<{ url: string; protocol: string; ui_hint?: any } | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [browserDetection, setBrowserDetection] = useState<boolean>(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const autoRef = useRef<{ inProgress: boolean; index: number }>({ inProgress: false, index: 0 });
  const seededRef = useRef(false);

  // Browser-based AI detection
  const { isLoading: detectionLoading, error: detectionError, events: detectionEvents, counts, isReady } = 
    useBrowserDetection(videoRef, browserDetection && !!streamInfo, analytic);

  // Seed curated demo sources once
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    supabase.functions.invoke("seed-demo-sources").catch(() => {});
    // no deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopDemoSilently = async () => {
    if (!sessionId) return;
    try {
      await supabase.functions.invoke("demo-router", {
        body: { action: "stop", session_id: sessionId },
      });
    } catch (_) {}
    setSessionId(null);
    setStreamInfo(null);
    setExpiresAt(null);
    setRemaining(0);
  };

  const doStartFor = async (id: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("demo-router", {
      body: { action: "start", analytic, demo_id: id },
    });
    setLoading(false);
    if (error) {
      return { ok: false } as const;
    }
    const d = data as any;
    setSessionId(d.session_id);
    setStreamInfo({ url: d.stream_url, protocol: d.protocol, ui_hint: d.ui_hint });
    setExpiresAt(d.expires_at ?? new Date(Date.now() + 3 * 60 * 1000).toISOString());
    return { ok: true } as const;
  };

  const tryStartAt = async (idx: number) => {
    if (!sources.length || idx >= sources.length) {
      autoRef.current.inProgress = false;
      toast({ title: "Nenhuma fonte válida encontrada", description: "Tente outro analítico.", variant: "destructive" });
      return;
    }
    autoRef.current.inProgress = true;
    autoRef.current.index = idx;
    const list = sources; // snapshot to avoid races
    const chosen = list[idx];
    setDemoId(chosen.id);
    const res = await doStartFor(chosen.id);
    if (!res.ok) {
      // tenta próxima
      tryStartAt(idx + 1);
    } else {
      toast({ title: "Fonte iniciada", description: `${chosen.name} (${chosen.protocol})` });
    }
  };

  const handlePlaybackError = async () => {
    if (!autoRef.current.inProgress) return;
    const next = autoRef.current.index + 1;
    if (next >= sources.length) {
      autoRef.current.inProgress = false;
      toast({ title: "Falha na reprodução", description: "Sem fontes alternativas disponíveis.", variant: "destructive" });
      return;
    }
    await stopDemoSilently();
    tryStartAt(next);
  };

  useEffect(() => {
    if (!streamInfo || streamInfo.protocol !== "HLS") return;
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamInfo.url;
      video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      hls = new Hls({ lowLatencyMode: true, backBufferLength: 90 });
      hls.loadSource(streamInfo.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, () => {
        handlePlaybackError();
      });
    }

    return () => {
      if (hls) {
        hls.detachMedia();
        hls.destroy();
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [streamInfo]);

  // 3-minute time limit countdown
  useEffect(() => {
    if (!sessionId || !expiresAt) return;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) {
        stopDemo();
        toast({ title: "Tempo de demonstração encerrado", description: "Limite de 3 minutos atingido." });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, expiresAt]);

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
    // Filtra protocolos não tocáveis no navegador quando não há proxy (RTSP)
    const playable = (data || []).filter((s: any) => s.protocol !== "RTSP");
    setSources(playable);
    const firstId = playable.length ? playable[0].id : null;
    setDemoId(firstId);
    if ((playable.length ?? 0) > 0 && !sessionId) {
      const startFrom = async (idx: number) => {
        if (!playable || idx >= playable.length) {
          autoRef.current.inProgress = false;
          toast({ title: "Nenhuma fonte válida encontrada", description: "Tente outro analítico.", variant: "destructive" });
          return;
        }
        autoRef.current.inProgress = true;
        autoRef.current.index = idx;
        const chosen = playable[idx];
        setDemoId(chosen.id);
        const res = await doStartFor(chosen.id);
        if (!res.ok) return startFrom(idx + 1);
        toast({ title: "Fonte iniciada", description: `${chosen.name} (${chosen.protocol})` });
      };
      startFrom(0);
    }
  };

  useEffect(() => {
    if (sessionId) {
      // parar sessão anterior ao trocar de analítico
      stopDemoSilently();
    }
    setDemoId(null);
    setStreamInfo(null);
    setExpiresAt(null);
    setRemaining(0);
    fetchSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytic]);

  const startDemo = async () => {
    if (!demoId) return;
    autoRef.current.inProgress = false; // execução manual desativa fallback automático
    const res = await doStartFor(demoId);
    if (!res.ok) {
      toast({ title: "Erro ao iniciar", description: "Não foi possível iniciar a fonte selecionada.", variant: "destructive" });
      return;
    }
    const s = sources.find((s) => s.id === demoId);
    toast({
      title: "Fonte iniciada",
      description: s ? `${s.name} (${s.protocol})` : "Fonte em execução",
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
    setExpiresAt(null);
    setRemaining(0);
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
                  <SelectItem value="edubehavior">Sala de Aula / EduBehavior</SelectItem>
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

          <section className="flex flex-col gap-2">
            <div className="flex gap-3 flex-wrap">
              <Button onClick={startDemo} disabled={!demoId || loading}>
                {loading ? "Iniciando..." : sessionId ? "Reiniciar" : "Iniciar fonte"}
              </Button>
              <Button variant="secondary" onClick={stopDemo} disabled={!sessionId || loading}>
                Parar fonte
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Switch 
                id="browser-detection" 
                checked={browserDetection} 
                onCheckedChange={setBrowserDetection}
                disabled={!streamInfo}
              />
              <Label htmlFor="browser-detection" className="text-sm">
                Detecção IA no navegador {detectionLoading && "(carregando...)"}
              </Label>
            </div>
            {sessionId && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  Tempo restante: {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
                </p>
                {browserDetection && counts && Object.keys(counts).length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Detectado: </span>
                    {Object.entries(counts).map(([label, count]) => (
                      <span key={label} className="mr-3">
                        {label}: <span className="font-semibold text-primary">{count}</span>
                      </span>
                    ))}
                  </div>
                )}
                {detectionError && (
                  <p className="text-sm text-destructive">Erro na detecção: {detectionError}</p>
                )}
              </div>
            )}
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
              <div className="relative">
                {streamInfo.protocol === "HLS" && (
                  <video
                    ref={videoRef}
                    controls
                    playsInline
                    onError={handlePlaybackError}
                    className="w-full max-h-[60vh] rounded-lg border border-border bg-background"
                    aria-label="Stream HLS de demonstração"
                  />
                )}
                {(streamInfo.protocol === "MJPEG" || streamInfo.protocol === "JPEG_STREAM") && (
                  <img
                    src={streamInfo.url}
                    alt="Stream MJPEG de demonstração"
                    loading="lazy"
                    onError={handlePlaybackError}
                    className="w-full max-h-[60vh] rounded-lg border border-border object-contain bg-background"
                  />
                )}
                {browserDetection && detectionEvents.length > 0 && (
                  <OverlayCanvas 
                    videoRef={videoRef} 
                    event={detectionEvents[detectionEvents.length - 1] as RealtimeEvent} 
                  />
                )}
              </div>
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
