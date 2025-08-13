import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
}

interface AnalyticsRequest {
  camera_id: string;
  image_data: string; // base64 encoded image
  analytics: string[]; // ['peoplevision', 'safetyvision', 'lpr', 'face']
  frame_timestamp?: string;
  metadata?: any;
}

interface DetectionResult {
  service: string;
  success: boolean;
  detections?: any[];
  confidence?: number;
  processing_time_ms?: number;
  error?: string;
}

interface AnalyticsResponse {
  success: boolean;
  frame_id: string;
  camera_id: string;
  timestamp: string;
  results: DetectionResult[];
  total_processing_time_ms: number;
  people_count?: number;
  safety_violations?: any[];
  license_plates?: any[];
  faces_detected?: any[];
}

// Analytics service endpoints configuration
const ANALYTICS_SERVICES = {
  peoplevision: {
    url: Deno.env.get('YOLO_SERVICE_URL') || 'http://yolo-detection:8080',
    endpoint: '/detect_people',
    timeout: 5000
  },
  safetyvision: {
    url: Deno.env.get('SAFETY_SERVICE_URL') || 'http://safetyvision:8089',
    endpoint: '/analyze_safety',
    timeout: 8000
  },
  lpr: {
    url: Deno.env.get('LPR_SERVICE_URL') || 'http://lpr-service:8080',
    endpoint: '/plate_detect',
    timeout: 6000
  },
  face: {
    url: Deno.env.get('FACE_SERVICE_URL') || 'http://face-service:18080',
    endpoint: '/extract',
    timeout: 7000
  }
};

// Call individual analytics service
async function callAnalyticsService(
  serviceName: string, 
  imageData: string, 
  config: any
): Promise<DetectionResult> {
  const startTime = Date.now();
  
  try {
    console.log(`Calling ${serviceName} service at ${config.url}${config.endpoint}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    
    const payload = {
      jpg_b64: imageData,
      confidence_threshold: 0.5,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(`${config.url}${config.endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const processingTime = Date.now() - startTime;
    
    console.log(`${serviceName} service responded in ${processingTime}ms`);
    
    return {
      service: serviceName,
      success: true,
      detections: result.detections || result.faces || [result],
      confidence: result.confidence || result.max_confidence,
      processing_time_ms: processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`Error calling ${serviceName} service:`, error.message);
    
    return {
      service: serviceName,
      success: false,
      processing_time_ms: processingTime,
      error: error.message
    };
  }
}

// Process frame with multiple analytics
async function processFrame(
  request: AnalyticsRequest
): Promise<AnalyticsResponse> {
  const frameId = `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = request.frame_timestamp || new Date().toISOString();
  const totalStartTime = Date.now();
  
  console.log(`Processing frame ${frameId} for camera ${request.camera_id} with analytics: ${request.analytics.join(', ')}`);
  
  // Call analytics services in parallel
  const analyticsPromises = request.analytics.map(async (analyticName) => {
    const config = ANALYTICS_SERVICES[analyticName];
    if (!config) {
      return {
        service: analyticName,
        success: false,
        processing_time_ms: 0,
        error: `Unknown analytics service: ${analyticName}`
      };
    }
    
    return await callAnalyticsService(analyticName, request.image_data, config);
  });
  
  const results = await Promise.all(analyticsPromises);
  const totalProcessingTime = Date.now() - totalStartTime;
  
  // Aggregate results
  const peopleCount = results
    .filter(r => r.service === 'peoplevision' && r.success)
    .reduce((count, r) => count + (r.detections?.length || 0), 0);
  
  const safetyViolations = results
    .filter(r => r.service === 'safetyvision' && r.success)
    .flatMap(r => r.detections?.filter(d => d.violation) || []);
  
  const licensePlates = results
    .filter(r => r.service === 'lpr' && r.success)
    .flatMap(r => r.detections?.filter(d => d.plate) || []);
  
  const facesDetected = results
    .filter(r => r.service === 'face' && r.success)
    .flatMap(r => r.detections || []);
  
  console.log(`Frame ${frameId} processed in ${totalProcessingTime}ms. Found: ${peopleCount} people, ${safetyViolations.length} safety issues, ${licensePlates.length} plates, ${facesDetected.length} faces`);
  
  return {
    success: true,
    frame_id: frameId,
    camera_id: request.camera_id,
    timestamp,
    results,
    total_processing_time_ms: totalProcessingTime,
    people_count: peopleCount,
    safety_violations: safetyViolations,
    license_plates: licensePlates,
    faces_detected: facesDetected
  };
}

// Store analytics results in database
async function storeAnalyticsResults(
  supabase: any,
  response: AnalyticsResponse,
  orgId: string
): Promise<void> {
  try {
    // Store main analysis record
    const { data: analysis, error: analysisError } = await supabase
      .from('frame_analysis')
      .insert({
        frame_id: response.frame_id,
        camera_id: response.camera_id,
        org_id: orgId,
        timestamp: response.timestamp,
        people_count: response.people_count,
        processing_time_ms: response.total_processing_time_ms,
        analytics_enabled: response.results.map(r => r.service),
        metadata: {
          safety_violations: response.safety_violations?.length || 0,
          license_plates: response.license_plates?.length || 0,
          faces_detected: response.faces_detected?.length || 0
        }
      });
    
    if (analysisError) {
      console.error('Error storing analysis:', analysisError);
    }
    
    // Store individual detection results
    for (const result of response.results) {
      if (result.success && result.detections?.length > 0) {
        for (const detection of result.detections) {
          await supabase
            .from('detections')
            .insert({
              frame_id: response.frame_id,
              camera_id: response.camera_id,
              org_id: orgId,
              service: result.service,
              detection_type: detection.class || detection.type || 'unknown',
              confidence: detection.confidence || result.confidence,
              bbox: detection.bbox,
              metadata: detection
            });
        }
      }
    }
    
    console.log(`Stored analytics results for frame ${response.frame_id}`);
    
  } catch (error) {
    console.error('Error storing analytics results:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get org_id from header
    const orgId = req.headers.get('x-org-id');
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody: AnalyticsRequest = await req.json();

    // Validate request
    if (!requestBody.camera_id || !requestBody.image_data || !requestBody.analytics?.length) {
      return new Response(
        JSON.stringify({ 
          error: 'camera_id, image_data, and analytics array are required' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify camera belongs to organization
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('id, name, org_id')
      .eq('id', requestBody.camera_id)
      .eq('org_id', orgId)
      .single();

    if (cameraError || !camera) {
      return new Response(
        JSON.stringify({ error: 'Camera not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process frame with analytics
    const response = await processFrame(requestBody);

    // Store results in database
    await storeAnalyticsResults(supabase, response, orgId);

    // Log usage for billing
    await supabase
      .from('usage_events')
      .insert({
        org_id: orgId,
        event_type: 'analytics_processing',
        quantity: requestBody.analytics.length,
        metadata: {
          camera_id: requestBody.camera_id,
          frame_id: response.frame_id,
          analytics: requestBody.analytics,
          processing_time_ms: response.total_processing_time_ms
        }
      });

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})