import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function People() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Base de Pessoas</h2>
        <Button variant="default">Adicionar Pessoa</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[480px] rounded-md bg-card/40 border" />
        </CardContent>
      </Card>
    </div>
  );
}
