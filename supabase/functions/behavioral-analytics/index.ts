import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BehavioralRequest {
  action: 'analyze_patterns' | 'get_behavior_insights' | 'detect_anomalies' | 'create_pattern';
  analysis_params?: {
    camera_ids?: string[];
    time_range?: string;
    pattern_types?: string[];
    confidence_threshold?: number;
  };
  pattern_data?: {
    pattern_type: string;
    pattern_name: string;
    location_zone: any;
    frequency_score: number;
    significance_score: number;
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

    const body = await req.json() as BehavioralRequest;
    const { action } = body;

    console.log(`Behavioral Analytics API called with action: ${action}`);

    switch (action) {
      case 'analyze_patterns':
        return await analyzePatterns(supabase, body);
      case 'get_behavior_insights':
        return await getBehaviorInsights(supabase, body);
      case 'detect_anomalies':
        return await detectAnomalies(supabase, body);
      case 'create_pattern':
        return await createPattern(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in behavioral-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function analyzePatterns(supabase: any, body: BehavioralRequest) {
  const { analysis_params } = body;
  const timeRange = analysis_params?.time_range || '7d';
  const patternTypes = analysis_params?.pattern_types || ['movement', 'crowd', 'dwell_time', 'interaction'];

  // Get existing patterns
  const { data: patterns, error: patternsError } = await supabase
    .from('behavior_patterns')
    .select('*')
    .in('pattern_type', patternTypes)
    .gte('last_updated', getTimeAgo(timeRange));

  if (patternsError) {
    throw new Error(`Failed to fetch patterns: ${patternsError.message}`);
  }

  // Analyze movement patterns
  const movementPatterns = await analyzeMovementPatterns(supabase, analysis_params);
  
  // Analyze crowd behavior
  const crowdPatterns = await analyzeCrowdBehavior(supabase, analysis_params);
  
  // Analyze dwell time patterns
  const dwellPatterns = await analyzeDwellTimePatterns(supabase, analysis_params);
  
  // Analyze interaction patterns
  const interactionPatterns = await analyzeInteractionPatterns(supabase, analysis_params);

  const analysisResults = {
    movement_patterns: movementPatterns,
    crowd_patterns: crowdPatterns,
    dwell_patterns: dwellPatterns,
    interaction_patterns: interactionPatterns,
    summary: generatePatternSummary(movementPatterns, crowdPatterns, dwellPatterns, interactionPatterns),
    recommendations: generateRecommendations(movementPatterns, crowdPatterns, dwellPatterns, interactionPatterns)
  };

  return new Response(
    JSON.stringify({ success: true, analysis: analysisResults }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getBehaviorInsights(supabase: any, body: BehavioralRequest) {
  const { analysis_params } = body;

  // Get recent behavior patterns
  const { data: patterns, error } = await supabase
    .from('behavior_patterns')
    .select('*')
    .order('significance_score', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to fetch behavior patterns: ${error.message}`);
  }

  const insights = {
    key_patterns: patterns.slice(0, 5),
    temporal_insights: generateTemporalInsights(patterns),
    spatial_insights: generateSpatialInsights(patterns),
    behavioral_trends: generateBehavioralTrends(patterns),
    anomaly_detection: await detectBehavioralAnomalies(patterns),
    actionable_insights: generateActionableInsights(patterns)
  };

  return new Response(
    JSON.stringify({ success: true, insights }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function detectAnomalies(supabase: any, body: BehavioralRequest) {
  const { analysis_params } = body;
  const confidenceThreshold = analysis_params?.confidence_threshold || 0.8;

  // Get baseline behavior patterns
  const { data: baselinePatterns, error } = await supabase
    .from('behavior_patterns')
    .select('*')
    .gte('significance_score', 0.5);

  if (error) {
    throw new Error(`Failed to fetch baseline patterns: ${error.message}`);
  }

  // Detect anomalies in current behavior
  const anomalies = await analyzeCurrentBehaviorForAnomalies(baselinePatterns, confidenceThreshold);

  return new Response(
    JSON.stringify({ 
      success: true, 
      anomalies: anomalies.filter(a => a.confidence >= confidenceThreshold),
      summary: {
        total_anomalies: anomalies.length,
        high_confidence: anomalies.filter(a => a.confidence > 0.9).length,
        critical_anomalies: anomalies.filter(a => a.severity === 'critical').length
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function createPattern(supabase: any, body: BehavioralRequest) {
  const { pattern_data } = body;
  
  if (!pattern_data) {
    throw new Error('Pattern data is required');
  }

  const pattern = {
    org_id: crypto.randomUUID(), // In real implementation, get from auth
    pattern_type: pattern_data.pattern_type,
    pattern_name: pattern_data.pattern_name,
    location_zone: pattern_data.location_zone,
    pattern_data: generatePatternData(pattern_data.pattern_type),
    frequency_score: pattern_data.frequency_score,
    significance_score: pattern_data.significance_score,
    camera_id: `cam-${Math.floor(Math.random() * 5) + 1}`
  };

  const { data, error } = await supabase
    .from('behavior_patterns')
    .insert(pattern)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create pattern: ${error.message}`);
  }

  return new Response(
    JSON.stringify({ success: true, pattern: data }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function analyzeMovementPatterns(supabase: any, params: any) {
  // Mock movement pattern analysis
  return [
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Main Entrance Flow",
      direction: "bidirectional",
      peak_times: ["08:00-09:00", "17:00-18:00"],
      avg_speed: 1.2, // m/s
      flow_rate: 25, // people/minute
      congestion_points: [
        { x: 150, y: 200, severity: 0.7 }
      ],
      frequency_score: 0.85,
      significance_score: 0.92
    },
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Circular Movement",
      direction: "clockwise",
      peak_times: ["12:00-14:00"],
      avg_speed: 0.8,
      flow_rate: 15,
      congestion_points: [],
      frequency_score: 0.65,
      significance_score: 0.78
    }
  ];
}

async function analyzeCrowdBehavior(supabase: any, params: any) {
  return [
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Lunch Hour Gathering",
      crowd_density: "high",
      peak_size: 45,
      formation_type: "clustered",
      duration_avg: 25, // minutes
      dispersal_pattern: "gradual",
      frequency_score: 0.9,
      significance_score: 0.88
    },
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Evening Queue Formation",
      crowd_density: "medium",
      peak_size: 20,
      formation_type: "linear",
      duration_avg: 15,
      dispersal_pattern: "sequential",
      frequency_score: 0.75,
      significance_score: 0.82
    }
  ];
}

async function analyzeDwellTimePatterns(supabase: any, params: any) {
  return [
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Information Desk Lingering",
      avg_dwell_time: 120, // seconds
      max_dwell_time: 300,
      dwell_zones: [
        { x: 100, y: 150, radius: 50, avg_time: 120 }
      ],
      time_distribution: {
        "0-30s": 0.2,
        "30-60s": 0.3,
        "60-120s": 0.35,
        "120s+": 0.15
      },
      frequency_score: 0.7,
      significance_score: 0.75
    }
  ];
}

async function analyzeInteractionPatterns(supabase: any, params: any) {
  return [
    {
      pattern_id: crypto.randomUUID(),
      pattern_name: "Social Grouping",
      interaction_type: "gathering",
      group_size_avg: 3.2,
      interaction_duration: 180, // seconds
      interaction_zones: [
        { x: 200, y: 300, radius: 75 }
      ],
      frequency_score: 0.8,
      significance_score: 0.85
    }
  ];
}

function generatePatternSummary(movement: any[], crowd: any[], dwell: any[], interaction: any[]) {
  return {
    total_patterns: movement.length + crowd.length + dwell.length + interaction.length,
    high_significance: [...movement, ...crowd, ...dwell, ...interaction]
      .filter(p => p.significance_score > 0.8).length,
    peak_activity_hours: ["08:00-09:00", "12:00-14:00", "17:00-18:00"],
    dominant_behaviors: ["movement", "gathering", "queuing"]
  };
}

function generateRecommendations(movement: any[], crowd: any[], dwell: any[], interaction: any[]) {
  return [
    {
      type: "optimization",
      priority: "high",
      message: "Consider additional signage at main entrance to reduce congestion",
      affected_patterns: ["Main Entrance Flow"]
    },
    {
      type: "safety",
      priority: "medium", 
      message: "Monitor lunch hour gatherings for capacity management",
      affected_patterns: ["Lunch Hour Gathering"]
    },
    {
      type: "efficiency",
      priority: "low",
      message: "Optimize information desk placement based on dwell patterns",
      affected_patterns: ["Information Desk Lingering"]
    }
  ];
}

function generateTemporalInsights(patterns: any[]) {
  return {
    peak_hours: {
      morning: "08:00-09:00",
      lunch: "12:00-14:00", 
      evening: "17:00-18:00"
    },
    weekly_trends: {
      busiest_day: "Tuesday",
      quietest_day: "Sunday",
      weekend_pattern: "different"
    },
    seasonal_variations: "moderate"
  };
}

function generateSpatialInsights(patterns: any[]) {
  return {
    hot_zones: [
      { zone: "main_entrance", activity_level: 0.9 },
      { zone: "central_area", activity_level: 0.7 },
      { zone: "information_desk", activity_level: 0.6 }
    ],
    flow_corridors: [
      { from: "entrance", to: "central_area", usage: 0.8 },
      { from: "central_area", to: "exit", usage: 0.75 }
    ],
    dead_zones: [
      { zone: "corner_areas", utilization: 0.1 }
    ]
  };
}

function generateBehavioralTrends(patterns: any[]) {
  return {
    movement_efficiency: "improving",
    crowd_density_trend: "stable",
    dwell_time_trend: "decreasing",
    interaction_frequency: "increasing"
  };
}

async function detectBehavioralAnomalies(patterns: any[]) {
  return [
    {
      anomaly_id: crypto.randomUUID(),
      type: "unusual_movement",
      description: "Detected reverse flow pattern in main corridor",
      confidence: 0.85,
      severity: "medium",
      detected_at: new Date().toISOString()
    },
    {
      anomaly_id: crypto.randomUUID(),
      type: "crowd_anomaly",
      description: "Unexpected gathering outside normal hours",
      confidence: 0.92,
      severity: "high",
      detected_at: new Date().toISOString()
    }
  ];
}

async function analyzeCurrentBehaviorForAnomalies(baselinePatterns: any[], confidenceThreshold: number) {
  return [
    {
      anomaly_id: crypto.randomUUID(),
      type: "speed_anomaly",
      description: "Movement speed 40% slower than baseline",
      confidence: 0.88,
      severity: "medium",
      baseline_deviation: 0.4,
      detected_at: new Date().toISOString()
    },
    {
      anomaly_id: crypto.randomUUID(),
      type: "density_anomaly", 
      description: "Crowd density exceeds normal parameters",
      confidence: 0.93,
      severity: "critical",
      baseline_deviation: 0.6,
      detected_at: new Date().toISOString()
    }
  ];
}

function generateActionableInsights(patterns: any[]) {
  return [
    {
      insight_type: "optimization",
      title: "Reduce Bottlenecks",
      description: "Main entrance shows consistent congestion during peak hours",
      recommended_action: "Add additional entry points or improve signage",
      potential_impact: "25% reduction in wait times"
    },
    {
      insight_type: "safety",
      title: "Monitor High-Density Areas",
      description: "Central area reaches capacity during lunch hours",
      recommended_action: "Implement crowd monitoring alerts",
      potential_impact: "Prevent overcrowding incidents"
    }
  ];
}

function generatePatternData(patternType: string) {
  const patternDataMap: { [key: string]: any } = {
    'movement': {
      direction_vectors: [{ x: 1, y: 0.5 }, { x: -0.8, y: 0.3 }],
      speed_distribution: { slow: 0.3, medium: 0.5, fast: 0.2 },
      path_consistency: 0.85
    },
    'crowd': {
      density_levels: { low: 0.2, medium: 0.6, high: 0.2 },
      formation_types: ['clustered', 'dispersed', 'linear'],
      growth_patterns: 'exponential'
    },
    'dwell_time': {
      time_buckets: {
        '0-30s': 0.4,
        '30-60s': 0.3,
        '60-300s': 0.25,
        '300s+': 0.05
      },
      location_preference: 'center-weighted'
    },
    'interaction': {
      group_sizes: { '1': 0.3, '2-3': 0.4, '4-6': 0.25, '7+': 0.05 },
      interaction_duration: { short: 0.5, medium: 0.3, long: 0.2 },
      interaction_types: ['conversation', 'observation', 'transaction']
    }
  };

  return patternDataMap[patternType] || {};
}

function getTimeAgo(timeRange: string): string {
  const now = new Date();
  const timeMap: { [key: string]: number } = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  const timeMs = timeMap[timeRange] || timeMap['7d'];
  return new Date(now.getTime() - timeMs).toISOString();
}