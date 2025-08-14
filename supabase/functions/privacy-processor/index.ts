Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { method, url } = req;
    const requestUrl = new URL(url);
    const path = requestUrl.pathname;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Route handling
    if (method === 'POST' && path === '/process-clip') {
      return await processClip(req, supabase, corsHeaders);
    } else if (method === 'GET' && path === '/privacy-config') {
      return await getPrivacyConfig(req, supabase, corsHeaders);
    } else if (method === 'POST' && path === '/update-privacy-config') {
      return await updatePrivacyConfig(req, supabase, corsHeaders);
    } else if (method === 'POST' && path === '/cleanup-expired') {
      return await cleanupExpiredClips(req, supabase, corsHeaders);
    } else if (method === 'GET' && path === '/checksum') {
      return await calculateClipChecksum(req, supabase, corsHeaders);
    } else {
      return new Response(
        JSON.stringify({ error: 'Not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Privacy service error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processClip(req: Request, supabase: any, corsHeaders: any) {
  try {
    const { clip_id, privacy_options } = await req.json();
    
    console.log(`Processing clip ${clip_id} with privacy options:`, privacy_options);
    
    // Get clip information
    const { data: clip, error: clipError } = await supabase
      .from('edge_clips')
      .select('*')
      .eq('id', clip_id)
      .single();
      
    if (clipError || !clip) {
      throw new Error(`Clip not found: ${clipError?.message}`);
    }

    // Get organization privacy configuration
    const { data: privacyConfig } = await supabase
      .rpc('get_privacy_config', { p_org_id: clip.org_id })
      .single();

    // Apply privacy settings
    const shouldBlurFaces = privacy_options?.blur_faces ?? privacyConfig?.blur_faces_by_default ?? true;
    const shouldBlurPlates = privacy_options?.blur_plates ?? privacyConfig?.blur_plates_by_default ?? true;
    
    // Create processing job
    const { data: job, error: jobError } = await supabase
      .from('clip_processing_jobs')
      .insert({
        clip_id: clip_id,
        org_id: clip.org_id,
        job_type: 'privacy_blur',
        status: 'processing',
        input_params: {
          blur_faces: shouldBlurFaces,
          blur_plates: shouldBlurPlates,
          blur_radius: privacy_options?.blur_radius || 15
        },
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create processing job: ${jobError.message}`);
    }

    // Schedule background processing
    EdgeRuntime.waitUntil(processClipBackground(supabase, job.id, clip, {
      blur_faces: shouldBlurFaces,
      blur_plates: shouldBlurPlates,
      blur_radius: privacy_options?.blur_radius || 15
    }));

    // Update clip with privacy applied flag
    await supabase
      .from('edge_clips')
      .update({
        privacy_applied: true,
        faces_blurred: shouldBlurFaces,
        plates_blurred: shouldBlurPlates
      })
      .eq('id', clip_id);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        message: 'Privacy processing started',
        privacy_settings: {
          blur_faces: shouldBlurFaces,
          blur_plates: shouldBlurPlates
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Process clip error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function processClipBackground(supabase: any, jobId: string, clip: any, privacyOptions: any) {
  try {
    console.log(`Background processing started for job ${jobId}`);
    
    // Simulate video processing (in production, use FFmpeg or similar)
    // This would involve:
    // 1. Download clip from storage
    // 2. Extract frames
    // 3. Apply privacy filters (face/plate blur)
    // 4. Re-encode video
    // 5. Upload processed version
    // 6. Calculate checksum
    
    const processingStartTime = Date.now();
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate mock checksum
    const clipChecksum = await generateMockChecksum(clip.clip_path);
    
    const processingEndTime = Date.now();
    const processingTimeMs = processingEndTime - processingStartTime;
    
    // Update job status
    await supabase
      .from('clip_processing_jobs')
      .update({
        status: 'completed',
        output_results: {
          checksum: clipChecksum,
          processing_time_ms: processingTimeMs,
          privacy_applied: true,
          faces_blurred: privacyOptions.blur_faces,
          plates_blurred: privacyOptions.blur_plates
        },
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);

    // Update clip with checksum
    await supabase
      .from('edge_clips')
      .update({
        checksum: clipChecksum,
        privacy_applied: true,
        faces_blurred: privacyOptions.blur_faces,
        plates_blurred: privacyOptions.blur_plates
      })
      .eq('id', clip.id);

    console.log(`Background processing completed for job ${jobId}`);
  } catch (error) {
    console.error(`Background processing failed for job ${jobId}:`, error);
    
    // Update job with error status
    await supabase
      .from('clip_processing_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

async function generateMockChecksum(clipPath: string): Promise<string> {
  // In production, calculate actual SHA256 of the clip file
  const encoder = new TextEncoder();
  const data = encoder.encode(clipPath + Date.now().toString());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getPrivacyConfig(req: Request, supabase: any, corsHeaders: any) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get('org_id');
    
    if (!orgId) {
      throw new Error('Organization ID is required');
    }

    const { data: config, error } = await supabase
      .rpc('get_privacy_config', { p_org_id: orgId })
      .single();

    if (error) {
      throw new Error(`Failed to get privacy config: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ config }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get privacy config error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function updatePrivacyConfig(req: Request, supabase: any, corsHeaders: any) {
  try {
    const { 
      org_id, 
      blur_faces_by_default, 
      blur_plates_by_default, 
      auto_apply_privacy, 
      retention_days 
    } = await req.json();

    const { data, error } = await supabase
      .from('privacy_configurations')
      .upsert({
        org_id,
        blur_faces_by_default,
        blur_plates_by_default,
        auto_apply_privacy,
        retention_days
      }, {
        onConflict: 'org_id'
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update privacy config: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        config: data 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update privacy config error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function cleanupExpiredClips(req: Request, supabase: any, corsHeaders: any) {
  try {
    console.log('Starting expired clips cleanup');

    const { data: deletedCount, error } = await supabase
      .rpc('cleanup_expired_clips');

    if (error) {
      throw new Error(`Cleanup failed: ${error.message}`);
    }

    console.log(`Cleaned up ${deletedCount} expired clips`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_clips: deletedCount,
        cleanup_time: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Cleanup expired clips error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function calculateClipChecksum(req: Request, supabase: any, corsHeaders: any) {
  try {
    const url = new URL(req.url);
    const clipId = url.searchParams.get('clip_id');
    
    if (!clipId) {
      throw new Error('Clip ID is required');
    }

    // Get clip information
    const { data: clip, error: clipError } = await supabase
      .from('edge_clips')
      .select('*')
      .eq('id', clipId)
      .single();
      
    if (clipError || !clip) {
      throw new Error(`Clip not found: ${clipError?.message}`);
    }

    // Calculate checksum (mock implementation)
    const checksum = await generateMockChecksum(clip.clip_path);
    
    // Update clip with checksum
    await supabase
      .from('edge_clips')
      .update({ checksum })
      .eq('id', clipId);

    return new Response(
      JSON.stringify({
        success: true,
        clip_id: clipId,
        checksum: checksum
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Calculate checksum error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}