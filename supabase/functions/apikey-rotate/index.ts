import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Get auth header to verify user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's org
    const { data: orgUser, error: orgUserError } = await supabase
      .from('org_users')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single()

    if (orgUserError || !orgUser) {
      return new Response(
        JSON.stringify({ error: 'User not associated with any organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has permission to rotate API keys (admin or owner)
    if (!['admin', 'owner'].includes(orgUser.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate new API key
    const newApiKey = crypto.randomUUID() + '-' + crypto.randomUUID()

    // Get existing API key or create new one
    const { data: existingKey } = await supabase
      .from('org_api_keys')
      .select('id, name')
      .eq('org_id', orgUser.org_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingKey) {
      // Update existing key
      const { error: updateError } = await supabase
        .from('org_api_keys')
        .update({ 
          secret: newApiKey,
          last_used_at: null
        })
        .eq('id', existingKey.id)

      if (updateError) {
        console.error('Error updating API key:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to rotate API key' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else {
      // Create new API key
      const { error: createError } = await supabase
        .from('org_api_keys')
        .insert({
          org_id: orgUser.org_id,
          name: 'Default API Key',
          secret: newApiKey
        })

      if (createError) {
        console.error('Error creating API key:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create API key' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: orgUser.org_id,
        user_id: user.id,
        action: 'update',
        resource_type: 'api_key',
        resource_id: existingKey?.id || 'new',
        metadata: { action: 'rotate' }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        api_key: newApiKey,
        message: 'API key rotated successfully'
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