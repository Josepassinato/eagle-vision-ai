import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

async function validateTenantApiKey(apiKey: string, supabase: any) {
  const { data, error } = await supabase.rpc('validate_tenant_api_key', { api_key: apiKey });
  if (error || !data) {
    throw new Error('Invalid API key');
  }
  return data;
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API Key
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tenantId = await validateTenantApiKey(apiKey, supabase);
    const url = new URL(req.url);

    if (req.method === 'POST' && url.pathname.includes('/data-deletion-request')) {
      const payload = await req.json();
      const { data_subject_id, data_subject_type = 'visitor' } = payload;

      if (!data_subject_id) {
        return new Response(JSON.stringify({ error: 'data_subject_id is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Process the deletion request
      const { data: deletionResult, error: deletionError } = await supabase
        .rpc('process_data_deletion_request', {
          p_tenant_id: tenantId,
          p_data_subject_id: data_subject_id
        });

      if (deletionError) {
        throw new Error(`Failed to process deletion: ${deletionError.message}`);
      }

      // Log the LGPD compliance action
      await supabase
        .from('lgpd_compliance')
        .insert({
          tenant_id: tenantId,
          data_subject_id,
          data_subject_type,
          consent_status: 'withdrawn',
          withdrawal_date: new Date().toISOString(),
          deletion_requested: true,
          deletion_date: new Date().toISOString(),
          legal_basis: 'LGPD Article 18 - Right to deletion',
          processing_purposes: ['analytics', 'attendance_tracking']
        });

      const response = {
        success: true,
        deletion_summary: deletionResult,
        data_subject_id,
        processed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/lgpd-compliance-status')) {
      // Get LGPD compliance overview
      const { data: complianceRecords } = await supabase
        .from('lgpd_compliance')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      const { data: privacySettings } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      // Calculate compliance metrics
      const totalRecords = complianceRecords?.length || 0;
      const activeConsents = complianceRecords?.filter(r => r.consent_status === 'granted').length || 0;
      const withdrawnConsents = complianceRecords?.filter(r => r.consent_status === 'withdrawn').length || 0;
      const pendingDeletions = complianceRecords?.filter(r => r.deletion_requested && !r.deletion_completed).length || 0;
      const completedDeletions = complianceRecords?.filter(r => r.deletion_completed).length || 0;

      // Check for records approaching retention limit
      const retentionDays = privacySettings?.data_retention_days || 30;
      const warningThreshold = new Date();
      warningThreshold.setDate(warningThreshold.getDate() + 7); // 7 days before expiry

      const approachingExpiry = complianceRecords?.filter(r => 
        r.retention_until && new Date(r.retention_until) <= warningThreshold
      ).length || 0;

      const status = {
        compliance_overview: {
          total_records: totalRecords,
          active_consents: activeConsents,
          withdrawn_consents: withdrawnConsents,
          pending_deletions: pendingDeletions,
          completed_deletions: completedDeletions,
          approaching_expiry: approachingExpiry
        },
        privacy_settings: {
          privacy_mode: privacySettings?.privacy_mode || 'no_bio',
          data_retention_days: retentionDays,
          auto_deletion_enabled: privacySettings?.auto_deletion_enabled || false,
          face_blur_enabled: privacySettings?.face_blur_enabled || true,
          consent_required: privacySettings?.consent_required || true
        },
        recent_activities: complianceRecords?.slice(0, 10).map(record => ({
          data_subject_id: record.data_subject_id,
          data_subject_type: record.data_subject_type,
          consent_status: record.consent_status,
          consent_date: record.consent_date,
          withdrawal_date: record.withdrawal_date,
          deletion_requested: record.deletion_requested,
          deletion_completed: record.deletion_completed,
          retention_until: record.retention_until
        })) || [],
        compliance_checklist: {
          data_retention_policy: !!privacySettings?.data_retention_days,
          automatic_deletion: privacySettings?.auto_deletion_enabled || false,
          consent_management: privacySettings?.consent_required || false,
          privacy_signage: !!(privacySettings?.signage_config && Object.keys(privacySettings.signage_config).length > 0),
          face_blur_active: privacySettings?.face_blur_enabled || false,
          deletion_mechanism: true // API endpoint exists
        },
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(status), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST' && url.pathname.includes('/update-privacy-settings')) {
      const payload = await req.json();
      const {
        privacy_mode,
        face_blur_enabled,
        plates_blur_enabled,
        data_retention_days,
        auto_deletion_enabled,
        consent_required,
        signage_config
      } = payload;

      // Update privacy settings
      const { data: updatedSettings, error: updateError } = await supabase
        .from('privacy_settings')
        .upsert({
          tenant_id: tenantId,
          privacy_mode,
          face_blur_enabled,
          plates_blur_enabled,
          data_retention_days,
          auto_deletion_enabled,
          consent_required,
          signage_config
        }, {
          onConflict: 'tenant_id'
        })
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update privacy settings: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        updated_settings: updatedSettings,
        processing_time_ms: Date.now() - startTime
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET' && url.pathname.includes('/privacy-notice-qr')) {
      // Generate privacy notice content for QR code
      const { data: privacySettings } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .single();

      const retentionDays = privacySettings?.data_retention_days || 30;
      const privacyNotice = {
        tenant_name: tenant?.name || 'Organização',
        monitoring_notice: `Este ambiente é monitorado por sistema de visão computacional para fins de segurança e análise de presença.`,
        data_retention: `Os dados são mantidos por ${retentionDays} dias e automaticamente excluídos após este período.`,
        privacy_mode: privacySettings?.privacy_mode === 'no_bio' 
          ? 'Modo Sem Biometria: Nenhum dado biométrico é coletado ou armazenado.' 
          : 'Modo Opt-in: Dados biométricos são processados apenas para membros que consentiram.',
        face_blur: privacySettings?.face_blur_enabled 
          ? 'Rostos são automaticamente desfocados nas gravações.' 
          : 'Rostos podem ser visíveis nas gravações.',
        rights: 'Você tem direito ao acesso, correção e exclusão dos seus dados. Entre em contato conosco para exercer seus direitos.',
        contact: 'Para questões sobre privacidade, entre em contato através dos canais oficiais da organização.',
        qr_url: `https://panel.inigrai.com/privacy-policy?tenant=${tenantId}`,
        generated_at: new Date().toISOString()
      };

      return new Response(JSON.stringify(privacyNotice), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('LGPD Compliance Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});