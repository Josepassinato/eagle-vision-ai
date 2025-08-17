import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Video, Shield, FileText, Users, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

interface AnalysisResult {
  success: boolean;
  analysisType: string;
  timestamp: string;
  result: any;
  error?: string;
}

export default function VertexAIAnalyzer() {
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [analysisType, setAnalysisType] = useState<string>("image");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalysis = async () => {
    if (analysisType === 'video' && !videoUrl) {
      toast.error("Por favor, insira a URL do vídeo");
      return;
    }
    if (analysisType !== 'video' && !imageUrl) {
      toast.error("Por favor, insira a URL da imagem");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vertex-ai-analysis', {
        body: {
          imageUrl: analysisType !== 'video' ? imageUrl : undefined,
          videoUrl: analysisType === 'video' ? videoUrl : undefined,
          analysisType
        }
      });

      if (error) throw error;

      setResult(data);
      if (data.success) {
        toast.success(`Análise ${analysisType} concluída com sucesso!`);
      } else {
        toast.error(data.error || "Erro na análise");
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error("Erro ao executar análise");
    } finally {
      setLoading(false);
    }
  };

  const renderObjectDetection = (result: any) => {
    if (!result.objects && !result.labels) return null;

    return (
      <div className="space-y-4">
        {result.summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Resumo da Detecção
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{result.summary.totalObjects}</div>
                  <div className="text-sm text-muted-foreground">Objetos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{result.summary.peopleDetected}</div>
                  <div className="text-sm text-muted-foreground">Pessoas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{result.summary.vehiclesDetected}</div>
                  <div className="text-sm text-muted-foreground">Veículos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(result.summary.confidence * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Confiança</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result.objects && result.objects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Objetos Detectados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.objects.map((obj: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="font-medium">{obj.name}</span>
                      <Badge variant="outline" className="ml-2">{obj.category}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{Math.round(obj.confidence * 100)}%</div>
                      <Progress value={obj.confidence * 100} className="w-20 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result.labels && result.labels.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rótulos Identificados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {result.labels.map((label: any, index: number) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {label.description}
                    <span className="text-xs">({Math.round(label.confidence * 100)}%)</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderSafetyAnalysis = (result: any) => {
    if (!result.riskLevel) return null;

    const getRiskColor = (level: string) => {
      switch (level) {
        case 'HIGH': return 'text-red-600';
        case 'MEDIUM': return 'text-yellow-600';
        case 'LOW': return 'text-blue-600';
        default: return 'text-green-600';
      }
    };

    const getRiskIcon = (level: string) => {
      switch (level) {
        case 'HIGH': return <AlertTriangle className="h-5 w-5 text-red-600" />;
        case 'MEDIUM': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
        default: return <CheckCircle className="h-5 w-5 text-green-600" />;
      }
    };

    return (
      <div className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center gap-2 mb-2">
              {getRiskIcon(result.riskLevel)}
              <span className={`font-medium ${getRiskColor(result.riskLevel)}`}>
                Nível de Risco: {result.riskLevel}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {result.faces} faces detectadas • {result.objects} objetos identificados
            </div>
          </AlertDescription>
        </Alert>

        {result.recommendations && result.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recomendações de Segurança</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {result.recommendations.map((rec: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {result.safeSearch && (
          <Card>
            <CardHeader>
              <CardTitle>Análise de Conteúdo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(result.safeSearch).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="capitalize">{key}</span>
                    <Badge variant={value === 'VERY_UNLIKELY' ? 'default' : 'destructive'}>
                      {value}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderGenericResult = (result: any) => {
    if (!result.responses) return null;

    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Resultado da Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Vertex AI Vision Analysis</h1>
        <p className="text-muted-foreground">
          Análise avançada de imagens e vídeos usando Google Cloud Vertex AI
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurar Análise</CardTitle>
          <CardDescription>
            Escolha o tipo de análise e forneça a URL do conteúdo para processar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="analysisType">Tipo de Análise</Label>
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="image">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Análise Geral de Imagem
                  </div>
                </SelectItem>
                <SelectItem value="object_detection">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Detecção de Objetos
                  </div>
                </SelectItem>
                <SelectItem value="text_detection">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Detecção de Texto (OCR)
                  </div>
                </SelectItem>
                <SelectItem value="face_detection">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Detecção de Faces
                  </div>
                </SelectItem>
                <SelectItem value="safety_analysis">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Análise de Segurança
                  </div>
                </SelectItem>
                <SelectItem value="video">
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Análise de Vídeo
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {analysisType === 'video' ? (
            <div className="space-y-2">
              <Label htmlFor="videoUrl">URL do Vídeo</Label>
              <Input
                id="videoUrl"
                type="url"
                placeholder="https://storage.googleapis.com/seu-bucket/video.mp4"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL da Imagem</Label>
              <Input
                id="imageUrl"
                type="url"
                placeholder="https://example.com/imagem.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handleAnalysis}
            disabled={loading || (!imageUrl && !videoUrl)}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Iniciar Análise
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Análise</CardTitle>
            <CardDescription>
              Análise realizada em {new Date(result.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <Tabs defaultValue="formatted" className="w-full">
                <TabsList>
                  <TabsTrigger value="formatted">Visualização</TabsTrigger>
                  <TabsTrigger value="raw">Dados Brutos</TabsTrigger>
                </TabsList>
                
                <TabsContent value="formatted" className="space-y-4">
                  {analysisType === 'object_detection' && renderObjectDetection(result.result)}
                  {analysisType === 'safety_analysis' && renderSafetyAnalysis(result.result)}
                  {!['object_detection', 'safety_analysis'].includes(analysisType) && renderGenericResult(result.result)}
                </TabsContent>
                
                <TabsContent value="raw">
                  <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-96">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Erro na análise: {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}