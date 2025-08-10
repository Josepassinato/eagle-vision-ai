import React, { useEffect, useRef } from "react";
import { RealtimeEvent } from "@/hooks/useRealtimeEvents";

interface OverlayCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  event: RealtimeEvent | null;
}

function getCssHsl(varName: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v ? `hsl(${v})` : "#ffffff";
}

function colorForLabel(label?: string): string {
  const map: Record<string, string> = {
    person: getCssHsl("--overlay-person"),
    car: getCssHsl("--overlay-car"),
    truck: getCssHsl("--overlay-truck"),
    bus: getCssHsl("--overlay-bus"),
    motorcycle: getCssHsl("--overlay-motorcycle"),
    bicycle: getCssHsl("--overlay-bicycle"),
  };
  return (label && map[label]) || getCssHsl("--accent");
}

const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ videoRef, event }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const lastEventRef = useRef<RealtimeEvent | null>(null);

  useEffect(() => {
    lastEventRef.current = event || null;
  }, [event]);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = video.clientWidth;
      const h = video.clientHeight;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(video);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const ev = lastEventRef.current;
      if (!ev || !ev.bbox || ev.bbox.length !== 4) return;

      const color = colorForLabel(ev.label);

      // Dimensions
      const vidW = video.videoWidth || video.clientWidth;
      const vidH = video.videoHeight || video.clientHeight;
      if (!vidW || !vidH) return;

      const canW = canvas.width;
      const canH = canvas.height;

      // Compute letterboxing scaling to fit video inside the element
      const scale = Math.min(canW / (vidW * dpr), canH / (vidH * dpr));
      const drawW = vidW * dpr * scale;
      const drawH = vidH * dpr * scale;
      const offsetX = (canW - drawW) / 2;
      const offsetY = (canH - drawH) / 2;

      let [x1, y1, x2, y2] = ev.bbox;
      // If coordinates look absolute (>1), normalize to pixels using video dimensions
      const isNormalized = Math.max(x1, y1, x2, y2) <= 1;
      if (isNormalized) {
        x1 = offsetX + x1 * drawW;
        y1 = offsetY + y1 * drawH;
        x2 = offsetX + x2 * drawW;
        y2 = offsetY + y2 * drawH;
      } else {
        // Map absolute frame coordinates into canvas space
        const sx = drawW / (vidW * dpr);
        const sy = drawH / (vidH * dpr);
        x1 = offsetX + x1 * sx;
        y1 = offsetY + y1 * sy;
        x2 = offsetX + x2 * sx;
        y2 = offsetY + y2 * sy;
      }

      const w = Math.max(0, x2 - x1);
      const h = Math.max(0, y2 - y1);

      ctx.save();
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = color;
      ctx.strokeRect(x1, y1, w, h);

      // Label background
      const label = `${ev.label ?? ""}${ev.conf ? ` (${(ev.conf * 100).toFixed(0)}%)` : ""}${ev.person_name ? ` • ${ev.person_name}` : ""}`.trim();
      if (label) {
        ctx.font = `${12 * dpr}px Inter, ui-sans-serif, system-ui`;
        const metrics = ctx.measureText(label);
        const padding = 6 * dpr;
        const bgW = metrics.width + padding * 2;
        const bgH = 18 * dpr;
        const bgX = Math.max(0, x1);
        const bgY = Math.max(0, y1 - bgH - 2 * dpr);

        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(bgX, bgY, bgW, bgH);
        ctx.fillStyle = getCssHsl("--foreground");
        ctx.fillText(label, bgX + padding, bgY + bgH - 6 * dpr);
      }
      ctx.restore();
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [videoRef]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" aria-label="Detecções em tempo real" />;
};

export default OverlayCanvas;
