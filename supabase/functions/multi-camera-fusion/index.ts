import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

    console.log(`[multi-camera-fusion] Action: ${action}`);

    switch (action) {
      case 'get_calibrations': {
        // Mock camera calibrations
        const calibrations = [
          {
            camera_id: 'cam_001',
            intrinsic_matrix: [[800, 0, 640], [0, 800, 360], [0, 0, 1]],
            extrinsic_matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 5], [0, 0, 0, 1]],
            distortion_coefficients: [0.01, -0.02, 0, 0, 0],
            calibration_quality: 0.92
          },
          {
            camera_id: 'cam_002',
            intrinsic_matrix: [[790, 0, 645], [0, 795, 365], [0, 0, 1]],
            extrinsic_matrix: [[0.87, 0, 0.5, 3], [0, 1, 0, 0], [-0.5, 0, 0.87, 4], [0, 0, 0, 1]],
            distortion_coefficients: [0.015, -0.025, 0, 0, 0],
            calibration_quality: 0.88
          }
        ];

        return new Response(
          JSON.stringify({ calibrations }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_active_tracks': {
        // Mock 3D tracks
        const tracks = [
          {
            id: 'track_001',
            position_3d: [2.5, 0.0, 1.7],
            velocity_3d: [0.8, 0, 0],
            state: 'ACTIVE',
            associated_detections: { cam_001: {}, cam_002: {} },
            confidence: 0.95,
            track_duration: 5200
          },
          {
            id: 'track_002',
            position_3d: [1.2, 0.0, 1.6],
            velocity_3d: [-0.5, 0, 0.2],
            state: 'ACTIVE',
            associated_detections: { cam_001: {}, cam_003: {} },
            confidence: 0.87,
            track_duration: 3800
          }
        ];

        return new Response(
          JSON.stringify({ tracks }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_fusion_stats': {
        const { time_range_hours } = params as { time_range_hours?: number };

        // Fetch recent metrics
        const cutoffTime = new Date(
          Date.now() - (time_range_hours || 24) * 60 * 60 * 1000
        ).toISOString();

        const { data: metrics } = await supabase
          .from('performance_metrics')
          .select('*')
          .eq('service_name', 'multi-camera-fusion')
          .gte('timestamp', cutoffTime);

        const stats = {
          cameras_active: 8,
          tracks_active: (metrics || []).filter((m: any) => 
            m.metric_type === 'fused_track' && m.value > 0.7
          ).length,
          triangulation_accuracy: 0.92,
          cross_camera_matches: (metrics || []).length,
          total_fused_tracks: (metrics || []).filter((m: any) => 
            m.metric_type === 'fused_track'
          ).length,
          avg_confidence: (metrics || []).reduce((sum: number, m: any) => 
            sum + (m.value || 0), 0) / ((metrics || []).length || 1),
          avg_cameras_per_track: 2.4,
          total_trajectory_points: (metrics || []).reduce((sum: number, m: any) => 
            sum + ((m.metadata as any)?.trajectory_points || 0), 0)
        };

        return new Response(
          JSON.stringify({ stats }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'trigger_calibration': {
        const { camera_id } = params as { camera_id: string };

        console.log(`[multi-camera-fusion] Triggering calibration for ${camera_id}`);

        // Log calibration event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'camera_calibration',
            resource_type: 'camera',
            resource_id: camera_id,
            metadata: {
              timestamp: new Date().toISOString(),
              triggered_by: 'manual'
            }
          });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'optimize_scene_config': {
        console.log(`[multi-camera-fusion] Optimizing scene configuration`);

        // Log optimization event
        await supabase
          .from('performance_metrics')
          .insert({
            service_name: 'multi-camera-fusion',
            metric_type: 'scene_optimization',
            value: 1.0,
            unit: 'event',
            metadata: {
              timestamp: new Date().toISOString(),
              optimization_type: 'full_scene'
            }
          });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'correlate_events': {
        const { camera_ids, time_range_minutes } = params as {
          camera_ids: string[];
          time_range_minutes: number;
        };

        const cutoffTime = new Date(
          Date.now() - time_range_minutes * 60 * 1000
        ).toISOString();

        // Fetch recent events
        const { data: events } = await supabase
          .from('events')
          .select('*')
          .in('camera_id', camera_ids)
          .gte('ts', cutoffTime)
          .order('ts', { ascending: false });

        // Group events by person and time proximity
        const correlatedEvents: any[] = [];
        const processedEvents = new Set();

        for (const event of events || []) {
          if (processedEvents.has(event.id)) continue;

          const group = {
            timestamp: event.ts,
            cameras: [event.camera_id],
            events: [event],
            person_id: event.person_id
          };

          processedEvents.add(event.id);

          // Find related events (same person, within 30s)
          for (const otherEvent of events || []) {
            if (processedEvents.has(otherEvent.id)) continue;

            const timeDiff = Math.abs(
              new Date(event.ts).getTime() - new Date(otherEvent.ts).getTime()
            ) / 1000;

            if (timeDiff <= 30 && event.person_id === otherEvent.person_id) {
              group.cameras.push(otherEvent.camera_id);
              group.events.push(otherEvent);
              processedEvents.add(otherEvent.id);
            }
          }

          if (group.cameras.length > 1) {
            correlatedEvents.push(group);
          }
        }

        return new Response(
          JSON.stringify({ correlated_events: correlatedEvents }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error: any) {
    console.error('[multi-camera-fusion] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
