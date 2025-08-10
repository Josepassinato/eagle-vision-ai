import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { LIVE_HLS_URL } from "@/config";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import OverlayCanvas from "@/components/OverlayCanvas";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const Live: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { events } = useRealtimeEvents();
  const [cameraId, setCameraId] = useState<string>("cam-sim");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;
    (video as any).autoplay = true;

    try {
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
        const onLoaded = () => video.play().catch(() => {});
        video.addEventListener('loadedmetadata', onLoaded);
        return () => video.removeEventListener('loadedmetadata', onLoaded);
      }
    } catch (e) {
      toast({ title: "Erro no player HLS", description: String(e), variant: "destructive" });
    }
  }, []);

  // Último evento para a câmera selecionada
  const lastForCam = useMemo(() => {
    const filtered = events.filter((e) => e.camera_id === cameraId);
    return filtered.length ? filtered[filtered.length - 1] : null;
  }, [events, cameraId]);

  useEffect(() => {
    // Limpa overlay ao trocar câmera
    // (o hook já limpa no unmount/rota)
  }, [cameraId]);

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Live View</h1>
        <p className="text-muted-foreground">Transmissão HLS com overlays em tempo real</p>
      </header>

      <section className="mb-4 flex items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="camera">camera_id</label>
        <Input id="camera" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="w-[220px]" placeholder="cam-sim" />
        <div className="text-xs text-muted-foreground">Eventos desta câmera: {events.filter(e=>e.camera_id===cameraId).length}</div>
      </section>

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
        <OverlayCanvas videoRef={videoRef} event={lastForCam} />
      </section>
    </main>
  );
};

export default Live;
