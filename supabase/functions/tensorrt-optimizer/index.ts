import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TensorRTConfig {
  precision: 'FP32' | 'FP16' | 'INT8';
  workspace_size: number;
  batch_size: number;
  max_batch_size: number;
  optimization_level: 1 | 2 | 3 | 4 | 5;
}

interface OptimizationResult {
  job_id: string;
  model_name: string;
  status: 'completed' | 'failed';
  metrics: {
    original_fps: number;
    optimized_fps: number;
    speedup: number;
    memory_usage: number;
    accuracy_retention: number;
    inference_time_ms: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { job_id, model_name, config } = await req.json() as {
      job_id: string;
      model_name: string;
      config: TensorRTConfig;
    };

    console.log(`[tensorrt-optimizer] Starting optimization job ${job_id} for ${model_name}`);
    console.log(`[tensorrt-optimizer] Config:`, config);

    // Simulate TensorRT optimization process
    // In production, this would call actual TensorRT optimization APIs
    
    const basePerformance = getBasePerformance(model_name);
    const optimizedMetrics = calculateOptimizedMetrics(basePerformance, config);

    const result: OptimizationResult = {
      job_id,
      model_name,
      status: 'completed',
      metrics: optimizedMetrics
    };

    // Store optimization results
    await supabase
      .from('performance_metrics')
      .insert({
        service_name: 'tensorrt-optimizer',
        metric_type: 'optimization_result',
        value: optimizedMetrics.speedup,
        unit: 'speedup_ratio',
        metadata: {
          job_id,
          model: model_name,
          config,
          results: optimizedMetrics,
          timestamp: new Date().toISOString()
        }
      });

    // Log to audit
    await supabase
      .from('audit_logs')
      .insert({
        action: 'tensorrt_optimization',
        resource_type: 'model',
        resource_id: model_name,
        metadata: {
          job_id,
          config,
          results: optimizedMetrics
        }
      });

    console.log(`[tensorrt-optimizer] Optimization completed with ${optimizedMetrics.speedup.toFixed(2)}x speedup`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[tensorrt-optimizer] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        status: 'failed' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getBasePerformance(modelName: string) {
  // Base performance metrics for different models
  const baseMetrics: Record<string, { fps: number; memory_mb: number }> = {
    'yolov8n': { fps: 45, memory_mb: 512 },
    'yolov8s': { fps: 35, memory_mb: 768 },
    'yolov8m': { fps: 25, memory_mb: 1024 },
    'yolov8l': { fps: 18, memory_mb: 1536 },
    'yolov8x': { fps: 12, memory_mb: 2048 },
  };

  return baseMetrics[modelName] || { fps: 30, memory_mb: 1024 };
}

function calculateOptimizedMetrics(
  basePerformance: { fps: number; memory_mb: number },
  config: TensorRTConfig
) {
  // Calculate optimization improvements based on config
  let speedupMultiplier = 1.0;
  let memoryReduction = 0;
  let accuracyDrop = 0;

  // Precision impact
  switch (config.precision) {
    case 'INT8':
      speedupMultiplier *= 2.8;
      memoryReduction = 0.75; // 75% reduction
      accuracyDrop = 0.03; // 3% accuracy drop
      break;
    case 'FP16':
      speedupMultiplier *= 1.8;
      memoryReduction = 0.50; // 50% reduction
      accuracyDrop = 0.01; // 1% accuracy drop
      break;
    case 'FP32':
      speedupMultiplier *= 1.2;
      memoryReduction = 0;
      accuracyDrop = 0;
      break;
  }

  // Optimization level impact
  speedupMultiplier *= 1 + (config.optimization_level * 0.05);

  // Batch size impact
  if (config.batch_size > 1) {
    speedupMultiplier *= 1 + (config.batch_size * 0.1);
  }

  const optimized_fps = Math.round(basePerformance.fps * speedupMultiplier);
  const speedup = optimized_fps / basePerformance.fps;
  const memory_usage = Math.round(basePerformance.memory_mb * (1 - memoryReduction));
  const accuracy_retention = 1 - accuracyDrop;
  const inference_time_ms = Math.round(1000 / optimized_fps);

  return {
    original_fps: basePerformance.fps,
    optimized_fps,
    speedup,
    memory_usage,
    accuracy_retention,
    inference_time_ms
  };
}
