import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  imageUrl?: string;
  videoUrl?: string;
  analysisType: 'image' | 'video' | 'object_detection' | 'text_detection' | 'face_detection' | 'safety_analysis';
  features?: string[];
}

// Função para obter token de acesso do Google Cloud
async function getAccessToken(): Promise<string> {
  const serviceAccountKey = Deno.env.get('GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY');
  if (!serviceAccountKey) {
    throw new Error('Service account key not configured');
  }

  const credentials = JSON.parse(serviceAccountKey);
  
  // Criar JWT para autenticação
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  // Preparar dados para requisição de token
  const assertion = await createJWT(header, payload, credentials.private_key);
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: assertion
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get access token');
  }

  return tokenData.access_token;
}

// Função auxiliar para criar JWT
async function createJWT(header: any, payload: any, privateKey: string): Promise<string> {
  const encoder = new TextEncoder();
  
  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
  
  const data = `${encodedHeader}.${encodedPayload}`;
  
  // Import private key
  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the data
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(data)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '');

  return `${data}.${encodedSignature}`;
}

// Análise de imagem com Vertex AI Vision
async function analyzeImage(imageUrl: string, features: string[], accessToken: string) {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  
  const visionRequest = {
    requests: [{
      image: {
        source: {
          imageUri: imageUrl
        }
      },
      features: features.map(feature => ({ type: feature, maxResults: 10 }))
    }]
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/projects/${projectId}/images:annotate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(visionRequest),
    }
  );

  return await response.json();
}

// Análise de vídeo com Video Intelligence
async function analyzeVideo(videoUrl: string, features: string[], accessToken: string) {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  
  const videoRequest = {
    inputUri: videoUrl,
    features: features,
    videoContext: {
      segments: [{
        startTimeOffset: '0s',
        endTimeOffset: '60s'
      }]
    }
  };

  const response = await fetch(
    `https://videointelligence.googleapis.com/v1/projects/${projectId}/videos:annotate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(videoRequest),
    }
  );

  return await response.json();
}

// Detecção de objetos especializada
async function detectObjects(imageUrl: string, accessToken: string) {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  
  const request = {
    requests: [{
      image: {
        source: {
          imageUri: imageUrl
        }
      },
      features: [
        { type: 'OBJECT_LOCALIZATION', maxResults: 50 },
        { type: 'LABEL_DETECTION', maxResults: 20 }
      ]
    }]
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/projects/${projectId}/images:annotate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  const result = await response.json();
  
  // Processar e categorizar objetos detectados
  const objects = result.responses?.[0]?.localizedObjectAnnotations || [];
  const labels = result.responses?.[0]?.labelAnnotations || [];
  
  return {
    objects: objects.map((obj: any) => ({
      name: obj.name,
      confidence: obj.score,
      boundingBox: obj.boundingPoly.normalizedVertices,
      category: categorizeObject(obj.name)
    })),
    labels: labels.map((label: any) => ({
      description: label.description,
      confidence: label.score,
      category: categorizeLabel(label.description)
    })),
    summary: generateObjectSummary(objects, labels)
  };
}

// Análise de segurança
async function analyzeSafety(imageUrl: string, accessToken: string) {
  const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID');
  
  const request = {
    requests: [{
      image: {
        source: {
          imageUri: imageUrl
        }
      },
      features: [
        { type: 'SAFE_SEARCH_DETECTION' },
        { type: 'OBJECT_LOCALIZATION' },
        { type: 'FACE_DETECTION' }
      ]
    }]
  };

  const response = await fetch(
    `https://vision.googleapis.com/v1/projects/${projectId}/images:annotate`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    }
  );

  const result = await response.json();
  const annotations = result.responses?.[0] || {};
  
  return {
    safeSearch: annotations.safeSearchAnnotation,
    faces: annotations.faceAnnotations?.length || 0,
    objects: annotations.localizedObjectAnnotations?.length || 0,
    riskLevel: calculateRiskLevel(annotations),
    recommendations: generateSafetyRecommendations(annotations)
  };
}

// Funções auxiliares
function categorizeObject(objectName: string): string {
  const categories = {
    'Person': 'human',
    'Vehicle': 'transport',
    'Animal': 'nature',
    'Food': 'consumable',
    'Building': 'architecture',
    'Furniture': 'indoor',
    'Electronics': 'technology'
  };
  
  for (const [key, category] of Object.entries(categories)) {
    if (objectName.toLowerCase().includes(key.toLowerCase())) {
      return category;
    }
  }
  return 'other';
}

function categorizeLabel(labelName: string): string {
  const securityKeywords = ['weapon', 'gun', 'knife', 'security', 'police'];
  const safetyKeywords = ['safety', 'helmet', 'vest', 'warning', 'danger'];
  const peopleKeywords = ['person', 'people', 'crowd', 'group', 'human'];
  
  const lower = labelName.toLowerCase();
  
  if (securityKeywords.some(keyword => lower.includes(keyword))) return 'security';
  if (safetyKeywords.some(keyword => lower.includes(keyword))) return 'safety';
  if (peopleKeywords.some(keyword => lower.includes(keyword))) return 'people';
  
  return 'general';
}

function generateObjectSummary(objects: any[], labels: any[]) {
  const peopleCount = objects.filter(obj => obj.name.toLowerCase() === 'person').length;
  const vehicleCount = objects.filter(obj => obj.name.toLowerCase().includes('vehicle')).length;
  
  return {
    totalObjects: objects.length,
    peopleDetected: peopleCount,
    vehiclesDetected: vehicleCount,
    confidence: objects.reduce((acc, obj) => acc + obj.score, 0) / objects.length || 0,
    categories: [...new Set(objects.map(obj => categorizeObject(obj.name)))]
  };
}

function calculateRiskLevel(annotations: any): string {
  const safeSearch = annotations.safeSearchAnnotation || {};
  const risks = ['adult', 'violence', 'racy'];
  
  let riskScore = 0;
  risks.forEach(risk => {
    const level = safeSearch[risk];
    if (level === 'VERY_LIKELY') riskScore += 4;
    else if (level === 'LIKELY') riskScore += 3;
    else if (level === 'POSSIBLE') riskScore += 2;
    else if (level === 'UNLIKELY') riskScore += 1;
  });
  
  if (riskScore >= 10) return 'HIGH';
  if (riskScore >= 6) return 'MEDIUM';
  if (riskScore >= 3) return 'LOW';
  return 'MINIMAL';
}

function generateSafetyRecommendations(annotations: any): string[] {
  const recommendations = [];
  const safeSearch = annotations.safeSearchAnnotation || {};
  
  if (safeSearch.violence === 'LIKELY' || safeSearch.violence === 'VERY_LIKELY') {
    recommendations.push('Conteúdo com possível violência detectado - revisar manualmente');
  }
  
  if (annotations.faceAnnotations?.length > 10) {
    recommendations.push('Muitas faces detectadas - considerar políticas de privacidade');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Conteúdo parece seguro para análise automatizada');
  }
  
  return recommendations;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, videoUrl, analysisType, features = [] }: AnalysisRequest = await req.json();

    console.log(`Iniciando análise ${analysisType} com Vertex AI`);

    // Obter token de acesso
    const accessToken = await getAccessToken();

    let result;

    switch (analysisType) {
      case 'image':
        if (!imageUrl) throw new Error('URL da imagem é obrigatória');
        result = await analyzeImage(imageUrl, features.length ? features : ['LABEL_DETECTION', 'OBJECT_LOCALIZATION'], accessToken);
        break;

      case 'video':
        if (!videoUrl) throw new Error('URL do vídeo é obrigatória');
        result = await analyzeVideo(videoUrl, features.length ? features : ['LABEL_DETECTION', 'OBJECT_TRACKING'], accessToken);
        break;

      case 'object_detection':
        if (!imageUrl) throw new Error('URL da imagem é obrigatória');
        result = await detectObjects(imageUrl, accessToken);
        break;

      case 'text_detection':
        if (!imageUrl) throw new Error('URL da imagem é obrigatória');
        result = await analyzeImage(imageUrl, ['TEXT_DETECTION', 'DOCUMENT_TEXT_DETECTION'], accessToken);
        break;

      case 'face_detection':
        if (!imageUrl) throw new Error('URL da imagem é obrigatória');
        result = await analyzeImage(imageUrl, ['FACE_DETECTION'], accessToken);
        break;

      case 'safety_analysis':
        if (!imageUrl) throw new Error('URL da imagem é obrigatória');
        result = await analyzeSafety(imageUrl, accessToken);
        break;

      default:
        throw new Error('Tipo de análise não suportado');
    }

    console.log(`Análise ${analysisType} concluída com sucesso`);

    return new Response(JSON.stringify({
      success: true,
      analysisType,
      timestamp: new Date().toISOString(),
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na análise do Vertex AI:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});