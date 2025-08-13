import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DVRProtocolInput from "@/components/DVRProtocolInput";
import IPCameraManager from "@/components/IPCameraManager";

export default function Config() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="ip-cameras" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ip-cameras">Câmeras IP</TabsTrigger>
          <TabsTrigger value="dvr">DVR/NVR</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="ip-cameras" className="space-y-6">
          <IPCameraManager />
        </TabsContent>

        <TabsContent value="dvr" className="space-y-6">
          <DVRProtocolInput />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
