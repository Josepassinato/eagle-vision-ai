// Centralized frontend config (publishable)
export const LIVE_HLS_URL = "http://SEU_IP:8888/simulador/index.m3u8"; // public HLS
export const REALTIME_SCHEMA = "public";
export const REALTIME_TABLE = "events";
export const BUCKET_EVIDENCE = "evidence";
export const SIGNED_URL_TTL = 300; // seconds

// Debounce window per camera for realtime overlays
export const OVERLAY_DEBOUNCE_MS = 250;
