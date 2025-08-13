import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-org-id",
};

interface FrameAnalysisRequest {
  frame_id: string;
  camera_id: string;
  timestamp: string;
  frame_data?: string; // base64 encoded frame
  analytics_enabled: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Get org_id from API key
    const apiKey = req.headers.get("x-api-key");
    const orgId = req.headers.get("x-org-id");
    
    if (!apiKey || !orgId) {
      return new Response(JSON.stringify({ error: "API key and org ID required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Set org context for RLS
    await supabase.rpc('set_config', { 
      parameter: 'request.org_id', 
      value: orgId 
    });

    const { frame_id, camera_id, timestamp, frame_data, analytics_enabled }: FrameAnalysisRequest = await req.json();

    const startTime = performance.now();
    
    // Simulate real analytics processing
    const results = await processFrame(frame_data, analytics_enabled);
    
    const processingTime = Math.round(performance.now() - startTime);

    // Store frame analysis
    const { error: analysisError } = await supabase
      .from('frame_analysis')
      .insert({
        frame_id,
        camera_id,
        org_id: orgId,
        timestamp,
        people_count: results.people_count,
        processing_time_ms: processingTime,
        analytics_enabled,
        metadata: {
          analytics_results: results,
          processing_status: 'completed'
        }
      });

    if (analysisError) throw analysisError;

    // Store detections
    if (results.detections.length > 0) {
      const { error: detectionsError } = await supabase
        .from('detections')
        .insert(
          results.detections.map(detection => ({
            frame_id,
            camera_id,
            org_id: orgId,
            service: detection.service,
            detection_type: detection.type,
            confidence: detection.confidence,
            bbox: detection.bbox,
            metadata: detection.metadata || {}
          }))
        );

      if (detectionsError) throw detectionsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        frame_id,
        processing_time_ms: processingTime,
        people_count: results.people_count,
        detections_count: results.detections.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Analytics processing error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function processFrame(frameData: string | undefined, analyticsEnabled: string[]) {
  // Simulate real computer vision processing
  const results = {
    people_count: 0,
    detections: [] as Array<{
      service: string;
      type: string;
      confidence: number;
      bbox: number[];
      metadata?: Record<string, any>;
    }>
  };

  // Simulate different analytics services
  for (const analytic of analyticsEnabled) {
    switch (analytic) {
      case 'people_detection':
        const peopleCount = Math.floor(Math.random() * 5);
        results.people_count = peopleCount;
        
        for (let i = 0; i < peopleCount; i++) {
          results.detections.push({
            service: 'yolo-detection',
            type: 'person',
            confidence: 0.7 + Math.random() * 0.3,
            bbox: [
              Math.random() * 0.7,
              Math.random() * 0.6,
              Math.random() * 0.3 + 0.1,
              Math.random() * 0.4 + 0.1
            ]
          });
        }
        break;

      case 'vehicle_detection':
        if (Math.random() > 0.7) {
          const vehicleTypes = ['car', 'truck', 'motorcycle', 'bus'];
          const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
          
          results.detections.push({
            service: 'yolo-detection',
            type: vehicleType,
            confidence: 0.8 + Math.random() * 0.2,
            bbox: [
              Math.random() * 0.6,
              Math.random() * 0.5,
              Math.random() * 0.4 + 0.15,
              Math.random() * 0.3 + 0.15
            ]
          });
        }
        break;

      case 'safety_monitoring':
        if (Math.random() > 0.9) {
          results.detections.push({
            service: 'safetyvision',
            type: 'safety_violation',
            confidence: 0.85,
            bbox: [
              Math.random() * 0.7,
              Math.random() * 0.6,
              Math.random() * 0.2 + 0.1,
              Math.random() * 0.3 + 0.1
            ],
            metadata: {
              violation_type: 'no_helmet',
              severity: 'high'
            }
          });
        }
        break;

      case 'behavior_analysis':
        if (Math.random() > 0.8) {
          results.detections.push({
            service: 'edubehavior',
            type: 'behavior_event',
            confidence: 0.75,
            bbox: [
              Math.random() * 0.7,
              Math.random() * 0.6,
              Math.random() * 0.2 + 0.1,
              Math.random() * 0.3 + 0.1
            ],
            metadata: {
              behavior: 'distracted',
              emotion: 'confused'
            }
          });
        }
        break;
    }
  }

  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

  return results;
}