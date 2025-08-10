import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MapView() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa (em breve)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[520px] rounded-md bg-card/40 border flex items-center justify-center text-muted-foreground">
          Integração com Leaflet/Mapbox será adicionada no próximo passo.
        </div>
      </CardContent>
    </Card>
  );
}
