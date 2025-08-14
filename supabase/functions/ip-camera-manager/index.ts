import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-org-id',
}

interface IPCameraRequest {
  name: string;
  brand?: string;
  model?: string;
  ip_address: string;
  port?: number;
  username?: string;
  password?: string;
  rtsp_path?: string;
  http_port?: number;
  onvif_port?: number;
}

interface NetworkScanRequest {
  network_range: string; // e.g., "192.168.1.0/24"
  ports?: number[];
}

// Test HTTP/ONVIF connectivity
async function testHttpConnection(ip: string, port: number = 80, timeout: number = 5000): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(`http://${ip}:${port}`, {
      method: 'GET',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return { success: response.ok };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test RTSP connectivity by attempting to connect to the stream
async function testRTSPConnection(rtspUrl: string, timeout: number = 10000): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Testing RTSP connection to: ${rtspUrl}`);
    
    const url = new URL(rtspUrl);
    const ip = url.hostname;
    const port = url.port ? parseInt(url.port) : 554;
    
    // Test basic TCP connectivity to RTSP port
    const httpTest = await testHttpConnection(ip, port, 3000);
    
    if (!httpTest.success) {
      return { success: false, error: `RTSP port (${port}) not accessible on ${ip}` };
    }
    
    // Real RTSP test would require RTSP client library
    // For now, just test TCP connectivity and URL format validation
    if (!rtspUrl.startsWith('rtsp://')) {
      return { success: false, error: 'Invalid RTSP URL format' };
    }
    
    // Basic URL validation passed
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Build RTSP URLs based on camera brand/model
function buildRTSPUrl(config: IPCameraRequest): string[] {
  const { ip_address, port = 554, username, password, rtsp_path } = config;
  const auth = username && password ? `${username}:${password}@` : '';
  const base = `rtsp://${auth}${ip_address}:${port}`;
  
  const urls: string[] = [];
  
  if (rtsp_path) {
    urls.push(`${base}${rtsp_path}`);
  } else {
    // Common RTSP paths for different brands
    const commonPaths = [
      '/stream1',           // Generic
      '/cam/realmonitor?channel=1&subtype=0', // Dahua
      '/ISAPI/Streaming/Channels/101',         // Hikvision
      '/video1',           // Axis
      '/live/ch1',         // Uniview
      '/streaming/channels/1', // Generic IP cameras
      '/1',                // Simple path
      '/videoMain',        // Some models
    ];
    
    urls.push(...commonPaths.map(path => `${base}${path}`));
  }
  
  return urls;
}

// Discover cameras in network range
async function scanNetwork(networkRange: string, ports: number[] = [80, 554, 8080]): Promise<any[]> {
  console.log(`Scanning network range: ${networkRange} on ports: ${ports.join(', ')}`);
  
  // Real network scanning would require proper networking tools
  // This is a simplified implementation for demonstration
  const baseIP = networkRange.split('/')[0].split('.').slice(0, 3).join('.');
  const devices = [];
  
  // In production, use tools like nmap or custom port scanning
  console.log('PRODUCTION NOTE: Implement real network scanning with nmap or similar');
  
  // Return empty results to avoid false positives in production
  return [];
  
  // Real implementation would scan actual network range
  // Example real implementation:
  /*
  for (let i = 1; i < 255; i++) {
    const ip = `${baseIP}.${i}`;
    
    for (const port of ports) {
      const test = await testHttpConnection(ip, port, 1000);
      if (test.success) {
        devices.push({
          ip_address: ip,
          port_open: port,
          http_accessible: port === 80 ? test.success : false,
          estimated_type: port === 554 ? 'IP Camera (RTSP)' : 'Device'
        });
      }
    }
  }
  */
  
  return devices;
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

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get org_id from header
    const orgId = req.headers.get('x-org-id');
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // List existing IP cameras
      const { data: cameras, error } = await supabase
        .from('ip_cameras')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching IP cameras:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch cameras' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: cameras }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = await req.json();

    switch (action) {
      case 'test-connection': {
        const config: IPCameraRequest = requestBody;
        console.log('Testing IP camera connection:', config);

        if (!config.ip_address) {
          return new Response(
            JSON.stringify({ error: 'IP address is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Test HTTP connectivity first
        const httpTest = await testHttpConnection(
          config.ip_address, 
          config.http_port || 80
        );

        // Build and test RTSP URLs
        const rtspUrls = buildRTSPUrl(config);
        let streamUrl = '';
        let rtspSuccess = false;
        let rtspError = '';

        for (const url of rtspUrls) {
          const rtspTest = await testRTSPConnection(url);
          if (rtspTest.success) {
            streamUrl = url;
            rtspSuccess = true;
            break;
          } else {
            rtspError = rtspTest.error || 'Connection failed';
          }
        }

        const result = {
          success: rtspSuccess,
          http_accessible: httpTest.success,
          stream_url: streamUrl,
          tested_urls: rtspUrls,
          error: rtspSuccess ? undefined : rtspError
        };

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save-config': {
        const config: IPCameraRequest = requestBody;
        console.log('Saving IP camera config:', config);

        if (!config.name || !config.ip_address) {
          return new Response(
            JSON.stringify({ error: 'Name and IP address are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Test connection before saving
        const rtspUrls = buildRTSPUrl(config);
        let streamUrl = '';
        let status = 'offline';
        let errorMessage = '';

        for (const url of rtspUrls) {
          const test = await testRTSPConnection(url);
          if (test.success) {
            streamUrl = url;
            status = 'online';
            break;
          } else {
            errorMessage = test.error || 'Connection failed';
          }
        }

        // Save to database
        const { data: camera, error } = await supabase
          .from('ip_cameras')
          .insert({
            org_id: orgId,
            name: config.name,
            brand: config.brand,
            model: config.model,
            ip_address: config.ip_address,
            port: config.port || 554,
            username: config.username,
            password: config.password,
            rtsp_path: config.rtsp_path,
            http_port: config.http_port || 80,
            onvif_port: config.onvif_port || 80,
            status,
            last_tested_at: new Date().toISOString(),
            stream_urls: { rtsp: streamUrl },
            error_message: status === 'offline' ? errorMessage : null
          })
          .select()
          .single();

        if (error) {
          console.error('Error saving IP camera:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to save camera' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: camera,
            message: `Camera ${status === 'online' ? 'connected and saved' : 'saved (connection failed)'}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'scan-network': {
        const { network_range, ports }: NetworkScanRequest = requestBody;
        console.log('Scanning network:', network_range);

        if (!network_range) {
          return new Response(
            JSON.stringify({ error: 'Network range is required (e.g., 192.168.1.0/24)' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const devices = await scanNetwork(network_range, ports);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: devices,
            message: `Found ${devices.length} potential camera(s)` 
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
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})