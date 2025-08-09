import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MediaGatewayCard from "@/components/MediaGatewayCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Send } from "lucide-react";

const Index = () => {
  const notifierBase = `${window.location.protocol}//${window.location.hostname}:8085`;

  const handleTest = async () => {
    const ts = new Date().toISOString();
    try {
      const healthRes = await fetch(`${notifierBase}/health`);
      if (!healthRes.ok) throw new Error(`Health ${healthRes.status}`);
      const res = await fetch(`${notifierBase}/notify_event`, {
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
          "Verifique se o Notifier está rodando na porta 8085 e se o bot já recebeu uma mensagem (getUpdates)",
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
          <CardContent className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground">
              Clique para enviar uma notificação de teste para seu chat e grupo.
            </p>
            <Button onClick={handleTest}>
              <Send className="mr-2 h-4 w-4" /> Testar notificação
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Index;
