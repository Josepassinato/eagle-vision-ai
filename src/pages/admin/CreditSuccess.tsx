import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function useQueryParam(name: string) {
  const { search } = useLocation();
  return new URLSearchParams(search).get(name);
}

export default function CreditSuccess() {
  const sessionId = useQueryParam("session_id");
  const [status, setStatus] = useState<string>("processando...");
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { session_id: sessionId },
      });
      if (error) {
        setStatus("Erro ao verificar pagamento");
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        const d = data as any;
        if (d?.credited || d?.already) {
          setStatus(d.already ? "Pagamento já processado" : "Créditos adicionados com sucesso!");
          toast({ title: "Sucesso", description: "Saldo atualizado." });
        } else {
          setStatus("Pagamento não confirmado");
        }
      }
    })();
  }, [sessionId]);

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Pagamento de Créditos | Visão de Águia</title>
        <meta name="description" content="Confirmação de compra de créditos." />
        <link rel="canonical" href={`${window.location.origin}/app/credits/success`} />
      </Helmet>
      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Confirmação de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-lg">{status}</div>
          <div className="flex gap-3">
            <Button asChild>
              <Link to="/app/credits">Voltar aos Créditos</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/app/dashboard">Ir ao Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
