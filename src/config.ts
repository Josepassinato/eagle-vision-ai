// Centralized frontend config (publishable)
export const LIVE_HLS_URL = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // public HLS (Mux sample)
export const DEMO_VIDEO_STREAM = "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"; // Demo HLS com vídeo real
export const REALTIME_SCHEMA = "public";
export const REALTIME_TABLE = "events";
export const BUCKET_EVIDENCE = "evidence";
export const SIGNED_URL_TTL = 300; // seconds

// Debounce window per camera for realtime overlays
export const OVERLAY_DEBOUNCE_MS = 250;
