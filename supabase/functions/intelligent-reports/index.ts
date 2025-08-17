import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIReportRequest {
  action: 'generate_insights' | 'suggest_metrics' | 'auto_adjust' | 'create_report';
  vertical: string;
  timeRange: string;
  data?: any;
  cameraId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, vertical, timeRange, data, cameraId }: AIReportRequest = await req.json();

    let result;
    switch (action) {
      case 'generate_insights':
        result = await generateIntelligentInsights(vertical, timeRange, data);
        break;
      case 'suggest_metrics':
        result = await suggestMetrics(vertical, data);
        break;
      case 'auto_adjust':
        result = await autoAdjustParameters(vertical, cameraId, data);
        break;
      case 'create_report':
        result = await createIntelligentReport(vertical, timeRange, data);
        break;
      default:
        throw new Error('Ação não reconhecida');
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro na função de IA:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateIntelligentInsights(vertical: string, timeRange: string, data: any) {
  const prompt = `
Analise os dados a seguir e gere insights inteligentes para o setor ${vertical}:

Dados: ${JSON.stringify(data, null, 2)}
Período: ${timeRange}

Por favor, forneça:
1. Principais tendências identificadas
2. Anomalias ou padrões incomuns
3. Recomendações específicas para o setor
4. Previsões para os próximos períodos
5. Oportunidades de otimização

Seja específico e prático nas recomendações.
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em análise de dados de visão computacional e IA para diferentes setores industriais.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  const result = await response.json();
  const insights = result.choices[0].message.content;

  // Salvar insights no banco
  await supabase.from('ai_reports').insert({
    report_type: 'intelligent_insights',
    content: insights,
    time_range: timeRange,
    metadata: { vertical, generated_at: new Date().toISOString() }
  });

  return {
    insights,
    summary: extractInsightsSummary(insights),
    actionItems: extractActionItems(insights)
  };
}

async function suggestMetrics(vertical: string, currentData: any) {
  const prompt = `
Baseado nos dados atuais do setor ${vertical}, sugira métricas adicionais que seriam valiosas para monitorar:

Dados atuais: ${JSON.stringify(currentData, null, 2)}

Forneça:
1. Métricas específicas para o setor ${vertical}
2. KPIs recomendados 
3. Alertas inteligentes sugeridos
4. Dashboards personalizados
5. Relatórios automáticos recomendados

Formato da resposta em JSON com estrutura:
{
  "recommended_metrics": [
    {
      "name": "nome_da_metrica",
      "description": "descrição",
      "calculation": "como calcular",
      "threshold": "valor limite sugerido",
      "priority": "alta|media|baixa"
    }
  ],
  "kpis": [...],
  "alerts": [...],
  "reports": [...]
}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em métricas e KPIs para sistemas de visão computacional e IA.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });

  const result = await response.json();
  let suggestions;
  
  try {
    suggestions = JSON.parse(result.choices[0].message.content);
  } catch (e) {
    // Fallback se não conseguir parsear JSON
    suggestions = {
      recommended_metrics: [],
      raw_response: result.choices[0].message.content
    };
  }

  return suggestions;
}

async function autoAdjustParameters(vertical: string, cameraId: string, performanceData: any) {
  const prompt = `
Analise os dados de performance abaixo e sugira ajustes automáticos nos parâmetros do sistema:

Vertical: ${vertical}
Camera ID: ${cameraId}
Dados de Performance: ${JSON.stringify(performanceData, null, 2)}

Sugira ajustes específicos para:
1. Thresholds de detecção
2. Configurações de sensibilidade
3. Parâmetros de filtros
4. Configurações de qualidade
5. Otimizações de performance

Retorne em formato JSON:
{
  "adjustments": [
    {
      "parameter": "nome_do_parametro",
      "current_value": "valor_atual",
      "suggested_value": "valor_sugerido",
      "reason": "motivo_do_ajuste",
      "impact": "impacto_esperado"
    }
  ],
  "auto_apply": true/false,
  "confidence_score": 0.0-1.0
}
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um especialista em otimização de sistemas de IA e visão computacional.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1200,
      temperature: 0.2,
    }),
  });

  const result = await response.json();
  let adjustments;
  
  try {
    adjustments = JSON.parse(result.choices[0].message.content);
  } catch (e) {
    adjustments = {
      adjustments: [],
      auto_apply: false,
      confidence_score: 0.0,
      raw_response: result.choices[0].message.content
    };
  }

  // Se confiança for alta, aplicar ajustes automaticamente
  if (adjustments.confidence_score > 0.8 && adjustments.auto_apply) {
    await applyAutomaticAdjustments(cameraId, adjustments.adjustments);
  }

  return adjustments;
}

async function createIntelligentReport(vertical: string, timeRange: string, data: any) {
  const prompt = `
Crie um relatório executivo inteligente e abrangente para o setor ${vertical}:

Dados: ${JSON.stringify(data, null, 2)}
Período: ${timeRange}

O relatório deve incluir:
1. Resumo Executivo
2. Análise de Performance
3. Tendências e Padrões
4. Comparativos e Benchmarks
5. Recomendações Estratégicas
6. Plano de Ação
7. Próximos Passos

Use um tom profissional e seja específico com dados numéricos.
`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4.1-2025-04-14',
      messages: [
        { 
          role: 'system', 
          content: 'Você é um consultor sênior especializado em relatórios executivos para sistemas de IA e monitoramento inteligente.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.4,
    }),
  });

  const result = await response.json();
  const report = result.choices[0].message.content;

  // Salvar relatório no banco
  const { data: savedReport } = await supabase.from('ai_reports').insert({
    report_type: 'executive_report',
    content: report,
    time_range: timeRange,
    metadata: { 
      vertical, 
      generated_at: new Date().toISOString(),
      auto_generated: true 
    }
  }).select().single();

  return {
    report,
    report_id: savedReport.id,
    insights_count: countInsights(report),
    recommendations_count: countRecommendations(report)
  };
}

async function applyAutomaticAdjustments(cameraId: string, adjustments: any[]) {
  // Aplicar ajustes nos parâmetros da câmera
  for (const adjustment of adjustments) {
    await supabase.from('camera_ai_profiles').update({
      [adjustment.parameter]: adjustment.suggested_value,
      updated_at: new Date().toISOString()
    }).eq('camera_id', cameraId);
  }

  // Log dos ajustes aplicados
  await supabase.from('audit_logs').insert({
    action: 'auto_adjustment_applied',
    resource_type: 'camera_ai_profile',
    resource_id: cameraId,
    metadata: { adjustments, applied_at: new Date().toISOString() }
  });
}

function extractInsightsSummary(insights: string): string[] {
  const lines = insights.split('\n');
  return lines
    .filter(line => line.trim().length > 0)
    .slice(0, 5)
    .map(line => line.replace(/^\d+\.\s*/, '').trim());
}

function extractActionItems(insights: string): string[] {
  const actionKeywords = ['recomenda', 'sugere', 'deve', 'precisa', 'implementar'];
  const lines = insights.split('\n');
  
  return lines
    .filter(line => actionKeywords.some(keyword => 
      line.toLowerCase().includes(keyword)
    ))
    .slice(0, 3);
}

function countInsights(report: string): number {
  const insightKeywords = ['insight', 'tendência', 'padrão', 'análise'];
  return insightKeywords.reduce((count, keyword) => 
    count + (report.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
  );
}

function countRecommendations(report: string): number {
  const recKeywords = ['recomenda', 'sugere', 'ação'];
  return recKeywords.reduce((count, keyword) => 
    count + (report.toLowerCase().match(new RegExp(keyword, 'g')) || []).length, 0
  );
}