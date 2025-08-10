import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="space-y-6">
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
