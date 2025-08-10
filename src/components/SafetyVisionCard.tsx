import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { HardHat, Shield, AlertTriangle, FileCode } from "lucide-react";

const SafetyVisionCard = () => {
  return (
    <section className="py-16 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-2 text-accent border-accent/30 bg-accent/10">
            <HardHat className="w-4 h-4 mr-2" />
            Card 2 — SafetyVision
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
            Segurança do Trabalho (Obra/Industrial)
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Monitoramento de EPI, zonas de risco e comportamentos inseguros com alertas em tempo real e relatórios de conformidade.
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <HardHat className="w-6 h-6 text-accent" />
              SafetyVision
            </CardTitle>
            <CardDescription>
              Detecção de EPIs, intrusão em áreas restritas, posturas de risco e quedas; envia eventos ao Supabase e integra com o Notifier
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="regras">Regras</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
                <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> EPIs: capacete, óculos, luvas, colete, ouvido, respirador</li>
                  <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Zonas restritas/ críticas via polígonos (GeoJSON)</li>
                  <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Postura e quedas (sinalização de incidente)</li>
                </ul>
              </TabsContent>

              <TabsContent value="regras" className="space-y-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>missing_ppe → HIGH se zona crítica, MEDIUM fora</li>
                  <li>unauthorized_zone → HIGH</li>
                  <li>unsafe_lifting → MEDIUM</li>
                  <li>fall_suspected → CRITICAL</li>
                </ul>
              </TabsContent>

              <TabsContent value="api" className="space-y-2 text-sm">
                <pre className="bg-muted/30 p-3 rounded-md overflow-auto whitespace-pre-wrap">
{`POST /analyze_frame
{
  "site_id":"...",
  "camera_id":"...",
  "ts":"2025-08-10T12:00:00Z",
  "frame_jpeg_b64":"...",
  "zone_hits":[{"zone_id":"...","label":"critical"}]
}`}
                </pre>
              </TabsContent>

              <TabsContent value="arquivos" className="space-y-2 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> safetyvision/Dockerfile</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> safetyvision/main.py</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> safetyvision/requirements.txt</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> safetyvision/README.md</li>
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default SafetyVisionCard;
