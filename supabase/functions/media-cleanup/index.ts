import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers for browser/pg_net calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // backend only
const SECRET = Deno.env.get("MEDIA_CLEANUP_SECRET") || "";
const DEFAULT_BUCKETS = (Deno.env.get("MEDIA_BUCKETS") || "event_clips,antitheft_clips")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const DEFAULT_RETENTION = Number(Deno.env.get("MEDIA_RETENTION_DAYS") || 7);

const ADMIN = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

type CleanupInput = {
  dryRun?: boolean;
  buckets?: string[] | string;
  retentionDays?: number;
  prefix?: string; // optional: clean only a subpath
};

async function getRetentionDays(fallback: number) {
  try {
    const { data, error } = await ADMIN
      .from("app_config")
      .select("value")
      .in("key", ["MEDIA_RETENTION_DAYS", "media_retention_days"]) // support both cases
      .order("key", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data && Number(data.value)) return Number(data.value);
  } catch {
    // ignore
  }
  return fallback;
}

async function listRecursive(bucket: string, prefix = "") {
  const pageSize = 1000;
  const files: { path: string; updated_at?: string | null }[] = [];
  const queue: string[] = [prefix];
  while (queue.length) {
    const pfx = queue.pop()!;
    let offset = 0;
    // paginate directory listing
    while (true) {
      const { data, error } = await ADMIN.storage
        .from(bucket)
        .list(pfx, { limit: pageSize, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`[list] ${bucket}/${pfx}: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const item of data) {
        const itemPath = pfx ? `${pfx}/${item.name}` : item.name;
        // Heuristic: folders have id === null and no metadata.size
        const isFile = (item as any)?.id || (item as any)?.metadata?.size;
        if (isFile) {
          files.push({ path: itemPath, updated_at: (item as any)?.updated_at ?? null });
        } else {
          queue.push(itemPath);
        }
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return files;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Simple header secret auth for pg_net/cron
    const headerSecret = req.headers.get("x-secret") || "";
    if (!SECRET || headerSecret !== SECRET) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }

    const body = (await req.json().catch(() => ({}))) as CleanupInput;
    const dryRun = body.dryRun ?? false;
    const buckets = Array.isArray(body.buckets)
      ? body.buckets
      : body.buckets
      ? String(body.buckets).split(",").map((s) => s.trim())
      : DEFAULT_BUCKETS;

    const retentionDays = await getRetentionDays(
      Number.isFinite(body.retentionDays as number) ? Number(body.retentionDays) : DEFAULT_RETENTION,
    );
    const olderThan = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const summary: any = {
      dryRun,
      retentionDays,
      olderThan: olderThan.toISOString(),
      buckets: {} as Record<string, any>,
    };

    for (const bucket of buckets) {
      const files = await listRecursive(bucket, body.prefix || "");
      const toDelete: string[] = [];
      for (const f of files) {
        const updated = f.updated_at ? new Date(f.updated_at) : new Date(0);
        if (updated < olderThan) toDelete.push(f.path);
      }

      let deleted = 0;
      const errors: string[] = [];
      if (!dryRun && toDelete.length) {
        const chunkSize = 500;
        for (let i = 0; i < toDelete.length; i += chunkSize) {
          const chunk = toDelete.slice(i, i + chunkSize);
          const { error } = await ADMIN.storage.from(bucket).remove(chunk);
          if (error) errors.push(`[remove] ${bucket}: ${error.message}`);
          else deleted += chunk.length;
        }
      }

      summary.buckets[bucket] = {
        scanned: files.length,
        candidates: toDelete.length,
        deleted: dryRun ? 0 : deleted,
        errors,
      };
    }

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { "content-type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      headers: { "content-type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});