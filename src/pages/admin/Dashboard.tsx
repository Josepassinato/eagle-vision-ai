import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    supabase.from("credit_ledger").select("delta").then(({ data, error }) => {
      if (!error && data) setBalance(data.reduce((sum: number, r: any) => sum + (r.delta || 0), 0));
    });
  }, []);
  return (
    <div className="space-y-6">
      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold">{balance ?? "--"}</div>
              <p className="text-sm text-muted-foreground">saldo disponível</p>
            </div>
            <Link to="/app/credits" className="text-sm text-primary underline">Comprar créditos</Link>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Pessoas (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">--</div>
            <p className="text-sm text-muted-foreground">por câmera</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Veículos (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">--</div>
            <p className="text-sm text-muted-foreground">por câmera</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Latência média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">--</div>
            <p className="text-sm text-muted-foreground">Prometheus</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Câmeras online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">--</div>
            <p className="text-sm text-muted-foreground">status</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo por hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-md bg-card/40 border border-border" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-card/40 border">
                <div className="text-sm">Evento #{i + 1}</div>
                <div className="text-xs text-muted-foreground">--</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
