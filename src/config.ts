// Centralized frontend config (publishable)
// URLs removidas - sistema agora usa apenas câmeras reais configuradas
export const REALTIME_SCHEMA = "public";
export const REALTIME_TABLE = "events";
export const BUCKET_EVIDENCE = "evidence";
export const SIGNED_URL_TTL = 300; // seconds

// Debounce window per camera for realtime overlays
export const OVERLAY_DEBOUNCE_MS = 250;
