import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CameraProfileManager } from '@/components/CameraProfileManager';
import { AIObservabilityDashboard } from '@/components/AIObservabilityDashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, Settings, BarChart3, Target, Zap, AlertTriangle } from 'lucide-react';

const qualityImprovements = [
  {
    title: "Pipelines por Câmera (Profiles)",
    description: "Configurações específicas por câmera: conf_thresh, NMS, ganho/EV e máscaras/zonas",
    status: "implemented",
    impact: "high"
  },
  {
    title: "Normalização de Brilho/Contraste",
    description: "Normalizar gammas por câmera antes da inferência",
    status: "implemented", 
    impact: "medium"
  },
  {
    title: "Smoothing Temporal + Histerese",
    description: "Histerese de decisão: entrar com conf≥T1 e só sair abaixo de T2 (T2<T1)",
    status: "implemented",
    impact: "high"
  },
  {
    title: "Zone Gating & Motion Gating",
    description: "Só considerar detecções dentro de zonas de interesse",
    status: "implemented",
    impact: "medium"
  },
  {
    title: "Class Remap & Suppression",
    description: "Mapear classes irrelevantes para 'ignore'; suprimir combinações conhecidas de FP",
    status: "planned",
    impact: "medium"
  },
  {
    title: "Tracker Tuning",
    description: "Ajustar parâmetros do tracker (IOU, max_age, min_hits) por tipo de cena",
    status: "implemented",
    impact: "high"
  },
  {
    title: "Datasets Curtos por Site",
    description: "Amostrar 200–300 frames por câmera, anotar rapidamente (Label Studio)",
    status: "planned",
    impact: "high"
  },
  {
    title: "Observabilidade de IA",
    description: "Exportar confiança média por classe, FP/hora, latência p50/p95",
    status: "implemented",
    impact: "critical"
  }
];

export function AIQualityManager() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'implemented': return 'default';
      case 'planned': return 'secondary';
      default: return 'outline';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'destructive';
      case 'high': return 'default'; 
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6" />
        <h1 className="text-3xl font-bold">AI Quality Manager</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quality Improvements Overview
          </CardTitle>
          <CardDescription>
            Implementation status of AI quality enhancement features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {qualityImprovements.map((improvement, index) => (
              <Card key={index} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-semibold text-sm">{improvement.title}</h4>
                    <div className="flex gap-1">
                      <Badge variant={getStatusColor(improvement.status)}>
                        {improvement.status}
                      </Badge>
                      <Badge variant={getImpactColor(improvement.impact)}>
                        {improvement.impact}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {improvement.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Camera Profiles
          </TabsTrigger>
          <TabsTrigger value="observability" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Observability
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <CameraProfileManager />
        </TabsContent>

        <TabsContent value="observability">
          <AIObservabilityDashboard />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Advanced Analytics (Coming Soon)
              </CardTitle>
              <CardDescription>
                Dataset annotation, model retraining, and drift detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h4 className="font-semibold mb-2">Dataset Annotation</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Quick annotation of 200-300 frames per camera using Label Studio integration
                  </p>
                  <Button variant="outline" disabled>
                    Launch Annotation Tool
                  </Button>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold mb-2">Model Retraining</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Retrain custom heads for site-specific taxonomies
                  </p>
                  <Button variant="outline" disabled>
                    Configure Training
                  </Button>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold mb-2">Class Remapping</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Map irrelevant classes to 'ignore' and suppress known false positives
                  </p>
                  <Button variant="outline" disabled>
                    Manage Mappings
                  </Button>
                </Card>

                <Card className="p-4">
                  <h4 className="font-semibold mb-2">A/B Testing</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Compare different model configurations and thresholds
                  </p>
                  <Button variant="outline" disabled>
                    Setup Experiments
                  </Button>
                </Card>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Quality Metrics Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Avg Confidence</div>
                    <div className="text-muted-foreground">85.2%</div>
                  </div>
                  <div>
                    <div className="font-medium">FP Rate</div>
                    <div className="text-muted-foreground">2.1%</div>
                  </div>
                  <div>
                    <div className="font-medium">Processing Latency</div>
                    <div className="text-muted-foreground">45ms</div>
                  </div>
                  <div>
                    <div className="font-medium">Model Drift</div>
                    <div className="text-muted-foreground">0.8%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}