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
      case 'sync_salesforce': {
        const { integration_id, sync_type = 'incremental' } = data;
        
        const { data: integration, error } = await supabase
          .from('integration_configurations')
          .select('*')
          .eq('id', integration_id)
          .eq('integration_type', 'salesforce')
          .single();

        if (error) throw error;

        // Log sync start
        const { data: syncLog } = await supabase.rpc('log_integration_sync', {
          _integration_id: integration_id,
          _sync_type: sync_type,
          _status: 'started'
        });

        try {
          const salesforceConfig = integration.configuration;
          const salesforceData = await syncSalesforceContacts(salesforceConfig);

          // Process and store the data
          const processedRecords = await processSalesforceData(supabase, salesforceData);

          // Update sync log
          await supabase
            .from('integration_sync_logs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              records_processed: processedRecords.total,
              records_created: processedRecords.created,
              records_updated: processedRecords.updated
            })
            .eq('id', syncLog);

          // Update integration status
          await supabase
            .from('integration_configurations')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'success',
              sync_error: null
            })
            .eq('id', integration_id);

          return new Response(
            JSON.stringify({
              success: true,
              sync_id: syncLog,
              records_processed: processedRecords
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (syncError) {
          // Update sync log with error
          await supabase
            .from('integration_sync_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_details: { error: syncError.message }
            })
            .eq('id', syncLog);

          // Update integration status
          await supabase
            .from('integration_configurations')
            .update({
              sync_status: 'error',
              sync_error: syncError.message
            })
            .eq('id', integration_id);

          throw syncError;
        }
      }

      case 'sync_hubspot': {
        const { integration_id, sync_type = 'incremental' } = data;
        
        const { data: integration, error } = await supabase
          .from('integration_configurations')
          .select('*')
          .eq('id', integration_id)
          .eq('integration_type', 'hubspot')
          .single();

        if (error) throw error;

        const { data: syncLog } = await supabase.rpc('log_integration_sync', {
          _integration_id: integration_id,
          _sync_type: sync_type,
          _status: 'started'
        });

        try {
          const hubspotConfig = integration.configuration;
          const hubspotData = await syncHubSpotContacts(hubspotConfig);

          const processedRecords = await processHubSpotData(supabase, hubspotData);

          await supabase
            .from('integration_sync_logs')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              records_processed: processedRecords.total,
              records_created: processedRecords.created,
              records_updated: processedRecords.updated
            })
            .eq('id', syncLog);

          await supabase
            .from('integration_configurations')
            .update({
              last_sync_at: new Date().toISOString(),
              sync_status: 'success',
              sync_error: null
            })
            .eq('id', integration_id);

          return new Response(
            JSON.stringify({
              success: true,
              sync_id: syncLog,
              records_processed: processedRecords
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );

        } catch (syncError) {
          await supabase
            .from('integration_sync_logs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              error_details: { error: syncError.message }
            })
            .eq('id', syncLog);

          await supabase
            .from('integration_configurations')
            .update({
              sync_status: 'error',
              sync_error: syncError.message
            })
            .eq('id', integration_id);

          throw syncError;
        }
      }

      case 'test_integration': {
        const { integration_id } = data;
        
        const { data: integration, error } = await supabase
          .from('integration_configurations')
          .select('*')
          .eq('id', integration_id)
          .single();

        if (error) throw error;

        let testResult;
        
        if (integration.integration_type === 'salesforce') {
          testResult = await testSalesforceConnection(integration.configuration);
        } else if (integration.integration_type === 'hubspot') {
          testResult = await testHubSpotConnection(integration.configuration);
        } else {
          throw new Error('Tipo de integração não suportado');
        }

        return new Response(
          JSON.stringify({
            integration_name: integration.name,
            integration_type: integration.integration_type,
            test_result: testResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_crm_record': {
        const { integration_id, record_type, record_data } = data;
        
        const { data: integration, error } = await supabase
          .from('integration_configurations')
          .select('*')
          .eq('id', integration_id)
          .single();

        if (error) throw error;

        let result;
        
        if (integration.integration_type === 'salesforce') {
          result = await createSalesforceRecord(integration.configuration, record_type, record_data);
        } else if (integration.integration_type === 'hubspot') {
          result = await createHubSpotRecord(integration.configuration, record_type, record_data);
        } else {
          throw new Error('Tipo de integração não suportado');
        }

        return new Response(
          JSON.stringify({
            success: true,
            record_id: result.id,
            integration_type: integration.integration_type,
            record_type
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_integration_stats': {
        const { data: integrations, error } = await supabase
          .from('integration_configurations')
          .select(`
            *,
            integration_sync_logs (
              status,
              records_processed,
              completed_at
            )
          `)
          .eq('is_active', true);

        if (error) throw error;

        const stats = integrations.map(integration => {
          const recentSyncs = integration.integration_sync_logs
            .filter(log => log.completed_at)
            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
            .slice(0, 10);

          const totalRecords = recentSyncs.reduce((sum, sync) => sum + (sync.records_processed || 0), 0);
          const successfulSyncs = recentSyncs.filter(sync => sync.status === 'completed').length;

          return {
            id: integration.id,
            name: integration.name,
            type: integration.integration_type,
            status: integration.sync_status,
            last_sync: integration.last_sync_at,
            total_records_synced: totalRecords,
            recent_sync_success_rate: recentSyncs.length > 0 
              ? (successfulSyncs / recentSyncs.length * 100).toFixed(1)
              : 0,
            recent_syncs_count: recentSyncs.length
          };
        });

        return new Response(
          JSON.stringify({
            total_integrations: integrations.length,
            active_integrations: integrations.filter(i => i.sync_status === 'success').length,
            integrations: stats
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
    console.error('CRM Integration Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Salesforce helper functions
async function testSalesforceConnection(config: any) {
  const { instance_url, access_token } = config;
  
  const response = await fetch(`${instance_url}/services/data/v58.0/sobjects/`, {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: response.ok,
    status: response.status,
    message: response.ok ? 'Conexão com Salesforce bem-sucedida' : 'Falha na conexão com Salesforce'
  };
}

async function syncSalesforceContacts(config: any) {
  const { instance_url, access_token } = config;
  
  const response = await fetch(`${instance_url}/services/data/v58.0/query/?q=SELECT Id,Name,Email,Phone FROM Contact LIMIT 100`, {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Salesforce API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.records;
}

async function createSalesforceRecord(config: any, recordType: string, recordData: any) {
  const { instance_url, access_token } = config;
  
  const response = await fetch(`${instance_url}/services/data/v58.0/sobjects/${recordType}/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(recordData)
  });

  if (!response.ok) {
    throw new Error(`Salesforce API Error: ${response.statusText}`);
  }

  return await response.json();
}

// HubSpot helper functions
async function testHubSpotConnection(config: any) {
  const { api_key } = config;
  
  const response = await fetch('https://api.hubapi.com/contacts/v1/lists/all/contacts/all', {
    headers: {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: response.ok,
    status: response.status,
    message: response.ok ? 'Conexão com HubSpot bem-sucedida' : 'Falha na conexão com HubSpot'
  };
}

async function syncHubSpotContacts(config: any) {
  const { api_key } = config;
  
  const response = await fetch('https://api.hubapi.com/contacts/v1/lists/all/contacts/all?count=100', {
    headers: {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`HubSpot API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.contacts;
}

async function createHubSpotRecord(config: any, recordType: string, recordData: any) {
  const { api_key } = config;
  
  const response = await fetch(`https://api.hubapi.com/contacts/v1/contact/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${api_key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ properties: recordData })
  });

  if (!response.ok) {
    throw new Error(`HubSpot API Error: ${response.statusText}`);
  }

  return await response.json();
}

// Data processing functions
async function processSalesforceData(supabase: any, salesforceData: any[]) {
  let created = 0;
  let updated = 0;

  for (const record of salesforceData) {
    // Example: sync contact data to people table
    const { data: existingPerson } = await supabase
      .from('people')
      .select('id')
      .eq('external_id', record.Id)
      .maybeSingle();

    if (existingPerson) {
      await supabase
        .from('people')
        .update({
          name: record.Name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPerson.id);
      updated++;
    } else {
      await supabase
        .from('people')
        .insert({
          name: record.Name,
          external_id: record.Id,
          external_source: 'salesforce'
        });
      created++;
    }
  }

  return { total: salesforceData.length, created, updated };
}

async function processHubSpotData(supabase: any, hubspotData: any[]) {
  let created = 0;
  let updated = 0;

  for (const record of hubspotData) {
    const { data: existingPerson } = await supabase
      .from('people')
      .select('id')
      .eq('external_id', record.vid.toString())
      .maybeSingle();

    const name = record.properties?.firstname?.value + ' ' + record.properties?.lastname?.value;

    if (existingPerson) {
      await supabase
        .from('people')
        .update({
          name: name,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingPerson.id);
      updated++;
    } else {
      await supabase
        .from('people')
        .insert({
          name: name,
          external_id: record.vid.toString(),
          external_source: 'hubspot'
        });
      created++;
    }
  }

  return { total: hubspotData.length, created, updated };
}