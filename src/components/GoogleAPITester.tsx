import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function GoogleAPITester() {
  const [imageUrl, setImageUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    responseTime: number;
    error?: string;
    data?: any;
  } | null>(null);
  const { toast } = useToast();

  const testAPI = async () => {
    if (!imageUrl) {
      toast({
        title: "Erro",
        description: "Por favor, insira uma URL de imagem para testar",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    setResults(null);
    
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('vertex-ai-analysis', {
        body: {
          imageUrl: imageUrl,
          analysisType: 'image_analysis'
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        setResults({
          success: false,
          responseTime,
          error: error.message || 'Erro desconhecido'
        });
        toast({
          title: "Erro na API",
          description: error.message || 'Falha ao conectar com a API do Google',
          variant: "destructive",
        });
      } else {
        setResults({
          success: true,
          responseTime,
          data
        });
        toast({
          title: "Sucesso",
          description: "API do Google respondeu corretamente",
        });
      }
    } catch (err) {
      const responseTime = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      
      setResults({
        success: false,
        responseTime,
        error: errorMessage
      });
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = () => {
    if (!results) return null;
    
    if (results.success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getLatencyBadge = () => {
    if (!results) return null;
    
    const { responseTime } = results;
    
    if (responseTime < 1000) {
      return <Badge variant="default" className="bg-green-500">Excelente ({responseTime}ms)</Badge>;
    } else if (responseTime < 2000) {
      return <Badge variant="secondary">Bom ({responseTime}ms)</Badge>;
    } else {
      return <Badge variant="destructive">Lento ({responseTime}ms)</Badge>;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Teste da API Google Vertex AI
          {getStatusIcon()}
        </CardTitle>
        <CardDescription>
          Teste a conectividade e performance da API do Google
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="imageUrl">URL da Imagem de Teste</Label>
          <Input
            id="imageUrl"
            placeholder="https://exemplo.com/imagem.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </div>

        <Button 
          onClick={testAPI}
          disabled={testing || !imageUrl}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando API...
            </>
          ) : (
            'Testar API do Google'
          )}
        </Button>

        {results && (
          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium">Status da Resposta:</span>
              {results.success ? (
                <Badge variant="default" className="bg-green-500">Sucesso</Badge>
              ) : (
                <Badge variant="destructive">Erro</Badge>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-medium">Latência:</span>
              {getLatencyBadge()}
            </div>

            {results.error && (
              <div className="space-y-2">
                <span className="font-medium text-red-500">Erro:</span>
                <p className="text-sm text-muted-foreground bg-red-50 p-2 rounded">
                  {results.error}
                </p>
              </div>
            )}

            {results.data && (
              <div className="space-y-2">
                <span className="font-medium text-green-600">Resposta:</span>
                <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-40">
                  {JSON.stringify(results.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        <div className="text-sm text-muted-foreground space-y-1">
          <p className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Tempo alvo: p95 &lt; 2s
          </p>
          <p>• Teste com diferentes tipos de imagem</p>
          <p>• Verifique se a autenticação está funcionando</p>
          <p>• Monitore a qualidade das análises retornadas</p>
        </div>
      </CardContent>
    </Card>
  );
}