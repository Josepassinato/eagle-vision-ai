import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Events() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="h-10 bg-card/40 rounded-md border" />
          <div className="h-10 bg-card/40 rounded-md border" />
          <div className="h-10 bg-card/40 rounded-md border" />
          <div className="h-10 bg-card/40 rounded-md border" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[480px] rounded-md bg-card/40 border" />
        </CardContent>
      </Card>
    </div>
  );
}
