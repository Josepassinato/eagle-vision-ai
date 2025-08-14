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

    console.log(`Multi-Camera Fusion API called with action: ${action}`);

    switch (action) {
      case 'get_calibrations':
        return await getCameraCalibrations(supabase, body);
      case 'get_active_tracks':
        return await getActive3DTracks(supabase, body);
      case 'get_fusion_stats':
        return await getFusionStats(supabase, body);
      case 'trigger_calibration':
        return await triggerCalibration(supabase, body);
      case 'optimize_scene_config':
        return await optimizeSceneConfiguration(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in multi-camera-fusion function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function getCameraCalibrations(supabase: any, body: any) {
  // Mock camera calibration data
  const mockCalibrations = [
    {
      camera_id: 'cam-01',
      intrinsic_matrix: [
        [800.0, 0.0, 320.0],
        [0.0, 800.0, 240.0],
        [0.0, 0.0, 1.0]
      ],
      extrinsic_matrix: [
        [0.866, -0.5, 0.0, 2.5],
        [0.5, 0.866, 0.0, 1.5],
        [0.0, 0.0, 1.0, 2.8],
        [0.0, 0.0, 0.0, 1.0]
      ],
      distortion_coefficients: [-0.12, 0.08, -0.001, 0.002, -0.01],
      calibration_quality: 0.94
    },
    {
      camera_id: 'cam-02',
      intrinsic_matrix: [
        [810.0, 0.0, 315.0],
        [0.0, 810.0, 235.0],
        [0.0, 0.0, 1.0]
      ],
      extrinsic_matrix: [
        [-0.866, -0.5, 0.0, -2.5],
        [0.5, -0.866, 0.0, 1.5],
        [0.0, 0.0, 1.0, 2.8],
        [0.0, 0.0, 0.0, 1.0]
      ],
      distortion_coefficients: [-0.11, 0.07, -0.002, 0.001, -0.008],
      calibration_quality: 0.89
    },
    {
      camera_id: 'cam-03',
      intrinsic_matrix: [
        [795.0, 0.0, 325.0],
        [0.0, 795.0, 245.0],
        [0.0, 0.0, 1.0]
      ],
      extrinsic_matrix: [
        [0.0, 1.0, 0.0, 0.0],
        [-1.0, 0.0, 0.0, 3.0],
        [0.0, 0.0, 1.0, 2.8],
        [0.0, 0.0, 0.0, 1.0]
      ],
      distortion_coefficients: [-0.10, 0.06, -0.001, 0.003, -0.007],
      calibration_quality: 0.91
    }
  ];

  return new Response(
    JSON.stringify({ calibrations: mockCalibrations }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getActive3DTracks(supabase: any, body: any) {
  // Mock 3D tracking data
  const mockTracks = [
    {
      id: 'track-001',
      position_3d: [1.2, 2.5, 0.0],
      velocity_3d: [0.8, 0.0, 0.0],
      state: 'ACTIVE',
      associated_detections: {
        'cam-01': { bbox: [0.3, 0.2, 0.6, 0.8], confidence: 0.92 },
        'cam-02': { bbox: [0.4, 0.1, 0.7, 0.9], confidence: 0.88 }
      },
      confidence: 0.95,
      track_duration: 4500
    },
    {
      id: 'track-002',
      position_3d: [-0.8, 1.8, 0.0],
      velocity_3d: [-0.5, 0.3, 0.0],
      state: 'ACTIVE',
      associated_detections: {
        'cam-01': { bbox: [0.1, 0.3, 0.4, 0.7], confidence: 0.85 },
        'cam-03': { bbox: [0.2, 0.2, 0.5, 0.8], confidence: 0.90 }
      },
      confidence: 0.87,
      track_duration: 2300
    },
    {
      id: 'track-003',
      position_3d: [2.1, 0.5, 0.0],
      velocity_3d: [0.0, 1.2, 0.0],
      state: 'ACTIVE',
      associated_detections: {
        'cam-02': { bbox: [0.5, 0.4, 0.8, 0.9], confidence: 0.91 },
        'cam-03': { bbox: [0.3, 0.3, 0.6, 0.8], confidence: 0.89 }
      },
      confidence: 0.93,
      track_duration: 1800
    }
  ];

  return new Response(
    JSON.stringify({ tracks: mockTracks }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getFusionStats(supabase: any, body: any) {
  // Mock fusion statistics
  const mockStats = {
    cameras_active: 3,
    tracks_active: 12,
    triangulation_accuracy: 0.94,
    cross_camera_matches: 156
  };

  return new Response(
    JSON.stringify({ stats: mockStats }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function triggerCalibration(supabase: any, body: any) {
  const { camera_id } = body;
  
  console.log(`Triggering calibration for camera: ${camera_id}`);
  
  // Here we would typically:
  // 1. Start calibration procedure for the specific camera
  // 2. Collect calibration images
  // 3. Compute intrinsic and extrinsic parameters
  // 4. Update camera calibration data
  
  const calibrationJob = {
    id: crypto.randomUUID(),
    camera_id,
    status: 'in_progress',
    initiated_at: new Date().toISOString(),
    estimated_completion: new Date(Date.now() + 300000).toISOString() // 5 minutes from now
  };

  return new Response(
    JSON.stringify({ success: true, calibration_job: calibrationJob }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function optimizeSceneConfiguration(supabase: any, body: any) {
  console.log('Optimizing scene configuration...');
  
  // Here we would typically:
  // 1. Analyze current camera positions and coverage
  // 2. Identify optimal camera placements
  // 3. Suggest improvements for better triangulation
  // 4. Update scene context parameters
  
  const optimizationResult = {
    id: crypto.randomUUID(),
    optimization_score: 0.87,
    recommendations: [
      {
        camera_id: 'cam-02',
        suggestion: 'Adjust angle 15° clockwise for better coverage',
        impact: 'medium'
      },
      {
        camera_id: 'cam-03',
        suggestion: 'Move 0.5m closer to center for improved triangulation',
        impact: 'high'
      }
    ],
    estimated_improvement: 0.12,
    initiated_at: new Date().toISOString()
  };

  return new Response(
    JSON.stringify({ success: true, optimization: optimizationResult }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}