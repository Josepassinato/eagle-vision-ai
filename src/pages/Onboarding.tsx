import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Car, Users, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Simple onboarding wizard for selecting product, connecting cameras, configuring basics, and activating

type Product = "antitheft" | "lpr" | "people_count";

type Camera = {
  id: string;
  name: string;
  protocol: "rtsp" | "rtmp";
  url: string;
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [product, setProduct] = useState<Product | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([
    { id: "cam-1", name: "Entrada Principal", protocol: "rtsp", url: "" },
  ]);
  const [settings, setSettings] = useState({
    // generic
    notifier: false,
    telegramChatId: "",
    // antitheft
    t_face: 0.65,
    t_reid: 0.86,
    // lpr
    lprCountry: "BR",
    // people count
    countDirection: "both" as "in" | "out" | "both",
  });

  const steps = useMemo(
    () => [
      { id: 1, label: "Produto" },
      { id: 2, label: "Câmeras" },
      { id: 3, label: "Ajustes" },
      { id: 4, label: "Revisão" },
    ],
    []
  );

  const canContinue = useMemo(() => {
    if (step === 1) return !!product;
    if (step === 2) return cameras.every((c) => c.name && c.url);
    return true;
  }, [step, product, cameras]);

  const addCamera = () => {
    const idx = cameras.length + 1;
    setCameras([
      ...cameras,
      { id: `cam-${idx}`, name: `Câmera ${idx}`, protocol: "rtsp", url: "" },
    ]);
  };

  const removeCamera = (id: string) => {
    setCameras(cameras.filter((c) => c.id !== id));
  };

  const finish = () => {
    // Persist minimally for later use (can be replaced by API/Supabase later)
    try {
      localStorage.setItem(
        "onboardingConfig",
        JSON.stringify({ product, cameras, settings })
      );
    } catch {}

    toast.success("Configuração salva! Redirecionando para o painel…", {
      duration: 2000,
    });
    navigate("/app/dashboard", { replace: true });
  };

  return (
    <>
      <Helmet>
        <title>Onboarding — Configurar câmeras e analíticos</title>
        <meta
          name="description"
          content="Assista de forma guiada: selecione o produto, conecte câmeras e ative análises de IA."
        />
        <link rel="canonical" href="/onboarding" />
      </Helmet>

      <main className="container mx-auto px-6 py-10">
        <header className="mb-8">
          <h1 className="font-display text-3xl">Configuração guiada</h1>
          <p className="text-muted-foreground mt-1">
            Siga os passos para escolher o produto, conectar suas câmeras e ativar os relatórios.
          </p>
        </header>

        <nav className="mb-6">
          <ol className="flex items-center gap-3 text-sm">
            {steps.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full border ${
                      done
                        ? "bg-primary text-primary-foreground border-primary"
                        : active
                        ? "border-primary text-primary"
                        : "border-muted-foreground text-muted-foreground"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : s.id}
                  </span>
                  <span className={active ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                  {i < steps.length - 1 && <span className="text-muted-foreground">/</span>}
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 1 && (
          <section aria-labelledby="step1">
            <Card>
              <CardHeader>
                <CardTitle id="step1">Escolha seu produto</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ProductCard
                  title="Prevenção de Furtos"
                  description="Detecta furtos e evasões com IA e envia alertas."
                  icon={<Shield className="h-6 w-6" />}
                  active={product === "antitheft"}
                  onSelect={() => { setProduct("antitheft"); setStep(2); }}
                />
                <ProductCard
                  title="Leitura de Placas (LPR)"
                  description="Identifica placas de veículos para controle de acesso."
                  icon={<Car className="h-6 w-6" />}
                  active={product === "lpr"}
                  onSelect={() => { setProduct("lpr"); setStep(2); }}
                />
                <ProductCard
                  title="Contagem de Pessoas"
                  description="Conta entradas/saídas para métricas de fluxo."
                  icon={<Users className="h-6 w-6" />}
                  active={product === "people_count"}
                  onSelect={() => { setProduct("people_count"); setStep(2); }}
                />
              </CardContent>
            </Card>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="step2" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle id="step2">Conecte suas câmeras</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cameras.map((c) => (
                  <div key={c.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-3">
                      <Label htmlFor={`name-${c.id}`}>Nome</Label>
                      <Input
                        id={`name-${c.id}`}
                        value={c.name}
                        placeholder="Ex. Entrada Principal"
                        onChange={(e) =>
                          setCameras((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Protocolo</Label>
                      <Select
                        value={c.protocol}
                        onValueChange={(v: "rtsp" | "rtmp") =>
                          setCameras((prev) => prev.map((x) => (x.id === c.id ? { ...x, protocol: v } : x)))
                        }
                      >
                        <SelectTrigger aria-label="Selecionar protocolo">
                          <SelectValue placeholder="Protocolo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rtsp">RTSP</SelectItem>
                          <SelectItem value="rtmp">RTMP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-6">
                      <Label htmlFor={`url-${c.id}`}>URL</Label>
                      <Input
                        id={`url-${c.id}`}
                        value={c.url}
                        placeholder={
                          c.protocol === "rtmp"
                            ? "rtmp://seu-host:1935/minha-camera?user=pub&pass=pub123"
                            : "rtsp://usuario:senha@seu-host:554/stream"
                        }
                        onChange={(e) =>
                          setCameras((prev) => prev.map((x) => (x.id === c.id ? { ...x, url: e.target.value } : x)))
                        }
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button variant="destructive" type="button" onClick={() => removeCamera(c.id)} aria-label={`Remover ${c.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="secondary" onClick={addCamera}>
                  <Plus className="h-4 w-4 mr-2" /> Adicionar câmera
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="step3" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle id="step3">Ajustes do produto</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Notificações (Telegram)</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        id="notifier"
                        type="checkbox"
                        checked={settings.notifier}
                        onChange={(e) => setSettings({ ...settings, notifier: e.target.checked })}
                      />
                      <Label htmlFor="notifier">Ativar</Label>
                    </div>
                    {settings.notifier && (
                      <Input
                        placeholder="Chat ID do Telegram"
                        value={settings.telegramChatId}
                        onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                      />
                    )}
                  </div>
                </div>

                {product === "antitheft" && (
                  <div className="space-y-2">
                    <Label>Limiares (IA)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="t_face">T_FACE</Label>
                        <Input
                          id="t_face"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={settings.t_face}
                          onChange={(e) => setSettings({ ...settings, t_face: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="t_reid">T_REID</Label>
                        <Input
                          id="t_reid"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={settings.t_reid}
                          onChange={(e) => setSettings({ ...settings, t_reid: parseFloat(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {product === "lpr" && (
                  <div className="space-y-2">
                    <Label>País (formato de placa)</Label>
                    <Select
                      value={settings.lprCountry}
                      onValueChange={(v) => setSettings({ ...settings, lprCountry: v })}
                    >
                      <SelectTrigger aria-label="Selecionar país">
                        <SelectValue placeholder="País" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BR">Brasil</SelectItem>
                        <SelectItem value="US">Estados Unidos</SelectItem>
                        <SelectItem value="EU">Europa (genérico)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {product === "people_count" && (
                  <div className="space-y-2">
                    <Label>Direção</Label>
                    <Select
                      value={settings.countDirection}
                      onValueChange={(v: "in" | "out" | "both") => setSettings({ ...settings, countDirection: v })}
                    >
                      <SelectTrigger aria-label="Selecionar direção">
                        <SelectValue placeholder="Direção" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">Entradas</SelectItem>
                        <SelectItem value="out">Saídas</SelectItem>
                        <SelectItem value="both">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Dica: defina a linha virtual na página Config após concluir o onboarding.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="step4">
            <Card>
              <CardHeader>
                <CardTitle id="step4">Revisão</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium mb-2">Produto</h3>
                  <div className="text-sm bg-muted rounded p-3">
                    {product === "antitheft" && "Prevenção de Furtos"}
                    {product === "lpr" && "Leitura de Placas (LPR)"}
                    {product === "people_count" && "Contagem de Pessoas"}
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Câmeras</h3>
                  <pre className="text-xs bg-muted rounded p-3 max-h-64 overflow-auto">{JSON.stringify(cameras, null, 2)}</pre>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Ajustes</h3>
                  <pre className="text-xs bg-muted rounded p-3 max-h-64 overflow-auto">{JSON.stringify(settings, null, 2)}</pre>
                </div>
                <div className="text-sm text-muted-foreground">
                  Após concluir, você pode editar zonas/limiares em Admin → Config.
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={finish}>Ativar e ir ao Painel</Button>
              </CardFooter>
            </Card>
          </section>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button
            disabled={!canContinue}
            onClick={() => setStep((s) => Math.min(4, s + 1))}
          >
            {step === 4 ? "Concluir" : (
              <span className="inline-flex items-center"><ChevronRight className="h-4 w-4 mr-2" /> Avançar</span>
            )}
          </Button>
        </div>
      </main>
    </>
  );
}

function ProductCard({
  title,
  description,
  icon,
  active,
  onSelect,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border p-4 transition-colors ${
        active ? "border-primary bg-primary/5" : "hover:bg-muted"
      }`}
      aria-pressed={active}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-md bg-card border">{icon}</div>
        <div className="font-medium">{title}</div>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
