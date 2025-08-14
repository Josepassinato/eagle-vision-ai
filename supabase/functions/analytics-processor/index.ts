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

    // Store detections directly - frame_analysis table doesn't exist
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
            metadata: {
              analytics_results: results,
              processing_status: 'completed',
              processing_time_ms: processingTime,
              timestamp,
              ...detection.metadata
            }
          }))
        );

      if (detectionsError) {
        console.error('Detection insert error:', detectionsError);
        throw detectionsError;
      }
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
  // Real computer vision processing using external services
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

  if (!frameData) {
    return results;
  }

  // Process each analytics service
  for (const analytic of analyticsEnabled) {
    try {
      switch (analytic) {
        case 'people_detection':
          const yoloResult = await callYoloDetection(frameData);
          if (yoloResult?.boxes) {
            results.people_count = yoloResult.boxes.length;
            yoloResult.boxes.forEach((box: any) => {
              results.detections.push({
                service: 'yolo-detection',
                type: 'person',
                confidence: box.score,
                bbox: box.xyxy,
                metadata: { class: box.cls }
              });
            });
          }
          break;

        case 'vehicle_detection':
          const vehicleResult = await callYoloDetection(frameData);
          if (vehicleResult?.boxes) {
            const vehicles = vehicleResult.boxes.filter((box: any) => 
              ['car', 'truck', 'bus', 'motorcycle'].includes(box.cls)
            );
            vehicles.forEach((box: any) => {
              results.detections.push({
                service: 'yolo-detection',
                type: box.cls,
                confidence: box.score,
                bbox: box.xyxy,
                metadata: { class: box.cls }
              });
            });
          }
          break;

        case 'safety_monitoring':
        case 'safety_analysis':
          // Call SafetyVision service for PPE and safety analysis
          const safetyResult = await callSafetyVision(frameData, results.detections);
          if (safetyResult?.signals) {
            safetyResult.signals.forEach((signal: any) => {
              results.detections.push({
                service: 'safetyvision',
                type: signal.type,
                confidence: signal.confidence || 0.8,
                bbox: signal.bbox || [0, 0, 0, 0],
                metadata: signal.details
              });
            });
          }
          break;

        case 'behavior_analysis':
          // Call EduBehavior service for emotional analysis
          const behaviorResult = await callEduBehavior(frameData, results.detections);
          if (behaviorResult?.signals) {
            behaviorResult.signals.forEach((signal: any) => {
              results.detections.push({
                service: 'edubehavior',
                type: signal.type,
                confidence: signal.confidence || 0.75,
                bbox: signal.bbox || [0, 0, 0, 0],
                metadata: signal.details
              });
            });
          }
          break;

        default:
          console.warn(`Unknown analytic type: ${analytic}`);
      }
    } catch (error) {
      console.error(`Error processing ${analytic}:`, error);
    }
  }

  return results;
}

async function callYoloDetection(frameData: string) {
  try {
    const response = await fetch('http://yolo-detection:8080/detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jpg_b64: frameData }),
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('YOLO detection failed:', error);
  }
  return null;
}

async function callSafetyVision(frameData: string, tracks: any[]) {
  try {
    const response = await fetch('http://safetyvision:8089/analyze_frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_jpeg_b64: frameData,
        tracks: tracks.map(t => ({ track_id: t.service, bbox: t.bbox })),
        zone_type: 'industrial'
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('SafetyVision analysis failed:', error);
  }
  return null;
}

async function callEduBehavior(frameData: string, tracks: any[]) {
  try {
    const response = await fetch('http://edubehavior:8087/analyze_frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame_jpeg_b64: frameData,
        tracks: tracks.map(t => ({ track_id: t.service, bbox: t.bbox })),
        class_id: 'default'
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('EduBehavior analysis failed:', error);
  }
  return null;
}