import { supabase } from '@/integrations/supabase/client';

export async function testGoogleAPI() {
  console.log('🚀 Iniciando teste da API do Google Vertex AI...');
  
  const startTime = Date.now();
  
  try {
    // Usar uma imagem de teste pública
    const testImageUrl = 'https://storage.googleapis.com/cloud-samples-data/vision/using_curl/sandwich.jpg';
    
    console.log('📤 Enviando requisição para vertex-ai-analysis...');
    
    const { data, error } = await supabase.functions.invoke('vertex-ai-analysis', {
      body: {
        imageUrl: testImageUrl,
        analysisType: 'object_detection'
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      console.error('❌ Erro na chamada da função:', error);
      return {
        success: false,
        responseTime,
        error: error.message,
        details: error
      };
    }
    
    console.log('✅ Resposta recebida em', responseTime, 'ms');
    console.log('📊 Dados retornados:', data);
    
    // Verificar se a resposta tem a estrutura esperada
    const isValidResponse = data && typeof data === 'object' && 
                           'success' in data && 'analysisType' in data;
    
    if (!isValidResponse) {
      console.warn('⚠️ Formato de resposta inesperado');
    }
    
    return {
      success: data?.success || false,
      responseTime,
      data,
      isValidResponse,
      performanceGrade: responseTime < 1000 ? 'EXCELENTE' : 
                       responseTime < 2000 ? 'BOM' : 'LENTO'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('💥 Erro durante o teste:', error);
    
    return {
      success: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      details: error
    };
  }
}

// Função para testar múltiplos cenários
export async function runComprehensiveTest() {
  console.log('🔬 Executando teste abrangente da API do Google...');
  
  const tests = [
    {
      name: 'Detecção de Objetos',
      config: {
        imageUrl: 'https://storage.googleapis.com/cloud-samples-data/vision/using_curl/sandwich.jpg',
        analysisType: 'object_detection'
      }
    },
    {
      name: 'Análise Geral de Imagem',
      config: {
        imageUrl: 'https://storage.googleapis.com/cloud-samples-data/vision/using_curl/sandwich.jpg',
        analysisType: 'image'
      }
    },
    {
      name: 'Análise de Segurança',
      config: {
        imageUrl: 'https://storage.googleapis.com/cloud-samples-data/vision/using_curl/sandwich.jpg',
        analysisType: 'safety_analysis'
      }
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    console.log(`\n🧪 Testando: ${test.name}`);
    
    try {
      const startTime = Date.now();
      
      const { data, error } = await supabase.functions.invoke('vertex-ai-analysis', {
        body: test.config
      });
      
      const responseTime = Date.now() - startTime;
      
      results.push({
        name: test.name,
        success: !error && data?.success,
        responseTime,
        error: error?.message,
        data: data
      });
      
      console.log(`   ⏱️ Tempo: ${responseTime}ms`);
      console.log(`   ${!error && data?.success ? '✅' : '❌'} Status: ${!error && data?.success ? 'Sucesso' : 'Falha'}`);
      
    } catch (err) {
      console.error(`   💥 Erro em ${test.name}:`, err);
      results.push({
        name: test.name,
        success: false,
        responseTime: 0,
        error: err instanceof Error ? err.message : 'Erro desconhecido'
      });
    }
    
    // Pequena pausa entre testes
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Resumo dos resultados
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('='.repeat(50));
  
  const successfulTests = results.filter(r => r.success).length;
  const avgResponseTime = results.reduce((acc, r) => acc + r.responseTime, 0) / results.length;
  
  console.log(`✅ Testes bem-sucedidos: ${successfulTests}/${results.length}`);
  console.log(`⏱️ Tempo médio de resposta: ${Math.round(avgResponseTime)}ms`);
  console.log(`🎯 Atende objetivo p95 < 2s: ${avgResponseTime < 2000 ? 'SIM' : 'NÃO'}`);
  
  results.forEach(result => {
    console.log(`\n${result.success ? '✅' : '❌'} ${result.name}`);
    console.log(`   Tempo: ${result.responseTime}ms`);
    if (result.error) console.log(`   Erro: ${result.error}`);
  });
  
  return {
    totalTests: results.length,
    successfulTests,
    avgResponseTime,
    meetsPerformanceTarget: avgResponseTime < 2000,
    details: results
  };
}