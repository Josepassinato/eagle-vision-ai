import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function EduBehavior() {
  return (
    <div className="space-y-4">
      <Helmet>
        <title>EduBehavior – Análise Comportamental | Painel</title>
        <meta name="description" content="Sinais observáveis em sala de aula para suporte socioemocional, com revisão humana obrigatória." />
        <link rel="canonical" href="/app/edubehavior" />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle>EduBehavior – Visão Geral</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-md border bg-card/40">Sinais (24h): --</div>
          <div className="p-3 rounded-md border bg-card/40">Incidentes pendentes: --</div>
          <div className="p-3 rounded-md border bg-card/40">Tempo médio de revisão: --</div>
          <div className="p-3 rounded-md border bg-card/40">Tendência "happy" turma: --%</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila de Revisão Humana</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-md bg-card/40 border flex items-center justify-center text-muted-foreground text-sm">
            Sem dados ainda.
          </div>
          <div className="mt-3">
            <Button variant="accent">Atualizar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
