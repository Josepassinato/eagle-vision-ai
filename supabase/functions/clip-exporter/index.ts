import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClipExportRequest {
  event_id?: string
  camera_id: string
  start_time: string
  end_time?: string
  pre_roll_seconds?: number
  post_roll_seconds?: number
  apply_privacy?: boolean
  blur_faces?: boolean
  blur_plates?: boolean
}

interface PrivacyConfig {
  blur_faces_by_default: boolean
  blur_plates_by_default: boolean
  auto_apply_privacy: boolean
  retention_days: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      const body: ClipExportRequest = await req.json()
      console.log('Clip export request:', body)

      const { camera_id, start_time, event_id } = body
      if (!camera_id || !start_time) {
        return new Response(
          JSON.stringify({ error: 'camera_id and start_time are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get organization context from request headers
      const orgId = req.headers.get('x-org-id')
      
      // Get privacy configuration for organization
      const { data: privacyConfig, error: privacyError } = await supabase
        .rpc('get_privacy_config', { p_org_id: orgId })
        .single()

      if (privacyError) {
        console.error('Error fetching privacy config:', privacyError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch privacy configuration' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const config = privacyConfig as PrivacyConfig
      console.log('Privacy config:', config)

      // Calculate clip timing with pre/post roll
      const preRollSeconds = body.pre_roll_seconds ?? 3
      const postRollSeconds = body.post_roll_seconds ?? 5
      
      const startTime = new Date(start_time)
      const clipStartTime = new Date(startTime.getTime() - preRollSeconds * 1000)
      const clipEndTime = body.end_time 
        ? new Date(body.end_time)
        : new Date(startTime.getTime() + postRollSeconds * 1000)

      // Apply privacy settings based on config and request
      const shouldApplyPrivacy = body.apply_privacy ?? config.auto_apply_privacy
      const shouldBlurFaces = body.blur_faces ?? config.blur_faces_by_default
      const shouldBlurPlates = body.blur_plates ?? config.blur_plates_by_default

      // Generate unique clip path
      const clipId = crypto.randomUUID()
      const clipPath = `clips/${camera_id}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${clipId}.mp4`

      // Calculate checksum for unique identification
      const checksumData = `${camera_id}-${start_time}-${preRollSeconds}-${postRollSeconds}`
      const encoder = new TextEncoder()
      const data = encoder.encode(checksumData)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      // Create clip record
      const { data: clipData, error: clipError } = await supabase
        .from('edge_clips')
        .insert({
          camera_id,
          start_time: clipStartTime.toISOString(),
          end_time: clipEndTime.toISOString(),
          clip_path: clipPath,
          pre_roll_seconds: preRollSeconds,
          post_roll_seconds: postRollSeconds,
          privacy_applied: shouldApplyPrivacy,
          faces_blurred: shouldBlurFaces && shouldApplyPrivacy,
          plates_blurred: shouldBlurPlates && shouldApplyPrivacy,
          retention_days: config.retention_days,
          checksum,
          upload_status: 'pending',
          org_id: orgId,
          metadata: {
            event_id,
            privacy_config: {
              blur_faces: shouldBlurFaces && shouldApplyPrivacy,
              blur_plates: shouldBlurPlates && shouldApplyPrivacy,
              auto_applied: shouldApplyPrivacy
            }
          }
        })
        .select()
        .single()

      if (clipError) {
        console.error('Error creating clip record:', clipError)
        return new Response(
          JSON.stringify({ error: 'Failed to create clip record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Create processing jobs
      const jobs = []

      // Privacy blur job (if needed)
      if (shouldApplyPrivacy) {
        jobs.push({
          clip_id: clipData.id,
          job_type: 'privacy_blur',
          org_id: orgId,
          input_params: {
            blur_faces: shouldBlurFaces,
            blur_plates: shouldBlurPlates,
            camera_id,
            start_time: clipStartTime.toISOString(),
            end_time: clipEndTime.toISOString()
          }
        })
      }

      // Checksum verification job
      jobs.push({
        clip_id: clipData.id,
        job_type: 'checksum',
        org_id: orgId,
        input_params: {
          expected_checksum: checksum,
          clip_path: clipPath
        }
      })

      // Export job
      jobs.push({
        clip_id: clipData.id,
        job_type: 'export',
        org_id: orgId,
        input_params: {
          camera_id,
          start_time: clipStartTime.toISOString(),
          end_time: clipEndTime.toISOString(),
          output_path: clipPath,
          privacy_applied: shouldApplyPrivacy
        }
      })

      if (jobs.length > 0) {
        const { error: jobsError } = await supabase
          .from('clip_processing_jobs')
          .insert(jobs)

        if (jobsError) {
          console.error('Error creating processing jobs:', jobsError)
          // Don't fail the request, but log the error
        }
      }

      console.log(`Created clip export request for camera ${camera_id}:`, {
        clipId: clipData.id,
        checksum,
        privacy: { shouldApplyPrivacy, shouldBlurFaces, shouldBlurPlates },
        timing: { preRollSeconds, postRollSeconds },
        retention: config.retention_days
      })

      return new Response(
        JSON.stringify({
          success: true,
          clip_id: clipData.id,
          clip_path: clipPath,
          checksum,
          start_time: clipStartTime.toISOString(),
          end_time: clipEndTime.toISOString(),
          privacy_applied: shouldApplyPrivacy,
          faces_blurred: shouldBlurFaces && shouldApplyPrivacy,
          plates_blurred: shouldBlurPlates && shouldApplyPrivacy,
          retention_days: config.retention_days,
          jobs_created: jobs.length
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // GET endpoint for clip status
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const clipId = url.searchParams.get('clip_id')
      
      if (!clipId) {
        return new Response(
          JSON.stringify({ error: 'clip_id parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: clipData, error: clipError } = await supabase
        .from('edge_clips')
        .select(`
          *,
          clip_processing_jobs(*)
        `)
        .eq('id', clipId)
        .single()

      if (clipError) {
        console.error('Error fetching clip:', clipError)
        return new Response(
          JSON.stringify({ error: 'Clip not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          clip: clipData,
          processing_jobs: clipData.clip_processing_jobs || []
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in clip-exporter:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})