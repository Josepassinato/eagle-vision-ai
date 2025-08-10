import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UsageSummaryRequest {
  month?: string; // Format: YYYY-MM
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
    )

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get org_id from middleware (would be set by auth middleware)
    const orgId = req.headers.get('x-org-id')
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7)

    // Parse month to get start and end dates
    const startDate = new Date(`${month}-01T00:00:00Z`)
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999)

    // Get usage events for the month
    const { data: usageEvents, error: usageError } = await supabase
      .from('usage_events')
      .select('metric_type, quantity, period_start, period_end, metadata')
      .eq('org_id', orgId)
      .gte('period_start', startDate.toISOString())
      .lte('period_end', endDate.toISOString())

    if (usageError) {
      console.error('Error fetching usage events:', usageError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch usage data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get current quotas
    const { data: quota, error: quotaError } = await supabase
      .from('quotas')
      .select('*')
      .eq('org_id', orgId)
      .single()

    if (quotaError) {
      console.error('Error fetching quota:', quotaError)
    }

    // Aggregate usage by metric type
    const usageSummary = usageEvents?.reduce((acc, event) => {
      if (!acc[event.metric_type]) {
        acc[event.metric_type] = {
          total: 0,
          unit: getMetricUnit(event.metric_type),
          events: []
        }
      }
      acc[event.metric_type].total += Number(event.quantity)
      acc[event.metric_type].events.push({
        quantity: event.quantity,
        period_start: event.period_start,
        period_end: event.period_end,
        metadata: event.metadata
      })
      return acc
    }, {} as Record<string, any>) || {}

    // Get active streams count
    const { data: activeStreams, error: streamsError } = await supabase
      .from('streams')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'active')

    if (streamsError) {
      console.error('Error fetching active streams:', streamsError)
    }

    // Calculate utilization percentages
    const utilization = quota ? {
      streams: {
        used: activeStreams?.length || 0,
        limit: quota.max_streams,
        percentage: Math.round(((activeStreams?.length || 0) / quota.max_streams) * 100)
      },
      minutes: {
        used: usageSummary.minutes?.total || 0,
        limit: quota.max_minutes_month,
        percentage: Math.round(((usageSummary.minutes?.total || 0) / quota.max_minutes_month) * 100)
      },
      storage: {
        used: usageSummary.storage_gb?.total || 0,
        limit: quota.max_storage_gb,
        percentage: Math.round(((usageSummary.storage_gb?.total || 0) / quota.max_storage_gb) * 100)
      }
    } : null

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: orgId,
        action: 'read',
        resource_type: 'usage_summary',
        metadata: { month, accessed_at: new Date().toISOString() }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    return new Response(
      JSON.stringify({ 
        month,
        usage: usageSummary,
        quota,
        utilization,
        active_streams: activeStreams?.length || 0,
        generated_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function getMetricUnit(metricType: string): string {
  switch (metricType) {
    case 'minutes': return 'min'
    case 'storage_gb': return 'GB'
    case 'analytics_calls': return 'calls'
    case 'frames_processed': return 'frames'
    default: return 'units'
  }
}