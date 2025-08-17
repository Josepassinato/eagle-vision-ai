import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle, XCircle, Clock, Play } from 'lucide-react';
import { testGoogleAPI, runComprehensiveTest } from '@/utils/testGoogleAPI';

export default function GoogleAPITester() {
  const [imageUrl, setImageUrl] = useState('https://storage.googleapis.com/cloud-samples-data/vision/using_curl/sandwich.jpg');
  const [testing, setTesting] = useState(false);
  const [comprehensiveTesting, setComprehensiveTesting] = useState(false);
  const [results, setResults] = useState<{
    success: boolean;
    responseTime: number;
    error?: string;
    data?: any;
    comprehensiveResults?: any;
  } | null>(null);
  const { toast } = useToast();

  const runQuickTest = async () => {
    setTesting(true);
    setResults(null);
    
    try {
      const result = await testGoogleAPI();
      setResults(result);
      
      if (result.success) {
        toast({
          title: "✅ Teste Concluído",
          description: `API respondeu em ${result.responseTime}ms - ${result.performanceGrade}`,
        });
      } else {
        toast({
          title: "❌ Teste Falhou",
          description: result.error || 'Erro desconhecido',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar teste",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const runFullTest = async () => {
    setComprehensiveTesting(true);
    setResults(null);
    
    try {
      const comprehensiveResults = await runComprehensiveTest();
      setResults({
        success: comprehensiveResults.successfulTests > 0,
        responseTime: comprehensiveResults.avgResponseTime,
        comprehensiveResults
      });
      
      toast({
        title: "🔬 Teste Abrangente Concluído",
        description: `${comprehensiveResults.successfulTests}/${comprehensiveResults.totalTests} testes passaram`,
      });
    } catch (error) {
      console.error('Erro no teste abrangente:', error);
      toast({
        title: "Erro",
        description: "Falha ao executar teste abrangente",
        variant: "destructive",
      });
    } finally {
      setComprehensiveTesting(false);
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

        <div className="flex gap-2">
          <Button 
            onClick={runQuickTest}
            disabled={testing || comprehensiveTesting}
            className="flex-1"
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Teste Rápido
              </>
            )}
          </Button>
          
          <Button 
            onClick={runFullTest}
            disabled={testing || comprehensiveTesting}
            variant="outline"
            className="flex-1"
          >
            {comprehensiveTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              '🔬 Teste Completo'
            )}
          </Button>
        </div>

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

            {results.comprehensiveResults && (
              <div className="space-y-2">
                <span className="font-medium">Resultados Abrangentes:</span>
                <div className="text-sm space-y-1">
                  <p>✅ Testes bem-sucedidos: {results.comprehensiveResults.successfulTests}/{results.comprehensiveResults.totalTests}</p>
                  <p>⏱️ Tempo médio: {Math.round(results.comprehensiveResults.avgResponseTime)}ms</p>
                  <p>🎯 Meta p95 &lt; 2s: {results.comprehensiveResults.meetsPerformanceTarget ? 'ATENDIDA' : 'NÃO ATENDIDA'}</p>
                </div>
              </div>
            )}

            {results.error && (
              <div className="space-y-2">
                <span className="font-medium text-red-500">Erro:</span>
                <p className="text-sm text-muted-foreground bg-red-50 p-2 rounded">
                  {results.error}
                </p>
              </div>
            )}

            {results.data && !results.comprehensiveResults && (
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
          <p>• <strong>Teste Rápido:</strong> Usa imagem pré-definida para validação básica</p>
          <p>• <strong>Teste Completo:</strong> Múltiplos cenários (objetos, segurança, análise geral)</p>
          <p>• Verifica se autenticação e todas funcionalidades estão operacionais</p>
        </div>
      </CardContent>
    </Card>
  );
}