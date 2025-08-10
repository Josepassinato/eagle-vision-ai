// Centralized frontend config (publishable)
export const LIVE_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // public HLS (Mux sample)
export const REALTIME_SCHEMA = "public";
export const REALTIME_TABLE = "events";
export const BUCKET_EVIDENCE = "evidence";
export const SIGNED_URL_TTL = 300; // seconds

// Debounce window per camera for realtime overlays
export const OVERLAY_DEBOUNCE_MS = 250;
