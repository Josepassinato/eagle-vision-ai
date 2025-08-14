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
      case 'check_permission': {
        const { user_id, permission_name } = data;
        
        const { data: hasPermission, error } = await supabase
          .rpc('has_permission', {
            _user_id: user_id,
            _permission_name: permission_name
          });

        if (error) throw error;

        // Log access check
        await supabase.rpc('log_data_access', {
          _access_type: 'read',
          _resource_type: 'permission_check',
          _resource_id: permission_name,
          _purpose: 'RBAC authorization',
          _legal_basis: 'legitimate_interest'
        });

        return new Response(
          JSON.stringify({ 
            has_permission: hasPermission,
            permission: permission_name,
            user_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'assign_role': {
        const { user_id, role } = data;
        
        // Check if user already has this role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', user_id)
          .eq('role', role)
          .maybeSingle();

        if (!existingRole) {
          const { error } = await supabase
            .from('user_roles')
            .insert({ user_id, role });

          if (error) throw error;
        }

        // Log audit event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'role_assigned',
            resource_type: 'user_role',
            resource_id: user_id,
            metadata: { role, assigned_by: 'system' }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Role ${role} assigned to user ${user_id}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'revoke_role': {
        const { user_id, role } = data;
        
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .eq('role', role);

        if (error) throw error;

        // Log audit event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'role_revoked',
            resource_type: 'user_role',
            resource_id: user_id,
            metadata: { role, revoked_by: 'system' }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Role ${role} revoked from user ${user_id}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_user_permissions': {
        const { user_id } = data;
        
        const { data: permissions, error } = await supabase
          .from('user_roles')
          .select(`
            role,
            role_permissions (
              rbac_permissions (
                name,
                description,
                resource_type,
                action
              )
            )
          `)
          .eq('user_id', user_id);

        if (error) throw error;

        // Flatten permissions
        const flatPermissions = permissions.flatMap(roleData => 
          roleData.role_permissions.map(rp => ({
            role: roleData.role,
            ...rp.rbac_permissions
          }))
        );

        return new Response(
          JSON.stringify({ 
            user_id,
            permissions: flatPermissions,
            roles: permissions.map(p => p.role)
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_permission': {
        const { name, description, resource_type, action, conditions } = data;
        
        const { data: permission, error } = await supabase
          .from('rbac_permissions')
          .insert({
            name,
            description,
            resource_type,
            action,
            conditions: conditions || {}
          })
          .select()
          .single();

        if (error) throw error;

        // Log audit event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'permission_created',
            resource_type: 'rbac_permission',
            resource_id: permission.id,
            metadata: { name, resource_type, action }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            permission
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'assign_permission_to_role': {
        const { role, permission_id } = data;
        
        const { error } = await supabase
          .from('role_permissions')
          .insert({
            role,
            permission_id
          });

        if (error) throw error;

        // Log audit event
        await supabase
          .from('audit_logs')
          .insert({
            action: 'permission_assigned_to_role',
            resource_type: 'role_permission',
            resource_id: `${role}-${permission_id}`,
            metadata: { role, permission_id }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            message: `Permission assigned to role ${role}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'audit_user_access': {
        const { user_id, days_back = 7 } = data;
        
        const { data: accessLogs, error } = await supabase
          .from('data_access_logs')
          .select('*')
          .eq('user_id', user_id)
          .gte('timestamp', new Date(Date.now() - days_back * 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });

        if (error) throw error;

        // Aggregate access patterns
        const accessSummary = {
          total_accesses: accessLogs.length,
          unique_resources: new Set(accessLogs.map(log => log.resource_type)).size,
          access_types: accessLogs.reduce((acc, log) => {
            acc[log.access_type] = (acc[log.access_type] || 0) + 1;
            return acc;
          }, {}),
          recent_accesses: accessLogs.slice(0, 10)
        };

        return new Response(
          JSON.stringify({ 
            user_id,
            period_days: days_back,
            summary: accessSummary,
            detailed_logs: accessLogs
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
    console.error('RBAC Manager Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});