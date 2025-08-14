import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PredictiveRequest {
  action: 'create_model' | 'get_predictions' | 'train_model' | 'validate_prediction';
  model_config?: {
    model_name: string;
    model_type: string;
    parameters: Record<string, any>;
  };
  prediction_params?: {
    timeframe: string;
    confidence_threshold: number;
    cameras?: string[];
  };
  validation_data?: {
    prediction_id: string;
    actual_value: number;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as PredictiveRequest;
    const { action } = body;

    console.log(`Predictive Analytics API called with action: ${action}`);

    switch (action) {
      case 'create_model':
        return await createModel(supabase, body);
      case 'get_predictions':
        return await getPredictions(supabase, body);
      case 'train_model':
        return await trainModel(supabase, body);
      case 'validate_prediction':
        return await validatePrediction(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in predictive-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function createModel(supabase: any, body: PredictiveRequest) {
  const { model_config } = body;
  
  if (!model_config) {
    throw new Error('Model configuration is required');
  }

  const model = {
    model_name: model_config.model_name,
    model_type: model_config.model_type,
    model_version: '1.0.0',
    model_config: model_config.parameters,
    org_id: crypto.randomUUID(), // In real implementation, get from auth
    status: 'training'
  };

  const { data, error } = await supabase
    .from('predictive_models')
    .insert(model)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create model: ${error.message}`);
  }

  // Simulate training process
  setTimeout(async () => {
    await supabase
      .from('predictive_models')
      .update({ 
        status: 'active',
        accuracy_score: 0.85 + Math.random() * 0.1,
        training_data_size: Math.floor(Math.random() * 10000) + 1000
      })
      .eq('id', data.id);
  }, 5000);

  return new Response(
    JSON.stringify({ success: true, model: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getPredictions(supabase: any, body: PredictiveRequest) {
  const { prediction_params } = body;
  const timeframe = prediction_params?.timeframe || '24h';
  const confidenceThreshold = prediction_params?.confidence_threshold || 0.7;

  // Get active models
  const { data: models, error: modelsError } = await supabase
    .from('predictive_models')
    .select('*')
    .eq('status', 'active');

  if (modelsError) {
    throw new Error(`Failed to fetch models: ${modelsError.message}`);
  }

  // Generate predictions for each model
  const predictions = await Promise.all(
    models.map(async (model: any) => {
      const prediction = await generatePrediction(model, timeframe, confidenceThreshold);
      
      // Store prediction in database
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          org_id: model.org_id,
          model_id: model.id,
          prediction_type: model.model_type,
          predicted_value: prediction.value,
          confidence_score: prediction.confidence,
          prediction_data: prediction.metadata,
          camera_id: prediction.camera_id
        });

      if (error) {
        console.error(`Failed to store prediction: ${error.message}`);
      }

      return {
        model_name: model.model_name,
        model_type: model.model_type,
        ...prediction
      };
    })
  );

  return new Response(
    JSON.stringify({ 
      success: true, 
      predictions: predictions.filter(p => p.confidence >= confidenceThreshold),
      summary: generatePredictionSummary(predictions)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function trainModel(supabase: any, body: PredictiveRequest) {
  const { model_config } = body;
  
  if (!model_config) {
    throw new Error('Model configuration is required');
  }

  // Update model status to training
  const { data: model, error: updateError } = await supabase
    .from('predictive_models')
    .update({ status: 'training' })
    .eq('model_name', model_config.model_name)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to start training: ${updateError.message}`);
  }

  // Simulate training process
  const trainingJob = {
    id: crypto.randomUUID(),
    model_id: model.id,
    status: 'running',
    progress: 0,
    estimated_completion: new Date(Date.now() + 300000).toISOString(), // 5 minutes
    started_at: new Date().toISOString()
  };

  // Simulate training progress
  let progress = 0;
  const progressInterval = setInterval(async () => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      
      // Mark training as complete
      await supabase
        .from('predictive_models')
        .update({ 
          status: 'active',
          accuracy_score: 0.8 + Math.random() * 0.15,
          training_data_size: Math.floor(Math.random() * 50000) + 10000
        })
        .eq('id', model.id);
    }
  }, 2000);

  return new Response(
    JSON.stringify({ success: true, training_job: trainingJob }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function validatePrediction(supabase: any, body: PredictiveRequest) {
  const { validation_data } = body;
  
  if (!validation_data) {
    throw new Error('Validation data is required');
  }

  const { data, error } = await supabase
    .from('predictions')
    .update({
      actual_value: validation_data.actual_value,
      validated_at: new Date().toISOString()
    })
    .eq('id', validation_data.prediction_id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to validate prediction: ${error.message}`);
  }

  // Calculate accuracy
  const accuracy = 1 - Math.abs(data.predicted_value - validation_data.actual_value) / data.predicted_value;

  return new Response(
    JSON.stringify({ 
      success: true, 
      validation: {
        prediction_id: data.id,
        accuracy: accuracy,
        error_rate: Math.abs(data.predicted_value - validation_data.actual_value),
        validated_at: data.validated_at
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function generatePrediction(model: any, timeframe: string, confidenceThreshold: number) {
  const modelType = model.model_type;
  
  switch (modelType) {
    case 'crowd_prediction':
      return {
        value: Math.floor(Math.random() * 100) + 20, // 20-120 people
        confidence: 0.7 + Math.random() * 0.25,
        timeframe,
        camera_id: `cam-${Math.floor(Math.random() * 5) + 1}`,
        metadata: {
          peak_hour: Math.floor(Math.random() * 24),
          expected_duration_minutes: Math.floor(Math.random() * 120) + 30,
          factors: ['weather', 'events', 'historical_pattern']
        }
      };
      
    case 'incident_prediction':
      return {
        value: Math.random() * 0.8, // 0-80% risk
        confidence: 0.6 + Math.random() * 0.3,
        timeframe,
        camera_id: `cam-${Math.floor(Math.random() * 5) + 1}`,
        metadata: {
          incident_type: ['safety', 'security', 'equipment'][Math.floor(Math.random() * 3)],
          risk_factors: ['high_density', 'equipment_age', 'environmental'],
          recommended_actions: ['increase_monitoring', 'maintenance_check']
        }
      };
      
    case 'anomaly_detection':
      return {
        value: Math.random() * 10, // anomaly score 0-10
        confidence: 0.8 + Math.random() * 0.15,
        timeframe,
        camera_id: `cam-${Math.floor(Math.random() * 5) + 1}`,
        metadata: {
          anomaly_type: ['behavioral', 'environmental', 'technical'][Math.floor(Math.random() * 3)],
          deviation_score: Math.random() * 5,
          baseline_comparison: 'above_normal'
        }
      };
      
    default:
      return {
        value: Math.random() * 100,
        confidence: 0.5 + Math.random() * 0.4,
        timeframe,
        camera_id: null,
        metadata: {}
      };
  }
}

function generatePredictionSummary(predictions: any[]) {
  return {
    total_predictions: predictions.length,
    high_confidence: predictions.filter(p => p.confidence > 0.8).length,
    avg_confidence: predictions.reduce((acc, p) => acc + p.confidence, 0) / predictions.length,
    risk_alerts: predictions.filter(p => p.value > 0.7 && p.model_type === 'incident_prediction').length,
    crowd_alerts: predictions.filter(p => p.value > 80 && p.model_type === 'crowd_prediction').length
  };
}