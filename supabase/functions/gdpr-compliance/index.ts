import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, data } = await req.json();

    switch (action) {
      case 'anonymize_data': {
        const { table_name, anonymization_rules } = data;
        
        // Create anonymization job
        const { data: job, error: jobError } = await supabase
          .from('anonymization_jobs')
          .insert({
            job_type: 'manual',
            target_table: table_name,
            anonymization_rules,
            status: 'processing'
          })
          .select()
          .single();

        if (jobError) throw jobError;

        // Execute anonymization based on rules
        const results = await executeAnonymization(supabase, table_name, anonymization_rules);

        // Update job status
        await supabase
          .from('anonymization_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            records_processed: results.processed_count
          })
          .eq('id', job.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            job_id: job.id,
            processed_count: results.processed_count 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'handle_data_request': {
        const { request_type, data_subject_id, requester_email } = data;
        
        // Log the data access request
        await supabase.rpc('log_data_access', {
          _access_type: 'export',
          _resource_type: 'data_subject_request',
          _data_subject_id: data_subject_id,
          _purpose: `GDPR/LGPD ${request_type} request`,
          _legal_basis: 'legal_obligation'
        });

        // Handle different request types
        switch (request_type) {
          case 'access': {
            const exportData = await exportPersonalData(supabase, data_subject_id);
            return new Response(
              JSON.stringify({ 
                success: true, 
                data: exportData,
                message: 'Data export completed' 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          case 'deletion': {
            const deletionResult = await deletePersonalData(supabase, data_subject_id);
            return new Response(
              JSON.stringify({ 
                success: true, 
                deleted_records: deletionResult.count,
                message: 'Data deletion completed' 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          case 'rectification': {
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: 'Rectification request logged. Manual review required.' 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        break;
      }

      case 'check_consent': {
        const { data_subject_id, consent_type } = data;
        
        const { data: consent, error } = await supabase
          .from('consent_records')
          .select('*')
          .eq('data_subject_id', data_subject_id)
          .eq('consent_type', consent_type)
          .eq('is_active', true)
          .order('given_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            has_consent: !!consent,
            consent_record: consent,
            valid_until: consent?.withdrawn_at || null
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'manage_consent': {
        const { data_subject_id, consent_type, action: consentAction, purpose } = data;
        
        if (consentAction === 'grant') {
          const { error } = await supabase
            .from('consent_records')
            .insert({
              data_subject_id,
              data_subject_type: 'person',
              consent_type,
              purpose,
              is_active: true,
              legal_basis: 'consent'
            });

          if (error) throw error;
        } else if (consentAction === 'withdraw') {
          const { error } = await supabase
            .from('consent_records')
            .update({
              withdrawn_at: new Date().toISOString(),
              is_active: false
            })
            .eq('data_subject_id', data_subject_id)
            .eq('consent_type', consent_type)
            .eq('is_active', true);

          if (error) throw error;
        }

        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Consent ${consentAction}ed successfully`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('GDPR Compliance Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeAnonymization(supabase: any, tableName: string, rules: any) {
  let processedCount = 0;
  
  try {
    // Execute anonymization based on rules
    for (const [column, method] of Object.entries(rules)) {
      if (method === 'pseudonymization') {
        // Generate pseudonymized values
        const { error } = await supabase.rpc('anonymize_column_pseudonym', {
          table_name: tableName,
          column_name: column
        });
        if (error) throw error;
        processedCount++;
      } else if (method === 'deletion') {
        // Set values to null
        const { error } = await supabase.rpc('anonymize_column_delete', {
          table_name: tableName,
          column_name: column
        });
        if (error) throw error;
        processedCount++;
      }
    }
  } catch (error) {
    console.error('Anonymization error:', error);
  }

  return { processed_count: processedCount };
}

async function exportPersonalData(supabase: any, dataSubjectId: string) {
  const exportData: any = {};

  try {
    // Export from people table
    const { data: peopleData } = await supabase
      .from('people')
      .select('*')
      .eq('id', dataSubjectId);
    
    if (peopleData?.length) {
      exportData.personal_info = peopleData[0];
    }

    // Export from events table
    const { data: eventsData } = await supabase
      .from('events')
      .select('*')
      .eq('person_id', dataSubjectId);
    
    if (eventsData?.length) {
      exportData.events = eventsData;
    }

    // Export from incidents
    const { data: incidentsData } = await supabase
      .from('antitheft_incidents')
      .select('*')
      .eq('person_id', dataSubjectId);
    
    if (incidentsData?.length) {
      exportData.incidents = incidentsData;
    }

    exportData.export_date = new Date().toISOString();
    exportData.data_subject_id = dataSubjectId;

  } catch (error) {
    console.error('Export error:', error);
  }

  return exportData;
}

async function deletePersonalData(supabase: any, dataSubjectId: string) {
  let deletedCount = 0;

  try {
    // Delete from events
    const { count: eventsCount } = await supabase
      .from('events')
      .delete({ count: 'exact' })
      .eq('person_id', dataSubjectId);
    
    deletedCount += eventsCount || 0;

    // Delete from incidents
    const { count: incidentsCount } = await supabase
      .from('antitheft_incidents')
      .delete({ count: 'exact' })
      .eq('person_id', dataSubjectId);
    
    deletedCount += incidentsCount || 0;

    // Delete from people (main record)
    const { count: peopleCount } = await supabase
      .from('people')
      .delete({ count: 'exact' })
      .eq('id', dataSubjectId);
    
    deletedCount += peopleCount || 0;

  } catch (error) {
    console.error('Deletion error:', error);
  }

  return { count: deletedCount };
}