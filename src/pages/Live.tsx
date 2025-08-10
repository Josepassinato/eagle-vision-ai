import React, { useEffect, useRef } from "react";
import Hls from "hls.js";
import { LIVE_HLS_URL } from "@/config";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";

const Live: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { events } = useRealtimeEvents();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    video.autoplay = true as any;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(LIVE_HLS_URL);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = LIVE_HLS_URL;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => {});
      });
    }
  }, []);

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Live View</h1>
        <p className="text-muted-foreground">Transmissão HLS com overlay (placeholder) em tempo real</p>
      </header>

      <section className="relative w-full aspect-video rounded-lg overflow-hidden shadow-primary">
        <video
          ref={videoRef}
          className="w-full h-full bg-black"
          controls={false}
          playsInline
          muted
          autoPlay
          crossOrigin="anonymous"
        />
        {/* Overlay placeholder */}
        <div className="pointer-events-none absolute inset-0 border border-white/5">
          <div className="absolute left-2 top-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            Eventos recentes: {events.length}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Live;
