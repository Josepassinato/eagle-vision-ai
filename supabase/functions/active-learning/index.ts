import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    console.log(`Active Learning API called with action: ${action}`);

    switch (action) {
      case 'get_samples_for_annotation':
        return await getSamplesForAnnotation(supabase, body);
      case 'submit_annotation':
        return await submitAnnotation(supabase, body);
      case 'get_model_performance':
        return await getModelPerformance(supabase, body);
      case 'trigger_retraining':
        return await triggerRetraining(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in active-learning function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function getSamplesForAnnotation(supabase: any, body: any) {
  const { limit = 20 } = body;
  
  // Simulate getting high-uncertainty samples from active learning system
  const mockSamples = [
    {
      id: '1',
      camera_id: 'cam-01',
      uncertainty_score: 0.85,
      model_predictions: {
        detected_objects: [{ class: 'person', confidence: 0.75, bbox: [0.1, 0.2, 0.5, 0.8] }],
        pose_keypoints: []
      },
      frame_data: null, // Base64 image data would go here
      annotation_status: 'PENDING',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      camera_id: 'cam-02',
      uncertainty_score: 0.78,
      model_predictions: {
        detected_objects: [{ class: 'person', confidence: 0.68, bbox: [0.3, 0.1, 0.7, 0.9] }],
        pose_keypoints: []
      },
      frame_data: null,
      annotation_status: 'PENDING',
      created_at: new Date().toISOString()
    }
  ];

  return new Response(
    JSON.stringify({ samples: mockSamples.slice(0, limit) }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function submitAnnotation(supabase: any, body: any) {
  const { sample_id, annotations } = body;
  
  console.log(`Submitting annotation for sample ${sample_id}:`, annotations);
  
  // Here we would typically:
  // 1. Validate the annotation
  // 2. Store it in the database
  // 3. Update the active learning system
  // 4. Trigger model improvement pipeline if needed
  
  // Mock successful annotation submission
  const annotationData = {
    id: crypto.randomUUID(),
    sample_id,
    annotations,
    annotator_id: 'system', // Would be actual user ID
    created_at: new Date().toISOString(),
    validation_status: 'pending'
  };

  return new Response(
    JSON.stringify({ success: true, annotation: annotationData }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getModelPerformance(supabase: any, body: any) {
  // Mock model performance data
  const mockPerformance = [
    {
      model_name: 'YOLO-v8-Person-Detection',
      accuracy: 0.942,
      precision: 0.938,
      recall: 0.945,
      f1_score: 0.941,
      sample_count: 2847
    },
    {
      model_name: 'SafetyVision-PPE-Detector',
      accuracy: 0.896,
      precision: 0.891,
      recall: 0.902,
      f1_score: 0.896,
      sample_count: 1523
    },
    {
      model_name: 'EduBehavior-Engagement',
      accuracy: 0.874,
      precision: 0.869,
      recall: 0.879,
      f1_score: 0.874,
      sample_count: 987
    }
  ];

  return new Response(
    JSON.stringify({ performance: mockPerformance }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function triggerRetraining(supabase: any, body: any) {
  console.log('Triggering model retraining pipeline...');
  
  // Here we would typically:
  // 1. Check for sufficient new validated annotations
  // 2. Prepare training data
  // 3. Schedule retraining job
  // 4. Update model versioning
  
  // Mock successful retraining trigger
  const retrainingJob = {
    id: crypto.randomUUID(),
    status: 'queued',
    models_to_retrain: ['YOLO-v8-Person-Detection', 'SafetyVision-PPE-Detector'],
    estimated_completion: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    initiated_at: new Date().toISOString()
  };

  return new Response(
    JSON.stringify({ success: true, retraining_job: retrainingJob }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}