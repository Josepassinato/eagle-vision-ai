import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Safety() {
  return (
    <div className="space-y-4">
      <Helmet>
        <title>SafetyVision – Segurança do Trabalho | Painel</title>
        <meta name="description" content="Monitoramento de EPI, zonas de risco e comportamentos inseguros com alertas e relatórios." />
        <link rel="canonical" href="/app/safety" />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle>SafetyVision – Visão Geral</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-md border bg-card/40">Conformidade EPI: --%</div>
          <div className="p-3 rounded-md border bg-card/40">Incidentes (24h): --</div>
          <div className="p-3 rounded-md border bg-card/40">Tempo médio até ACK: --</div>
          <div className="p-3 rounded-md border bg-card/40">Reincidência: --%</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidentes por Tipo/Zona</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-md bg-card/40 border" />
        </CardContent>
      </Card>
    </div>
  );
}
