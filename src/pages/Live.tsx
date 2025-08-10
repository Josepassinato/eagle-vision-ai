import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { LIVE_HLS_URL } from "@/config";
import { useRealtimeEvents } from "@/hooks/useRealtimeEvents";
import type { RealtimeEvent } from "@/hooks/useRealtimeEvents";
import OverlayCanvas from "@/components/OverlayCanvas";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

const Live: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraId, setCameraId] = useState<string>("cam-sim");
  const { events } = useRealtimeEvents(cameraId);
  const [simulate, setSimulate] = useState(false);
  const [simEvent, setSimEvent] = useState<RealtimeEvent | null>(null);

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

  // Último evento da câmera (do Realtime)
  const lastForCam = useMemo(() => {
    return events.length ? events[events.length - 1] : null;
  }, [events]);

  // Simulação de detecções (caixas aleatórias)
  useEffect(() => {
    if (!simulate) { setSimEvent(null); return; }
    const labels = ["person", "car", "truck", "bus", "motorcycle", "bicycle"] as const;
    const interval = setInterval(() => {
      const x1 = Math.random() * 0.7;
      const y1 = Math.random() * 0.6;
      const w = 0.15 + Math.random() * 0.25;
      const h = 0.12 + Math.random() * 0.3;
      const ev: RealtimeEvent = {
        camera_id: cameraId,
        bbox: [x1, y1, Math.min(0.98, x1 + w), Math.min(0.98, y1 + h)],
        label: labels[Math.floor(Math.random() * labels.length)],
        conf: 0.6 + Math.random() * 0.35,
        ts: new Date().toISOString(),
        reason: "demo-simulated",
      };
      setSimEvent(ev);
    }, 900);
    return () => clearInterval(interval);
  }, [simulate, cameraId]);

  const eventToShow = simulate ? simEvent : lastForCam;

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Live View</h1>
        <p className="text-muted-foreground">Transmissão HLS com overlays em tempo real</p>
      </header>

      <section className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="camera">camera_id</label>
          <Input id="camera" value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="w-[220px]" placeholder="cam-sim" />
        </div>
        <div className="text-xs text-muted-foreground">Eventos desta câmera: {events.length}</div>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="sim">Simular detecções</Label>
          <Switch id="sim" checked={simulate} onCheckedChange={setSimulate} />
        </div>
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
        <OverlayCanvas videoRef={videoRef} event={eventToShow} />
      </section>
    </main>
  );
};

export default Live;
