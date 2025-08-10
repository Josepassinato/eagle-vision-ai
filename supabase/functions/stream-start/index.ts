import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
}

interface StartStreamRequest {
  camera_id: string;
  analytics?: string[];
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

    const { camera_id, analytics = ['peoplevision'] }: StartStreamRequest = await req.json()

    if (!camera_id) {
      return new Response(
        JSON.stringify({ error: 'Camera ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify camera exists and belongs to org
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .select('*')
      .eq('id', camera_id)
      .eq('org_id', orgId)
      .single()

    if (cameraError || !camera) {
      return new Response(
        JSON.stringify({ error: 'Camera not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create stream record
    const { data: stream, error: streamError } = await supabase
      .from('streams')
      .insert({
        org_id: orgId,
        camera_id: camera_id,
        status: 'starting',
        analytics_enabled: analytics,
        quality: 'medium',
        metadata: {
          started_at: new Date().toISOString(),
          analytics: analytics
        }
      })
      .select()
      .single()

    if (streamError) {
      console.error('Error creating stream:', streamError)
      return new Response(
        JSON.stringify({ error: 'Failed to create stream' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update camera status
    const { error: updateError } = await supabase
      .from('cameras')
      .update({ 
        online: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', camera_id)

    if (updateError) {
      console.error('Error updating camera status:', updateError)
    }

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: orgId,
        action: 'create',
        resource_type: 'stream',
        resource_id: stream.id,
        metadata: { camera_id, analytics }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    // Here you would typically trigger the actual stream processing
    // For now, we'll just update the status to active
    const { error: statusError } = await supabase
      .from('streams')
      .update({ status: 'active' })
      .eq('id', stream.id)

    if (statusError) {
      console.error('Error updating stream status:', statusError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        stream,
        message: 'Stream started successfully'
      }),
      { 
        status: 201, 
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