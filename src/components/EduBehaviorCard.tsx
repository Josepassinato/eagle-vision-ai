import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, Users, AlertTriangle, FileCode } from "lucide-react";

const EduBehaviorCard = () => {
  return (
    <section className="py-16 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-2 text-accent border-accent/30 bg-accent/10">
            <GraduationCap className="w-4 h-4 mr-2" />
            Card 2 — EduBehavior
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
            Análise Comportamental em Sala de Aula
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sinais observáveis para suporte socioemocional com revisão humana, sem diagnósticos automáticos.
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <GraduationCap className="w-6 h-6 text-accent" />
              EduBehavior
            </CardTitle>
            <CardDescription>
              Isolamento persistente, conflitos, hiperatividade, angústia e sonolência recorrente — com trilhas de auditoria e ética por padrão.
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
                  <li className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Social graph, activity e focus proxy por aluno</li>
                  <li className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Severidades LOW–CRITICAL e fila de revisão humana</li>
                </ul>
              </TabsContent>

              <TabsContent value="regras" className="space-y-4">
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>isolation_persistent → MEDIUM/HIGH conforme duração</li>
                  <li>conflict_detected → HIGH</li>
                  <li>hyperactivity_outlier → MEDIUM</li>
                  <li>distress_signals → LOW</li>
                  <li>sleepiness_recurrent → MEDIUM</li>
                </ul>
              </TabsContent>

              <TabsContent value="api" className="space-y-2 text-sm">
                <pre className="bg-muted/30 p-3 rounded-md overflow-auto whitespace-pre-wrap">{`POST /analyze_frame
{
  "class_id":"...",
  "camera_id":"...",
  "ts":"2025-08-10T12:00:00Z",
  "frame_jpeg_b64":"...",
  "tracks":[{"track_id":"...","bbox":[...]}]
}`}</pre>
              </TabsContent>

              <TabsContent value="arquivos" className="space-y-2 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> edubehavior/Dockerfile</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> edubehavior/main.py</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> edubehavior/requirements.txt</li>
                  <li className="flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> edubehavior/README.md</li>
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default EduBehaviorCard;
