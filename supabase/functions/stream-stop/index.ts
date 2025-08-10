import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
}

interface StopStreamRequest {
  stream_id: string;
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

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get org_id from header
    const orgId = req.headers.get('x-org-id')
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { stream_id }: StopStreamRequest = await req.json()

    if (!stream_id) {
      return new Response(
        JSON.stringify({ error: 'Stream ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify stream exists and belongs to org
    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .select('*')
      .eq('id', stream_id)
      .eq('org_id', orgId)
      .single()

    if (streamError || !stream) {
      return new Response(
        JSON.stringify({ error: 'Stream not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate usage time
    const startTime = new Date(stream.created_at)
    const endTime = new Date()
    const durationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60))

    // Update stream status
    const { error: updateError } = await supabase
      .from('streams')
      .update({ 
        status: 'stopped',
        stopped_at: endTime.toISOString(),
        metadata: {
          ...stream.metadata,
          stopped_at: endTime.toISOString(),
          duration_minutes: durationMinutes
        }
      })
      .eq('id', stream_id)

    if (updateError) {
      console.error('Error updating stream:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to stop stream' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record usage event
    const { error: usageError } = await supabase
      .from('usage_events')
      .insert({
        org_id: orgId,
        stream_id: stream_id,
        metric_type: 'minutes',
        quantity: durationMinutes,
        period_start: startTime.toISOString(),
        period_end: endTime.toISOString(),
        metadata: {
          camera_id: stream.camera_id,
          analytics: stream.analytics_enabled
        }
      })

    if (usageError) {
      console.error('Error recording usage:', usageError)
    }

    // Update camera status if no other active streams
    const { data: otherStreams } = await supabase
      .from('streams')
      .select('id')
      .eq('camera_id', stream.camera_id)
      .eq('status', 'active')

    if (!otherStreams || otherStreams.length === 0) {
      const { error: cameraError } = await supabase
        .from('cameras')
        .update({ online: false })
        .eq('id', stream.camera_id)

      if (cameraError) {
        console.error('Error updating camera status:', cameraError)
      }
    }

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: orgId,
        action: 'update',
        resource_type: 'stream',
        resource_id: stream_id,
        metadata: { 
          action: 'stop',
          duration_minutes: durationMinutes
        }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stream: {
          id: stream_id,
          status: 'stopped',
          duration_minutes: durationMinutes
        },
        message: 'Stream stopped successfully'
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