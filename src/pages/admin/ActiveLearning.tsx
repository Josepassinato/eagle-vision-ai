import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Brain, Target, TrendingUp, Database, CheckCircle, XCircle } from "lucide-react";

interface AnnotationSample {
  id: string;
  camera_id: string;
  uncertainty_score: number;
  model_predictions: any;
  frame_data: string;
  annotation_status: 'PENDING' | 'ANNOTATED' | 'VALIDATED' | 'REJECTED';
  created_at: string;
}

interface ModelPerformance {
  model_name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  sample_count: number;
}

export default function ActiveLearning() {
  const [samples, setSamples] = useState<AnnotationSample[]>([]);
  const [performance, setPerformance] = useState<ModelPerformance[]>([]);
  const [selectedSample, setSelectedSample] = useState<AnnotationSample | null>(null);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAnnotationSamples();
    loadModelPerformance();
  }, []);

  const loadAnnotationSamples = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('active-learning', {
        body: { action: 'get_samples_for_annotation', limit: 20 }
      });
      
      if (error) throw error;
      setSamples(data.samples || []);
    } catch (error) {
      console.error('Error loading samples:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar amostras para anotação",
        variant: "destructive"
      });
    }
  };

  const loadModelPerformance = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('active-learning', {
        body: { action: 'get_model_performance' }
      });
      
      if (error) throw error;
      setPerformance(data.performance || []);
    } catch (error) {
      console.error('Error loading performance:', error);
    }
  };

  const submitAnnotation = async (sample: AnnotationSample, annotations: any) => {
    setIsAnnotating(true);
    try {
      const { error } = await supabase.functions.invoke('active-learning', {
        body: { 
          action: 'submit_annotation',
          sample_id: sample.id,
          annotations
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Anotação salva com sucesso"
      });
      
      setSelectedSample(null);
      loadAnnotationSamples();
      
    } catch (error) {
      console.error('Error submitting annotation:', error);
      toast({
        title: "Erro",
        description: "Falha ao salvar anotação",
        variant: "destructive"
      });
    } finally {
      setIsAnnotating(false);
    }
  };

  const triggerRetraining = async () => {
    try {
      const { error } = await supabase.functions.invoke('active-learning', {
        body: { action: 'trigger_retraining' }
      });
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Retreinamento do modelo iniciado"
      });
      
    } catch (error) {
      console.error('Error triggering retraining:', error);
      toast({
        title: "Erro",
        description: "Falha ao iniciar retreinamento",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Active Learning System – IA Avançada | Painel</title>
        <meta name="description" content="Sistema de aprendizado ativo para melhoria contínua dos modelos de IA" />
        <link rel="canonical" href="/app/active-learning" />
      </Helmet>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Active Learning System</h1>
          <p className="text-muted-foreground">Melhoria contínua dos modelos através de feedback e anotações</p>
        </div>
        <Button onClick={triggerRetraining} className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Retreinar Modelos
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Amostras Pendentes</p>
                <p className="text-2xl font-bold">{samples.filter(s => s.annotation_status === 'PENDING').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Anotadas</p>
                <p className="text-2xl font-bold">{samples.filter(s => s.annotation_status === 'ANNOTATED').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Precisão Média</p>
                <p className="text-2xl font-bold">
                  {performance.length > 0 
                    ? `${(performance.reduce((acc, p) => acc + p.precision, 0) / performance.length * 100).toFixed(1)}%`
                    : '--'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Amostras</p>
                <p className="text-2xl font-bold">{samples.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="annotation" className="space-y-4">
        <TabsList>
          <TabsTrigger value="annotation">Interface de Anotação</TabsTrigger>
          <TabsTrigger value="performance">Performance dos Modelos</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline de Retreinamento</TabsTrigger>
        </TabsList>

        <TabsContent value="annotation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Amostras para Anotação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {samples.filter(s => s.annotation_status === 'PENDING').map((sample) => (
                  <Card key={sample.id} className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedSample(sample)}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="outline">
                          Camera: {sample.camera_id}
                        </Badge>
                        <Badge variant={sample.uncertainty_score > 0.7 ? "destructive" : "secondary"}>
                          Incerteza: {(sample.uncertainty_score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      
                      {sample.frame_data && (
                        <div className="w-full h-32 bg-muted rounded-md mb-2 flex items-center justify-center">
                          <img 
                            src={`data:image/jpeg;base64,${sample.frame_data}`}
                            alt="Frame para anotação"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        {new Date(sample.created_at).toLocaleString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {selectedSample && (
            <Card>
              <CardHeader>
                <CardTitle>Anotar Amostra</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Frame Original</h4>
                      {selectedSample.frame_data && (
                        <img 
                          src={`data:image/jpeg;base64,${selectedSample.frame_data}`}
                          alt="Frame para anotação"
                          className="w-full rounded-md border"
                        />
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Predições do Modelo</h4>
                      <div className="bg-muted p-3 rounded-md">
                        <pre className="text-sm">
                          {JSON.stringify(selectedSample.model_predictions, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => submitAnnotation(selectedSample, { correct: true })}
                      disabled={isAnnotating}
                      variant="default"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Correto
                    </Button>
                    <Button 
                      onClick={() => submitAnnotation(selectedSample, { correct: false })}
                      disabled={isAnnotating}
                      variant="destructive"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Incorreto
                    </Button>
                    <Button 
                      onClick={() => setSelectedSample(null)}
                      variant="outline"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance dos Modelos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {performance.map((perf) => (
                  <div key={perf.model_name} className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">{perf.model_name}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Precisão</p>
                        <p className="text-lg font-semibold">{(perf.precision * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Recall</p>
                        <p className="text-lg font-semibold">{(perf.recall * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">F1-Score</p>
                        <p className="text-lg font-semibold">{(perf.f1_score * 100).toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Amostras</p>
                        <p className="text-lg font-semibold">{perf.sample_count}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline de Retreinamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Status do Pipeline</h4>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Pipeline ativo - Processando feedback contínuo</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">Coleta de Dados</h5>
                    <p className="text-sm text-muted-foreground">
                      Amostras de alta incerteza são automaticamente selecionadas para anotação
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">Validação</h5>
                    <p className="text-sm text-muted-foreground">
                      Anotações são validadas por múltiplos revisores antes do retreinamento
                    </p>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h5 className="font-medium mb-2">Retreinamento</h5>
                    <p className="text-sm text-muted-foreground">
                      Modelos são atualizados incrementalmente com novos dados validados
                    </p>
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