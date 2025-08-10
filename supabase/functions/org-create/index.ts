import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateOrgRequest {
  name: string;
  plan?: string;
  user_id: string;
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

    const { name, plan = 'starter', user_id }: CreateOrgRequest = await req.json()

    if (!name || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Name and user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('orgs')
      .insert({ name, plan })
      .select()
      .single()

    if (orgError) {
      console.error('Error creating org:', orgError)
      return new Response(
        JSON.stringify({ error: 'Failed to create organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Add user as owner
    const { error: userOrgError } = await supabase
      .from('org_users')
      .insert({
        org_id: org.id,
        user_id: user_id,
        role: 'owner'
      })

    if (userOrgError) {
      console.error('Error adding user to org:', userOrgError)
      return new Response(
        JSON.stringify({ error: 'Failed to add user to organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create default quota
    const { error: quotaError } = await supabase
      .from('quotas')
      .insert({
        org_id: org.id,
        max_streams: plan === 'enterprise' ? 50 : plan === 'professional' ? 10 : 2,
        max_minutes_month: plan === 'enterprise' ? 50000 : plan === 'professional' ? 10000 : 2000,
        max_storage_gb: plan === 'enterprise' ? 500 : plan === 'professional' ? 100 : 10
      })

    if (quotaError) {
      console.error('Error creating quota:', quotaError)
    }

    // Create default privacy settings
    const { error: privacyError } = await supabase
      .from('privacy_settings')
      .insert({
        org_id: org.id,
        compliance_framework: 'LGPD',
        face_blur_enabled: false,
        license_plate_blur_enabled: false,
        anonymization_mode: 'none',
        data_minimization: true,
        consent_required: true
      })

    if (privacyError) {
      console.error('Error creating privacy settings:', privacyError)
    }

    // Create default retention policies
    const retentionPolicies = [
      { org_id: org.id, data_type: 'clips', retention_days: 30, legal_basis: 'legitimate_interest' },
      { org_id: org.id, data_type: 'metrics', retention_days: 365, legal_basis: 'legitimate_interest' },
      { org_id: org.id, data_type: 'events', retention_days: 90, legal_basis: 'legitimate_interest' },
      { org_id: org.id, data_type: 'logs', retention_days: 30, legal_basis: 'legitimate_interest' }
    ]

    const { error: retentionError } = await supabase
      .from('retention_policies')
      .insert(retentionPolicies)

    if (retentionError) {
      console.error('Error creating retention policies:', retentionError)
    }

    // Log audit event
    const { error: auditError } = await supabase
      .from('audit_logs')
      .insert({
        org_id: org.id,
        user_id: user_id,
        action: 'create',
        resource_type: 'organization',
        resource_id: org.id,
        metadata: { name, plan }
      })

    if (auditError) {
      console.error('Error logging audit event:', auditError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        org: org,
        message: 'Organization created successfully'
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