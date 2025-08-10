import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
}

interface AddCameraRequest {
  name: string;
  stream_url: string;
  location?: string;
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

    // Get org_id from header (would be set by middleware)
    const orgId = req.headers.get('x-org-id')
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { name, stream_url, location }: AddCameraRequest = await req.json()

    if (!name || !stream_url) {
      return new Response(
        JSON.stringify({ error: 'Name and stream_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate camera ID
    const cameraId = `cam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Add camera
    const { data: camera, error: cameraError } = await supabase
      .from('cameras')
      .insert({
        id: cameraId,
        name,
        stream_url,
        org_id: orgId,
        online: false
      })
      .select()
      .single()

    if (cameraError) {
      console.error('Error adding camera:', cameraError)
      return new Response(
        JSON.stringify({ error: 'Failed to add camera' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create default camera config
    const { error: configError } = await supabase
      .from('camera_configs')
      .insert({
        camera_id: cameraId,
        person_threshold: 0.5,
        vehicle_threshold: 0.5,
        counting_lines: []
      })

    if (configError) {
      console.error('Error creating camera config:', configError)
    }

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: orgId,
        action: 'create',
        resource_type: 'camera',
        resource_id: cameraId,
        metadata: { name, stream_url, location }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        camera,
        message: 'Camera added successfully'
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