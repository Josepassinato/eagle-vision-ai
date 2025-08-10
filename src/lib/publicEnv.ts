// Utilities to load public runtime config (no Vite envs available here)
// Priority:
// 1) window.__ENV.{SUPABASE_URL,SUPABASE_ANON_KEY}
// 2) <meta name="supabase-url" content="..."> and <meta name="supabase-anon-key" content="...">
// 3) Fallback to hardcoded defaults (repo) as last resort

export type PublicRuntimeEnv = {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

export function loadPublicEnv(): PublicRuntimeEnv {
  const w = (globalThis as any)?.window as (Window & { __ENV?: PublicRuntimeEnv }) | undefined;
  const fromWindow = w?.__ENV || {};

  const meta = typeof document !== 'undefined' ? {
    url: document.querySelector('meta[name="supabase-url"]')?.getAttribute('content') || undefined,
    anon: document.querySelector('meta[name="supabase-anon-key"]')?.getAttribute('content') || undefined,
  } : { url: undefined, anon: undefined };

  return {
    SUPABASE_URL: fromWindow.SUPABASE_URL || meta.url,
    SUPABASE_ANON_KEY: fromWindow.SUPABASE_ANON_KEY || meta.anon,
  };
}
