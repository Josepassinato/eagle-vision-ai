import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HeatMapRequest {
  action: 'generate_heat_map' | 'analyze_flow' | 'get_zone_analytics' | 'create_heat_data';
  analytics_params?: {
    camera_ids?: string[];
    time_range?: string;
    resolution?: number;
    data_type?: 'movement' | 'dwell' | 'interaction';
  };
  zone_params?: {
    zone_coordinates: { x: number; y: number; width: number; height: number };
    camera_id: string;
  };
  heat_data?: {
    camera_id: string;
    zones: Array<{
      coordinates: { x: number; y: number; width: number; height: number };
      intensity: number;
      movement_count: number;
      dwell_time_avg: number;
    }>;
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

    const body = await req.json() as HeatMapRequest;
    const { action } = body;

    console.log(`Heat Map Analytics API called with action: ${action}`);

    switch (action) {
      case 'generate_heat_map':
        return await generateHeatMap(supabase, body);
      case 'analyze_flow':
        return await analyzeFlow(supabase, body);
      case 'get_zone_analytics':
        return await getZoneAnalytics(supabase, body);
      case 'create_heat_data':
        return await createHeatData(supabase, body);
      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in heat-map-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function generateHeatMap(supabase: any, body: HeatMapRequest) {
  const { analytics_params } = body;
  const timeRange = analytics_params?.time_range || '24h';
  const resolution = analytics_params?.resolution || 20; // 20x20 grid
  const dataType = analytics_params?.data_type || 'movement';
  const cameraIds = analytics_params?.camera_ids || ['cam-1', 'cam-2', 'cam-3'];

  // Get heat map data from database
  const timeAgo = getTimeAgo(timeRange);
  const { data: heatData, error } = await supabase
    .from('heat_map_data')
    .select('*')
    .gte('time_bucket', timeAgo)
    .eq('data_type', dataType)
    .in('camera_id', cameraIds);

  if (error) {
    throw new Error(`Failed to fetch heat map data: ${error.message}`);
  }

  // Generate heat map grids for each camera
  const heatMaps = await Promise.all(
    cameraIds.map(async (cameraId) => {
      const cameraData = heatData.filter(d => d.camera_id === cameraId);
      const grid = generateHeatMapGrid(cameraData, resolution);
      
      return {
        camera_id: cameraId,
        resolution,
        data_type: dataType,
        time_range: timeRange,
        grid,
        statistics: calculateHeatMapStatistics(grid),
        hot_spots: identifyHotSpots(grid),
        intensity_distribution: calculateIntensityDistribution(grid)
      };
    })
  );

  // Generate aggregate heat map
  const aggregateHeatMap = generateAggregateHeatMap(heatMaps);

  return new Response(
    JSON.stringify({ 
      success: true, 
      heat_maps: heatMaps,
      aggregate: aggregateHeatMap,
      metadata: {
        generated_at: new Date().toISOString(),
        data_points: heatData.length,
        coverage_period: timeRange
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function analyzeFlow(supabase: any, body: HeatMapRequest) {
  const { analytics_params } = body;
  const timeRange = analytics_params?.time_range || '24h';
  const cameraIds = analytics_params?.camera_ids || ['cam-1', 'cam-2', 'cam-3'];

  // Get flow analysis data
  const timeAgo = getTimeAgo(timeRange);
  const { data: flowData, error } = await supabase
    .from('flow_analysis')
    .select('*')
    .gte('time_bucket', timeAgo)
    .in('camera_id', cameraIds);

  if (error) {
    throw new Error(`Failed to fetch flow data: ${error.message}`);
  }

  // Analyze flow patterns for each camera
  const flowAnalysis = await Promise.all(
    cameraIds.map(async (cameraId) => {
      const cameraFlowData = flowData.filter(d => d.camera_id === cameraId);
      
      return {
        camera_id: cameraId,
        flow_vectors: generateFlowVectors(cameraFlowData),
        dominant_directions: calculateDominantDirections(cameraFlowData),
        bottlenecks: identifyBottlenecks(cameraFlowData),
        flow_efficiency: calculateFlowEfficiency(cameraFlowData),
        peak_flow_times: identifyPeakFlowTimes(cameraFlowData),
        flow_distribution: calculateFlowDistribution(cameraFlowData)
      };
    })
  );

  // Generate system-wide flow insights
  const systemFlowInsights = generateSystemFlowInsights(flowAnalysis);

  return new Response(
    JSON.stringify({
      success: true,
      flow_analysis: flowAnalysis,
      system_insights: systemFlowInsights,
      recommendations: generateFlowRecommendations(flowAnalysis)
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getZoneAnalytics(supabase: any, body: HeatMapRequest) {
  const { zone_params } = body;
  
  if (!zone_params) {
    throw new Error('Zone parameters are required');
  }

  const { camera_id, zone_coordinates } = zone_params;

  // Get zone-specific data
  const { data: zoneData, error } = await supabase
    .from('heat_map_data')
    .select('*')
    .eq('camera_id', camera_id)
    .gte('time_bucket', getTimeAgo('7d')); // Last 7 days

  if (error) {
    throw new Error(`Failed to fetch zone data: ${error.message}`);
  }

  // Filter data for specific zone
  const zoneSpecificData = filterDataForZone(zoneData, zone_coordinates);

  const analytics = {
    zone_id: `${camera_id}_zone_${Date.now()}`,
    coordinates: zone_coordinates,
    camera_id,
    statistics: {
      total_visits: zoneSpecificData.reduce((sum: number, d: any) => sum + d.movement_count, 0),
      avg_dwell_time: zoneSpecificData.reduce((sum: number, d: any) => sum + d.dwell_time_avg, 0) / zoneSpecificData.length,
      peak_intensity: Math.max(...zoneSpecificData.map((d: any) => d.heat_intensity)),
      utilization_rate: calculateUtilizationRate(zoneSpecificData)
    },
    temporal_patterns: analyzeTemporalPatterns(zoneSpecificData),
    behavior_patterns: analyzeZoneBehaviorPatterns(zoneSpecificData),
    recommendations: generateZoneRecommendations(zoneSpecificData)
  };

  return new Response(
    JSON.stringify({ success: true, zone_analytics: analytics }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function createHeatData(supabase: any, body: HeatMapRequest) {
  const { heat_data } = body;
  
  if (!heat_data) {
    throw new Error('Heat data is required');
  }

  const currentTimeBucket = new Date();
  currentTimeBucket.setMinutes(0, 0, 0); // Round to hour

  // Insert heat map data for each zone
  const insertPromises = heat_data.zones.map(zone => 
    supabase
      .from('heat_map_data')
      .insert({
        org_id: crypto.randomUUID(), // In real implementation, get from auth
        camera_id: heat_data.camera_id,
        zone_coordinates: zone.coordinates,
        heat_intensity: zone.intensity,
        movement_count: zone.movement_count,
        dwell_time_avg: zone.dwell_time_avg,
        time_bucket: currentTimeBucket.toISOString(),
        peak_hour: currentTimeBucket.getHours()
      })
  );

  const results = await Promise.all(insertPromises);
  
  // Check for errors
  const errors = results.filter(result => result.error);
  if (errors.length > 0) {
    throw new Error(`Failed to insert heat data: ${errors[0].error.message}`);
  }

  return new Response(
    JSON.stringify({ 
      success: true, 
      inserted_zones: heat_data.zones.length,
      time_bucket: currentTimeBucket.toISOString()
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function generateHeatMapGrid(data: any[], resolution: number) {
  const grid = Array(resolution).fill(null).map(() => Array(resolution).fill(0));
  
  // Distribute data points across grid
  data.forEach(point => {
    const coords = point.zone_coordinates;
    const gridX = Math.floor((coords.x / 1920) * resolution); // Assuming 1920px width
    const gridY = Math.floor((coords.y / 1080) * resolution); // Assuming 1080px height
    
    if (gridX >= 0 && gridX < resolution && gridY >= 0 && gridY < resolution) {
      grid[gridY][gridX] += point.heat_intensity;
    }
  });

  // Normalize grid values
  const maxValue = Math.max(...grid.flat());
  if (maxValue > 0) {
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        grid[y][x] = grid[y][x] / maxValue;
      }
    }
  }

  return grid;
}

function calculateHeatMapStatistics(grid: number[][]) {
  const flatGrid = grid.flat();
  const nonZeroValues = flatGrid.filter(value => value > 0);
  
  return {
    max_intensity: Math.max(...flatGrid),
    avg_intensity: nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length || 0,
    coverage_percentage: (nonZeroValues.length / flatGrid.length) * 100,
    intensity_variance: calculateVariance(nonZeroValues)
  };
}

function identifyHotSpots(grid: number[][], threshold: number = 0.7) {
  const hotSpots = [];
  
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] > threshold) {
        hotSpots.push({
          x,
          y,
          intensity: grid[y][x],
          relative_position: {
            x_percent: (x / grid[y].length) * 100,
            y_percent: (y / grid.length) * 100
          }
        });
      }
    }
  }
  
  return hotSpots.sort((a, b) => b.intensity - a.intensity);
}

function calculateIntensityDistribution(grid: number[][]) {
  const flatGrid = grid.flat();
  const distribution = { low: 0, medium: 0, high: 0 };
  
  flatGrid.forEach(value => {
    if (value < 0.3) distribution.low++;
    else if (value < 0.7) distribution.medium++;
    else distribution.high++;
  });
  
  const total = flatGrid.length;
  return {
    low: distribution.low / total,
    medium: distribution.medium / total,
    high: distribution.high / total
  };
}

function generateAggregateHeatMap(heatMaps: any[]) {
  if (heatMaps.length === 0) return null;
  
  const resolution = heatMaps[0].resolution;
  const aggregateGrid = Array(resolution).fill(null).map(() => Array(resolution).fill(0));
  
  // Average all heat maps
  heatMaps.forEach(heatMap => {
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        aggregateGrid[y][x] += heatMap.grid[y][x];
      }
    }
  });
  
  // Normalize by number of cameras
  for (let y = 0; y < resolution; y++) {
    for (let x = 0; x < resolution; x++) {
      aggregateGrid[y][x] /= heatMaps.length;
    }
  }
  
  return {
    grid: aggregateGrid,
    statistics: calculateHeatMapStatistics(aggregateGrid),
    hot_spots: identifyHotSpots(aggregateGrid),
    camera_count: heatMaps.length
  };
}

function generateFlowVectors(flowData: any[]) {
  return flowData.map(flow => ({
    source: flow.source_zone,
    destination: flow.destination_zone,
    magnitude: flow.flow_count,
    direction: flow.flow_direction,
    transit_time: flow.avg_transit_time
  }));
}

function calculateDominantDirections(flowData: any[]) {
  const directions: { [key: string]: number } = {};
  
  flowData.forEach(flow => {
    const dir = flow.flow_direction || 'unknown';
    directions[dir] = (directions[dir] || 0) + flow.flow_count;
  });
  
  return Object.entries(directions)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([direction, count]) => ({ direction, count }));
}

function identifyBottlenecks(flowData: any[]) {
  // Identify zones with high flow concentration and low efficiency
  const bottlenecks = flowData
    .filter(flow => flow.avg_transit_time > 30) // Slower than 30 seconds
    .sort((a, b) => b.flow_count - a.flow_count)
    .slice(0, 3)
    .map(flow => ({
      location: flow.source_zone,
      severity: calculateBottleneckSeverity(flow),
      flow_count: flow.flow_count,
      avg_delay: flow.avg_transit_time
    }));
    
  return bottlenecks;
}

function calculateFlowEfficiency(flowData: any[]) {
  if (flowData.length === 0) return 0;
  
  const avgTransitTime = flowData.reduce((sum, flow) => sum + (flow.avg_transit_time || 0), 0) / flowData.length;
  const idealTransitTime = 15; // Ideal baseline in seconds
  
  return Math.max(0, 1 - (avgTransitTime - idealTransitTime) / idealTransitTime);
}

function identifyPeakFlowTimes(flowData: any[]) {
  const hourlyFlow: { [key: number]: number } = {};
  
  flowData.forEach(flow => {
    const hour = new Date(flow.peak_flow_time || flow.time_bucket).getHours();
    hourlyFlow[hour] = (hourlyFlow[hour] || 0) + flow.flow_count;
  });
  
  return Object.entries(hourlyFlow)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([hour, count]) => ({ hour: parseInt(hour), flow_count: count }));
}

function calculateFlowDistribution(flowData: any[]) {
  const totalFlow = flowData.reduce((sum, flow) => sum + flow.flow_count, 0);
  
  return {
    total_flow: totalFlow,
    avg_flow_per_zone: totalFlow / flowData.length,
    flow_variance: calculateVariance(flowData.map(f => f.flow_count)),
    distribution_score: calculateDistributionScore(flowData)
  };
}

function generateSystemFlowInsights(flowAnalysis: any[]) {
  return {
    overall_efficiency: flowAnalysis.reduce((sum, analysis) => sum + analysis.flow_efficiency, 0) / flowAnalysis.length,
    system_bottlenecks: flowAnalysis.flatMap(analysis => analysis.bottlenecks).slice(0, 5),
    cross_camera_flows: identifyCrossCameraFlows(flowAnalysis),
    load_balance: calculateSystemLoadBalance(flowAnalysis)
  };
}

function generateFlowRecommendations(flowAnalysis: any[]) {
  const recommendations = [];
  
  flowAnalysis.forEach(analysis => {
    if (analysis.flow_efficiency < 0.7) {
      recommendations.push({
        type: 'efficiency',
        camera_id: analysis.camera_id,
        priority: 'high',
        message: 'Flow efficiency below optimal threshold',
        suggested_actions: ['Review signage', 'Optimize layout', 'Monitor congestion points']
      });
    }
    
    if (analysis.bottlenecks.length > 2) {
      recommendations.push({
        type: 'bottleneck',
        camera_id: analysis.camera_id,
        priority: 'medium',
        message: 'Multiple bottlenecks detected',
        suggested_actions: ['Redesign traffic flow', 'Add alternative routes']
      });
    }
  });
  
  return recommendations;
}

function filterDataForZone(data: any[], zoneCoordinates: any) {
  return data.filter(point => {
    const coords = point.zone_coordinates;
    return coords.x >= zoneCoordinates.x &&
           coords.x <= zoneCoordinates.x + zoneCoordinates.width &&
           coords.y >= zoneCoordinates.y &&
           coords.y <= zoneCoordinates.y + zoneCoordinates.height;
  });
}

function calculateUtilizationRate(zoneData: any[]) {
  if (zoneData.length === 0) return 0;
  
  const avgIntensity = zoneData.reduce((sum, d) => sum + d.heat_intensity, 0) / zoneData.length;
  return Math.min(1, avgIntensity * 1.2); // Cap at 100%
}

function analyzeTemporalPatterns(zoneData: any[]) {
  const hourlyData: { [key: number]: number[] } = {};
  
  zoneData.forEach(point => {
    const hour = point.peak_hour || new Date(point.time_bucket).getHours();
    if (!hourlyData[hour]) hourlyData[hour] = [];
    hourlyData[hour].push(point.heat_intensity);
  });
  
  const hourlyAverages = Object.entries(hourlyData).map(([hour, intensities]) => ({
    hour: parseInt(hour),
    avg_intensity: intensities.reduce((a, b) => a + b, 0) / intensities.length
  }));
  
  return {
    hourly_patterns: hourlyAverages,
    peak_hour: hourlyAverages.sort((a, b) => b.avg_intensity - a.avg_intensity)[0]?.hour,
    low_activity_hours: hourlyAverages.filter(h => h.avg_intensity < 0.3).map(h => h.hour)
  };
}

function analyzeZoneBehaviorPatterns(zoneData: any[]) {
  return {
    avg_dwell_time: zoneData.reduce((sum, d) => sum + (d.dwell_time_avg || 0), 0) / zoneData.length,
    visit_frequency: zoneData.reduce((sum, d) => sum + d.movement_count, 0),
    usage_consistency: calculateVariance(zoneData.map(d => d.heat_intensity)),
    behavior_type: classifyZoneBehavior(zoneData)
  };
}

function generateZoneRecommendations(zoneData: any[]) {
  const recommendations = [];
  const avgIntensity = zoneData.reduce((sum, d) => sum + d.heat_intensity, 0) / zoneData.length;
  const avgDwellTime = zoneData.reduce((sum, d) => sum + (d.dwell_time_avg || 0), 0) / zoneData.length;
  
  if (avgIntensity > 0.8) {
    recommendations.push({
      type: 'capacity',
      message: 'High utilization zone - consider capacity management',
      priority: 'high'
    });
  }
  
  if (avgDwellTime > 300) { // 5 minutes
    recommendations.push({
      type: 'engagement',
      message: 'Long dwell times detected - optimize zone layout',
      priority: 'medium'
    });
  }
  
  if (avgIntensity < 0.2) {
    recommendations.push({
      type: 'utilization',
      message: 'Underutilized zone - consider repurposing',
      priority: 'low'
    });
  }
  
  return recommendations;
}

// Helper functions
function calculateVariance(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return variance;
}

function calculateBottleneckSeverity(flow: any) {
  const timeScore = Math.min(1, flow.avg_transit_time / 60); // Normalize to 1 minute
  const volumeScore = Math.min(1, flow.flow_count / 100); // Normalize to 100 people
  return (timeScore + volumeScore) / 2;
}

function calculateDistributionScore(flowData: any[]) {
  const flowCounts = flowData.map(f => f.flow_count);
  const variance = calculateVariance(flowCounts);
  const mean = flowCounts.reduce((a, b) => a + b, 0) / flowCounts.length;
  return variance / (mean || 1); // Lower is better distribution
}

function identifyCrossCameraFlows(flowAnalysis: any[]) {
  // Mock implementation - in reality, would analyze flows between different camera zones
  return [
    {
      from_camera: 'cam-1',
      to_camera: 'cam-2',
      flow_count: 25,
      avg_transit_time: 45
    },
    {
      from_camera: 'cam-2', 
      to_camera: 'cam-3',
      flow_count: 18,
      avg_transit_time: 30
    }
  ];
}

function calculateSystemLoadBalance(flowAnalysis: any[]) {
  const totalFlows = flowAnalysis.map(analysis => 
    analysis.flow_distribution.total_flow
  );
  
  return calculateVariance(totalFlows) / (totalFlows.reduce((a, b) => a + b, 0) / totalFlows.length);
}

function classifyZoneBehavior(zoneData: any[]) {
  const avgDwellTime = zoneData.reduce((sum, d) => sum + (d.dwell_time_avg || 0), 0) / zoneData.length;
  const avgIntensity = zoneData.reduce((sum, d) => sum + d.heat_intensity, 0) / zoneData.length;
  
  if (avgDwellTime > 180 && avgIntensity > 0.6) return 'gathering_point';
  if (avgDwellTime < 60 && avgIntensity > 0.7) return 'transit_zone';
  if (avgDwellTime > 300) return 'destination_zone';
  if (avgIntensity < 0.3) return 'low_activity';
  return 'mixed_usage';
}

function getTimeAgo(timeRange: string): string {
  const now = new Date();
  const timeMap: { [key: string]: number } = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const timeMs = timeMap[timeRange] || timeMap['24h'];
  return new Date(now.getTime() - timeMs).toISOString();
}