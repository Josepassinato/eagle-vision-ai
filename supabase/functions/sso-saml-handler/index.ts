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
      case 'initiate_saml_login': {
        const { provider_id, relay_state } = data;
        
        const { data: ssoConfig, error } = await supabase
          .from('sso_configurations')
          .select('*')
          .eq('id', provider_id)
          .eq('is_active', true)
          .single();

        if (error) throw error;

        // Generate SAML request (simplified for demo)
        const samlRequest = generateSAMLRequest(ssoConfig, relay_state);
        
        return new Response(
          JSON.stringify({
            sso_url: ssoConfig.sso_url,
            saml_request: samlRequest,
            relay_state: relay_state || `provider_${provider_id}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'handle_saml_response': {
        const { saml_response, relay_state } = data;
        
        // Parse and validate SAML response (simplified for demo)
        const samlData = await parseSAMLResponse(saml_response);
        
        if (!samlData.valid) {
          throw new Error('SAML response inválida');
        }

        // Extract provider from relay state
        const providerId = relay_state?.replace('provider_', '');
        
        const { data: ssoConfig, error } = await supabase
          .from('sso_configurations')
          .select('*')
          .eq('id', providerId)
          .single();

        if (error) throw error;

        // Map SAML attributes to user data
        const userData = mapSAMLAttributes(samlData.attributes, ssoConfig.attribute_mapping);
        
        // Check if user exists
        let { data: existingUser } = await supabase
          .from('enterprise_users')
          .select('*, user_id')
          .eq('external_user_id', samlData.nameId)
          .eq('sso_provider_id', providerId)
          .maybeSingle();

        let userId;
        
        if (existingUser) {
          // Update existing user
          userId = existingUser.user_id;
          
          await supabase
            .from('enterprise_users')
            .update({
              external_attributes: userData,
              last_login_at: new Date().toISOString()
            })
            .eq('id', existingUser.id);
            
        } else if (ssoConfig.auto_provision) {
          // Create new user
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: userData.email,
            email_confirm: true,
            user_metadata: {
              name: userData.name || userData.display_name,
              sso_provider: ssoConfig.provider_name
            }
          });

          if (createError) throw createError;
          
          userId = newUser.user.id;

          // Create enterprise user record
          await supabase
            .from('enterprise_users')
            .insert({
              user_id: userId,
              sso_provider_id: providerId,
              external_user_id: samlData.nameId,
              external_attributes: userData,
              last_login_at: new Date().toISOString()
            });

          // Assign default role
          await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role: ssoConfig.default_role
            });

        } else {
          throw new Error('Usuário não encontrado e autoprovisionamento está desabilitado');
        }

        // Generate session token for the user
        const { data: session, error: sessionError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: userData.email,
          options: {
            redirectTo: `${Deno.env.get('FRONTEND_URL') || 'https://app.example.com'}/admin/dashboard`
          }
        });

        if (sessionError) throw sessionError;

        return new Response(
          JSON.stringify({
            success: true,
            user_id: userId,
            session_url: session.properties?.action_link,
            provider_name: ssoConfig.provider_name
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'validate_sso_session': {
        const { user_id, provider_id } = data;
        
        const { data: enterpriseUser, error } = await supabase
          .from('enterprise_users')
          .select(`
            *,
            sso_configurations (
              provider_name,
              is_active
            )
          `)
          .eq('user_id', user_id)
          .eq('sso_provider_id', provider_id)
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({
            valid: !!enterpriseUser && enterpriseUser.sso_configurations.is_active,
            provider: enterpriseUser.sso_configurations.provider_name,
            last_login: enterpriseUser.last_login_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_sso_providers': {
        const { data: providers, error } = await supabase
          .from('sso_configurations')
          .select('id, provider_name, provider_type, is_active')
          .eq('is_active', true)
          .order('provider_name');

        if (error) throw error;

        return new Response(
          JSON.stringify({ providers }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test_sso_config': {
        const { provider_id } = data;
        
        const { data: ssoConfig, error } = await supabase
          .from('sso_configurations')
          .select('*')
          .eq('id', provider_id)
          .single();

        if (error) throw error;

        // Test SSO endpoint connectivity
        const testResult = await testSSOConnection(ssoConfig);

        return new Response(
          JSON.stringify({
            provider_name: ssoConfig.provider_name,
            provider_type: ssoConfig.provider_type,
            test_result: testResult
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_sso_stats': {
        const { data: stats, error } = await supabase
          .from('enterprise_users')
          .select(`
            id,
            last_login_at,
            sso_configurations (
              provider_name,
              provider_type
            )
          `);

        if (error) throw error;

        const summary = {
          total_sso_users: stats.length,
          recent_logins: stats.filter(s => {
            const lastLogin = new Date(s.last_login_at);
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            return lastLogin > thirtyDaysAgo;
          }).length,
          by_provider: stats.reduce((acc, stat) => {
            const provider = stat.sso_configurations?.provider_name || 'Unknown';
            acc[provider] = (acc[provider] || 0) + 1;
            return acc;
          }, {}),
          active_sessions: stats.filter(s => {
            const lastLogin = new Date(s.last_login_at);
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            return lastLogin > oneHourAgo;
          }).length
        };

        return new Response(
          JSON.stringify(summary),
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
    console.error('SSO/SAML Handler Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions for SAML handling (simplified implementations)
function generateSAMLRequest(ssoConfig: any, relayState: string): string {
  // In a real implementation, you would use a proper SAML library
  // This is a simplified example
  const requestId = `_${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  return btoa(`
    <samlp:AuthnRequest 
      xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
      xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
      ID="${requestId}"
      Version="2.0"
      IssueInstant="${timestamp}"
      Destination="${ssoConfig.sso_url}"
      AssertionConsumerServiceURL="${Deno.env.get('FRONTEND_URL')}/sso/callback">
      <saml:Issuer>${ssoConfig.entity_id || 'visao-de-aguia'}</saml:Issuer>
    </samlp:AuthnRequest>
  `);
}

async function parseSAMLResponse(samlResponse: string): Promise<any> {
  // In a real implementation, you would properly validate and parse the SAML response
  // This is a simplified example
  try {
    const decoded = atob(samlResponse);
    
    // Extract basic information (this would be much more complex in reality)
    const nameIdMatch = decoded.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
    const emailMatch = decoded.match(/email['"]\s*>\s*([^<]+)/i);
    const nameMatch = decoded.match(/name['"]\s*>\s*([^<]+)/i);

    return {
      valid: true,
      nameId: nameIdMatch?.[1] || 'unknown',
      attributes: {
        email: emailMatch?.[1] || '',
        name: nameMatch?.[1] || '',
        display_name: nameMatch?.[1] || ''
      }
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function mapSAMLAttributes(attributes: any, attributeMapping: any): any {
  const mapped: any = {};
  
  for (const [localAttr, samlAttr] of Object.entries(attributeMapping)) {
    if (attributes[samlAttr]) {
      mapped[localAttr] = attributes[samlAttr];
    }
  }

  // Ensure we have basic attributes
  return {
    email: mapped.email || attributes.email,
    name: mapped.name || attributes.name || attributes.display_name,
    display_name: mapped.display_name || attributes.display_name || attributes.name,
    ...mapped
  };
}

async function testSSOConnection(ssoConfig: any): Promise<any> {
  try {
    // Test if the SSO URL is reachable
    const response = await fetch(ssoConfig.sso_url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    return {
      success: response.ok,
      status: response.status,
      message: response.ok 
        ? `Conexão com ${ssoConfig.provider_name} bem-sucedida`
        : `Falha na conexão com ${ssoConfig.provider_name}`
    };
  } catch (error) {
    return {
      success: false,
      status: null,
      message: `Erro ao conectar com ${ssoConfig.provider_name}: ${error.message}`
    };
  }
}