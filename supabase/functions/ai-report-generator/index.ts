import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.54.0';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  reportType: 'security' | 'performance' | 'incidents' | 'roi';
  timeRange: string;
  cameras?: string[];
  includeRecommendations?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { reportType, timeRange, cameras, includeRecommendations } = await req.json() as ReportRequest;

    console.log(`Generating ${reportType} report for ${timeRange}`, { cameras, includeRecommendations });

    // Buscar dados relevantes
    const { data: events } = await supabase
      .from('detection_events')
      .select('*')
      .gte('created_at', new Date(Date.now() - (timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : 2592000000)).toISOString())
      .in('camera_id', cameras || []);

    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 86400000).toISOString());

    // Preparar dados para análise
    const analysisData = {
      totalEvents: events?.length || 0,
      eventTypes: events?.reduce((acc: any, event: any) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {}),
      avgConfidence: events?.reduce((sum: number, event: any) => sum + event.confidence, 0) / (events?.length || 1),
      systemPerformance: {
        avgCpuUsage: metrics?.reduce((sum: number, m: any) => sum + m.cpu_usage, 0) / (metrics?.length || 1),
        avgMemoryUsage: metrics?.reduce((sum: number, m: any) => sum + m.memory_usage, 0) / (metrics?.length || 1),
        avgGpuUsage: metrics?.reduce((sum: number, m: any) => sum + m.gpu_usage, 0) / (metrics?.length || 1)
      }
    };

    const systemPrompt = `Você é um especialista em análise de dados de visão computacional e segurança. 
Gere um relatório ${reportType} detalhado e profissional baseado nos dados fornecidos.
O relatório deve incluir:
1. Resumo executivo
2. Análise detalhada dos dados
3. Insights e tendências identificadas
4. ${includeRecommendations ? 'Recomendações específicas e acionáveis' : ''}
5. Conclusões e próximos passos

Use linguagem profissional e formatação clara com markdown.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Gere um relatório ${reportType} para o período ${timeRange} com os seguintes dados:
            
            **Dados de Eventos:**
            - Total de eventos: ${analysisData.totalEvents}
            - Tipos de eventos: ${JSON.stringify(analysisData.eventTypes, null, 2)}
            - Confiança média: ${(analysisData.avgConfidence * 100).toFixed(1)}%
            
            **Performance do Sistema:**
            - CPU média: ${analysisData.systemPerformance.avgCpuUsage?.toFixed(1)}%
            - Memória média: ${analysisData.systemPerformance.avgMemoryUsage?.toFixed(1)}%
            - GPU média: ${analysisData.systemPerformance.avgGpuUsage?.toFixed(1)}%
            
            Período de análise: ${timeRange}
            Câmeras analisadas: ${cameras?.length || 'Todas'}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.3
      }),
    });

    const aiData = await response.json();
    const reportContent = aiData.choices[0].message.content;

    // Salvar relatório gerado
    const { data: savedReport } = await supabase
      .from('ai_reports')
      .insert({
        report_type: reportType,
        time_range: timeRange,
        content: reportContent,
        metadata: {
          cameras: cameras || [],
          includeRecommendations,
          generatedAt: new Date().toISOString(),
          dataPoints: analysisData
        }
      })
      .select()
      .single();

    return new Response(JSON.stringify({ 
      report: reportContent,
      reportId: savedReport?.id,
      metadata: analysisData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating AI report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});