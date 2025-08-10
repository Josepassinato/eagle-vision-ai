import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Demo() {
  const { toast } = useToast();

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
    </div>
  );
}
