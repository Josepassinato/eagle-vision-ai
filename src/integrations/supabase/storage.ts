import { supabase } from "@/integrations/supabase/client";
import { BUCKET_EVIDENCE, SIGNED_URL_TTL } from "@/config";

export async function getEvidenceSignedUrl(path: string, ttlSeconds: number = SIGNED_URL_TTL) {
  try {
    const { data, error } = await supabase
      .storage
      .from(BUCKET_EVIDENCE)
      .createSignedUrl(path, ttlSeconds);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error("signed url error", e);
    return null;
  }
}

export async function getSignedUrl(bucket: string, path: string, ttlSeconds: number = SIGNED_URL_TTL) {
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ttlSeconds);
    if (error) throw error;
    return data?.signedUrl ?? null;
  } catch (e) {
    console.error("signed url error", e);
    return null;
  }
}
