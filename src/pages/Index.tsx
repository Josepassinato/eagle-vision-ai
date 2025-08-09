import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

const Index = () => {
  const initialUrl =
    localStorage.getItem("notifierBase") ||
    `${window.location.protocol}//${window.location.hostname}:8085`;
  const [baseUrl, setBaseUrl] = useState<string>(initialUrl);

  useEffect(() => {
    // keep localStorage in sync when baseUrl changes via typing+enter
    localStorage.setItem("notifierBase", baseUrl);
  }, [baseUrl]);

  const saveBase = () => {
    localStorage.setItem("notifierBase", baseUrl);
    toast({ title: "URL salva", description: baseUrl });
  };

  const handleHealth = async () => {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (!r.ok) throw new Error(`${r.status}`);
      const j = await r.json();
      toast({
        title: "Notifier OK",
        description: `telegram_configured=${j.telegram_configured} | chats=${j.chat_ids_count}`,
      });
    } catch (e) {
      toast({
        title: "Falha no health",
        description: "Verifique a URL do Notifier (porta/host) e rede",
        variant: "destructive",
      });
      console.error(e);
    }
  };

  const handleTest = async () => {
    const ts = new Date().toISOString();
    try {
      const healthRes = await fetch(`${baseUrl}/health`);
      if (!healthRes.ok) throw new Error(`Health ${healthRes.status}`);
      const res = await fetch(`${baseUrl}/notify_event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_id: "cam_01",
          reason: "reid+motion",
          face_similarity: 0.0,
          reid_similarity: 0.92,
          frames_confirmed: 5,
          movement_px: 42.3,
          ts,
        }),
      });
      if (!res.ok) throw new Error(`Notify ${res.status}`);
      const data = await res.json();
      toast({
        title: "Notificação enviada",
        description: `Enviada para ${data.sent_to_chats}/${data.total_chats} chats (latência ${data.latency_ms}ms).`,
      });
    } catch (err) {
      toast({
        title: "Falha ao enviar",
        description:
          "Defina a URL correta do Notifier. Se estiver remoto, use ngrok e cole a URL pública aqui.",
        variant: "destructive",
      });
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MediaGatewayCard />

      <section className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Notificação Telegram</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid w-full gap-2 md:max-w-xl">
              <Label htmlFor="notifier-url">URL do Notifier</Label>
              <div className="flex gap-2">
                <Input
                  id="notifier-url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="http://localhost:8085"
                />
                <Button type="button" onClick={saveBase} variant="secondary">
                  Salvar
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Dica: se o Notifier estiver em outra rede/máquina, exponha com ngrok e cole a URL pública aqui.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={handleHealth} variant="outline">
                Checar saúde
              </Button>
              <Button onClick={handleTest}>
                <Send className="mr-2 h-4 w-4" /> Testar notificação
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Index;
