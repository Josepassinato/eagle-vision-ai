/// <reference types="vite/client" />

declare global {
  interface Window {
    __ENV?: {
      SUPABASE_URL?: string;
      SUPABASE_ANON_KEY?: string;
    };
  }
}

export {};
