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
      case 'generate_key': {
        const { key_name, key_type, key_purpose } = data;
        
        // Generate encryption key based on type
        let keyData;
        let keyHash;
        
        if (key_type === 'aes256') {
          keyData = await generateAESKey();
          keyHash = await hashKey(keyData);
        } else if (key_type === 'rsa2048') {
          const keyPair = await generateRSAKeyPair();
          keyData = keyPair;
          keyHash = await hashKey(keyPair.publicKey);
        } else {
          throw new Error('Unsupported key type');
        }

        // Store key metadata (not the actual key)
        const { data: keyRecord, error } = await supabase
          .from('encryption_keys')
          .insert({
            key_name,
            key_type,
            key_purpose,
            key_hash,
            is_active: true,
            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
          })
          .select()
          .single();

        if (error) throw error;

        // Log key generation
        await supabase
          .from('audit_logs')
          .insert({
            action: 'encryption_key_generated',
            resource_type: 'encryption_key',
            resource_id: keyRecord.id,
            metadata: { key_name, key_type, key_purpose }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            key_id: keyRecord.id,
            key_name,
            key_hash,
            // Note: In production, the actual key would be stored securely (e.g., HSM, Vault)
            // and not returned in the response
            message: 'Encryption key generated successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'rotate_key': {
        const { key_id } = data;
        
        // Get existing key
        const { data: existingKey, error: fetchError } = await supabase
          .from('encryption_keys')
          .select('*')
          .eq('id', key_id)
          .single();

        if (fetchError) throw fetchError;

        // Generate new key
        let newKeyData;
        let newKeyHash;
        
        if (existingKey.key_type === 'aes256') {
          newKeyData = await generateAESKey();
          newKeyHash = await hashKey(newKeyData);
        } else if (existingKey.key_type === 'rsa2048') {
          const keyPair = await generateRSAKeyPair();
          newKeyData = keyPair;
          newKeyHash = await hashKey(keyPair.publicKey);
        }

        // Update existing key
        const { error: updateError } = await supabase
          .from('encryption_keys')
          .update({
            key_hash: newKeyHash,
            rotated_at: new Date().toISOString()
          })
          .eq('id', key_id);

        if (updateError) throw updateError;

        // Log key rotation
        await supabase
          .from('audit_logs')
          .insert({
            action: 'encryption_key_rotated',
            resource_type: 'encryption_key',
            resource_id: key_id,
            metadata: { 
              old_hash: existingKey.key_hash,
              new_hash: newKeyHash,
              rotation_date: new Date().toISOString()
            }
          });

        return new Response(
          JSON.stringify({ 
            success: true,
            key_id,
            new_hash: newKeyHash,
            message: 'Encryption key rotated successfully'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'encrypt_data': {
        const { data: plaintext, key_id } = data;
        
        // Get encryption key
        const { data: keyRecord, error: keyError } = await supabase
          .from('encryption_keys')
          .select('*')
          .eq('id', key_id)
          .eq('is_active', true)
          .single();

        if (keyError) throw keyError;

        // Simulate encryption (in production, use actual key from secure storage)
        const encrypted = await encryptData(plaintext, keyRecord.key_type);

        // Log encryption operation
        await supabase.rpc('log_data_access', {
          _access_type: 'write',
          _resource_type: 'encrypted_data',
          _resource_id: key_id,
          _purpose: 'Data encryption',
          _legal_basis: 'legitimate_interest'
        });

        return new Response(
          JSON.stringify({ 
            success: true,
            encrypted_data: encrypted,
            key_id,
            algorithm: keyRecord.key_type
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'decrypt_data': {
        const { encrypted_data, key_id } = data;
        
        // Get encryption key
        const { data: keyRecord, error: keyError } = await supabase
          .from('encryption_keys')
          .select('*')
          .eq('id', key_id)
          .eq('is_active', true)
          .single();

        if (keyError) throw keyError;

        // Simulate decryption (in production, use actual key from secure storage)
        const decrypted = await decryptData(encrypted_data, keyRecord.key_type);

        // Log decryption operation
        await supabase.rpc('log_data_access', {
          _access_type: 'read',
          _resource_type: 'encrypted_data',
          _resource_id: key_id,
          _purpose: 'Data decryption',
          _legal_basis: 'legitimate_interest'
        });

        return new Response(
          JSON.stringify({ 
            success: true,
            decrypted_data: decrypted,
            key_id
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_key_status': {
        const { key_id } = data;
        
        const { data: keyRecord, error } = await supabase
          .from('encryption_keys')
          .select('*')
          .eq('id', key_id)
          .single();

        if (error) throw error;

        const isExpired = new Date(keyRecord.expires_at) < new Date();
        const daysUntilExpiry = Math.ceil((new Date(keyRecord.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        return new Response(
          JSON.stringify({ 
            key_id,
            key_name: keyRecord.key_name,
            key_type: keyRecord.key_type,
            key_purpose: keyRecord.key_purpose,
            is_active: keyRecord.is_active,
            is_expired: isExpired,
            days_until_expiry: daysUntilExpiry,
            created_at: keyRecord.created_at,
            rotated_at: keyRecord.rotated_at
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list_keys': {
        const { data: keys, error } = await supabase
          .from('encryption_keys')
          .select('id, key_name, key_type, key_purpose, is_active, expires_at, created_at, rotated_at')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const keysWithStatus = keys.map(key => ({
          ...key,
          is_expired: new Date(key.expires_at) < new Date(),
          days_until_expiry: Math.ceil((new Date(key.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }));

        return new Response(
          JSON.stringify({ 
            keys: keysWithStatus,
            total_count: keys.length,
            active_count: keys.filter(k => k.is_active).length
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
    console.error('Data Encryption Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions for encryption (simplified for demo)
async function generateAESKey(): Promise<string> {
  const key = new Uint8Array(32); // 256-bit key
  crypto.getRandomValues(key);
  return Array.from(key, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function generateRSAKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKey = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: Array.from(new Uint8Array(publicKey), byte => byte.toString(16).padStart(2, '0')).join(''),
    privateKey: Array.from(new Uint8Array(privateKey), byte => byte.toString(16).padStart(2, '0')).join('')
  };
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function encryptData(plaintext: string, algorithm: string): Promise<string> {
  // Simplified encryption simulation
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // In production, use proper encryption with the actual key
  const encrypted = Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${algorithm}:${encrypted}`;
}

async function decryptData(encryptedData: string, algorithm: string): Promise<string> {
  // Simplified decryption simulation
  const [alg, data] = encryptedData.split(':');
  
  if (alg !== algorithm) {
    throw new Error('Algorithm mismatch');
  }
  
  // Convert hex back to bytes
  const bytes = [];
  for (let i = 0; i < data.length; i += 2) {
    bytes.push(parseInt(data.substr(i, 2), 16));
  }
  
  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(bytes));
}