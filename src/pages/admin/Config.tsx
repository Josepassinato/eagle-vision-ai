import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DVRProtocolInput from "@/components/DVRProtocolInput";

export default function Config() {
  return (
    <div className="space-y-6">
      <DVRProtocolInput />
      
      <Card>
        <CardHeader>
          <CardTitle>Thresholds (Fusion)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {["T_FACE","T_REID","T_MOVE","N_FRAMES"].map((key) => (
            <div key={key} className="p-3 border rounded-md bg-card/40">{key}: --</div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Linhas Virtuais (Analytics)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-md bg-card/40 border" />
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button>Salvar</Button>
        <Button variant="secondary">Recarregar</Button>
      </div>
    </div>
  );
}
