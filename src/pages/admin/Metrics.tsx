import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Metrics() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Métricas do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-md border bg-card/40">FPS médio: --</div>
          <div className="p-3 rounded-md border bg-card/40">Latência: --</div>
          <div className="p-3 rounded-md border bg-card/40">Eventos: --</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Prometheus</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-md bg-card/40 border" />
        </CardContent>
      </Card>
    </div>
  );
}
