import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PACKS = [
  { sku: "CREDITS_1000", credits: 1000, priceCents: 5000 },
  { sku: "CREDITS_5000", credits: 5000, priceCents: 25000 },
  { sku: "CREDITS_20000", credits: 20000, priceCents: 100000 },
];

export default function Credits() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadBalance = async () => {
    const { data, error } = await supabase.from("credit_ledger").select("delta");
    if (error) {
      toast({ title: "Erro ao carregar saldo", description: error.message, variant: "destructive" });
      return;
    }
    setBalance((data || []).reduce((sum, r: any) => sum + (r.delta || 0), 0));
  };

  useEffect(() => { loadBalance(); }, []);

  const priceFmt = useMemo(() => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }), []);

  const handleBuy = async (sku: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", { body: { sku } });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("URL não retornada");
      window.open(url, "_blank");
    } catch (e: any) {
      toast({ title: "Falha ao iniciar compra", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Créditos | Visão de Águia</title>
        <meta name="description" content="Compre créditos para eventos de câmera. Pacotes em BRL." />
        <link rel="canonical" href={`${window.location.origin}/app/credits`} />
      </Helmet>

      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Saldo de Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{balance ?? "--"}</div>
          <p className="text-sm text-muted-foreground">R$ 0,05 por evento</p>
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PACKS.map((p) => (
          <Card key={p.sku} className="shadow-primary">
            <CardHeader>
              <CardTitle>{p.credits.toLocaleString("pt-BR")} créditos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-2xl font-semibold">{priceFmt.format(p.priceCents / 100)}</div>
              <p className="text-sm text-muted-foreground">Válido para eventos detectados</p>
              <Button onClick={() => handleBuy(p.sku)} disabled={loading} className="w-full">
                Comprar
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
