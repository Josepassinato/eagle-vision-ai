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

function generateVisitorCode(): string {
  return 'V' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
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

    if (req.method === 'POST' && url.pathname.includes('/checkin')) {
      const payload = await req.json();
      const {
        visitor_code,
        name,
        email,
        phone,
        service_id,
        camera_id,
        zone_name,
        method = 'checkin', // QR/NFC checkin
        metadata = {}
      } = payload;

      // Find or create visitor
      let visitor;
      if (visitor_code) {
        const { data: existingVisitor } = await supabase
          .from('visitors')
          .select('*')
          .eq('visitor_code', visitor_code)
          .eq('tenant_id', tenantId)
          .single();

        if (existingVisitor) {
          // Update last visit and increment count
          const { data: updatedVisitor, error: updateError } = await supabase
            .from('visitors')
            .update({
              last_visit: new Date().toISOString(),
              visit_count: existingVisitor.visit_count + 1
            })
            .eq('id', existingVisitor.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update visitor: ${updateError.message}`);
          }
          visitor = updatedVisitor;
        }
      }

      if (!visitor) {
        // Create new visitor
        const { data: newVisitor, error: createError } = await supabase
          .from('visitors')
          .insert({
            tenant_id: tenantId,
            visitor_code: visitor_code || generateVisitorCode(),
            name,
            email,
            phone,
            member_status: 'visitor',
            visit_count: 1,
            opt_in_data_processing: metadata.opt_in || false
          })
          .select()
          .single();

        if (createError) {
          throw new Error(`Failed to create visitor: ${createError.message}`);
        }
        visitor = newVisitor;
      }

      // Record attendance
      const { data: attendance, error: attendanceError } = await supabase
        .from('attendance')
        .insert({
          service_id,
          visitor_id: visitor.id,
          camera_id,
          zone_name,
          method,
          confidence: 1.0, // High confidence for manual checkin
          metadata: {
            checkin_method: method,
            ...metadata
          }
        })
        .select()
        .single();

      if (attendanceError) {
        throw new Error(`Failed to record attendance: ${attendanceError.message}`);
      }

      // Create corresponding church event
      EdgeRuntime.waitUntil(
        supabase.from('church_events').insert({
          camera_id,
          event_type: 'checkin',
          confidence: 1.0,
          metadata: {
            visitor_id: visitor.id,
            attendance_id: attendance.id,
            method
          },
          person_count: 1,
          zone_name,
          org_id: tenantId
        })
      );

      const response = {
        success: true,
        visitor: {
          id: visitor.id,
          visitor_code: visitor.visitor_code,
          name: visitor.name,
          member_status: visitor.member_status,
          visit_count: visitor.visit_count
        },
        attendance_id: attendance.id,
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'POST' && url.pathname.includes('/import')) {
      const payload = await req.json();
      const { visitors } = payload;

      if (!Array.isArray(visitors)) {
        return new Response(JSON.stringify({ error: 'visitors must be an array' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const importedVisitors = [];
      const errors = [];

      for (const visitorData of visitors) {
        try {
          const { data: visitor, error } = await supabase
            .from('visitors')
            .insert({
              tenant_id: tenantId,
              visitor_code: visitorData.visitor_code || generateVisitorCode(),
              name: visitorData.name,
              email: visitorData.email,
              phone: visitorData.phone,
              member_status: visitorData.member_status || 'visitor',
              preferences: visitorData.preferences || {},
              opt_in_data_processing: visitorData.opt_in_data_processing || false
            })
            .select()
            .single();

          if (error) {
            errors.push({
              visitor_data: visitorData,
              error: error.message
            });
          } else {
            importedVisitors.push(visitor);
          }
        } catch (err) {
          errors.push({
            visitor_data: visitorData,
            error: err.message
          });
        }
      }

      const response = {
        success: true,
        imported_count: importedVisitors.length,
        error_count: errors.length,
        imported_visitors: importedVisitors,
        errors: errors,
        processing_time_ms: Date.now() - startTime
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error',
      processing_time_ms: Date.now() - startTime
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});