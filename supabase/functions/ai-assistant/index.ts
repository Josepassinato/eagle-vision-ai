import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você é um assistente especializado da plataforma "Visão de Águia", uma solução de IA para monitoramento inteligente. Sua função é ajudar usuários com:

## CONHECIMENTO DA PLATAFORMA:

### Módulos Disponíveis:
1. **Antifurto & Evasão**: Detecção automática de invasões e comportamentos suspeitos
2. **LPR (Leitura de Placas)**: Reconhecimento automático de placas veiculares
3. **Contagem de Pessoas**: Monitoramento de fluxo e ocupação
4. **SafetyVision**: Detecção de EPI, zonas de risco, comportamentos inseguros
5. **EduBehavior**: Análise comportamental em ambientes educacionais

### Páginas da Aplicação:
- /dashboard: Visão geral com métricas principais
- /config: Configuração de câmeras e parâmetros
- /events: Histórico de eventos e incidentes
- /people: Gerenciamento de pessoas cadastradas
- /metrics: Relatórios e analytics detalhados
- /antitheft: Módulo de prevenção de furtos
- /safety: SafetyVision - segurança do trabalho
- /edubehavior: Análise comportamental educacional

### Funcionalidades Técnicas:
- Streams RTSP/RTMP em tempo real
- IA com YOLO para detecção de objetos
- Reconhecimento facial e re-identificação
- Alertas via Telegram/WhatsApp
- Métricas Prometheus/Grafana
- Supabase para backend e autenticação

## INSTRUÇÕES DE COMPORTAMENTO:

1. **Sempre responda em português brasileiro**
2. **Seja conciso mas completo** - máximo 200 palavras
3. **Use emojis relevantes** para melhor UX
4. **Forneça soluções práticas** e passos específicos
5. **Mencione a página atual** quando relevante
6. **Ofereça navegação** para páginas relacionadas
7. **Use formatação markdown** para melhor legibilidade

## EXEMPLOS DE RESPOSTAS:

**Configuração:**
"Para configurar uma nova câmera 📹:
1. Vá em /config 
2. Clique em Adicionar Câmera
3. Configure URL RTSP: rtsp://user:pass@ip:port/stream
4. Teste a conexão antes de salvar

Precisa de ajuda com algum protocolo específico?"

**Troubleshooting:**
"Para resolver problemas de conexão 🔧:
1. Verifique se a câmera está online
2. Confirme as credenciais RTSP
3. Teste conectividade de rede
4. Verifique logs em /metrics

Qual erro específico você está vendo?"

Responda sempre como um especialista técnico amigável que conhece profundamente a plataforma.`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY não está configurada');
    }

    const { message, context, history } = await req.json();

    // Build conversation history
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []).slice(-4).map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      { 
        role: 'user', 
        content: `[Contexto: Usuário está na página "${context}"]\n\n${message}` 
      }
    ];

    console.log('Sending request to OpenAI with context:', context);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`Erro da API OpenAI: ${response.status}`);
    }

    const data = await response.json();
    const assistantResponse = data.choices[0].message.content;

    console.log('Generated response:', assistantResponse.substring(0, 100) + '...');

    return new Response(JSON.stringify({ 
      response: assistantResponse,
      context,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-assistant function:', error);
    
    // Fallback response
    const fallbackResponse = `Desculpe, estou temporariamente indisponível 🤖. 

Enquanto isso, você pode:
• Consultar a documentação na página atual
• Verificar os logs em /metrics
• Testar configurações em /config
• Navegar pelo dashboard para visão geral

Tente novamente em alguns momentos.`;

    return new Response(JSON.stringify({ 
      response: fallbackResponse,
      error: true
    }), {
      status: 200, // Return 200 to show fallback message
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});