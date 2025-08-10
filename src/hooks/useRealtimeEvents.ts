import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OVERLAY_DEBOUNCE_MS, REALTIME_SCHEMA, REALTIME_TABLE } from "@/config";

export type RealtimeEvent = {
  id?: string | number;
  camera_id: string;
  bbox?: number[]; // [x1,y1,x2,y2] normalized 0-1 preferred (absolute accepted)
  label?: string;
  conf?: number;
  ts: string;
  reason?: string;
  person_id?: string;
  person_name?: string;
  thumb_path?: string;
};

export function useRealtimeEvents(cameraId?: string) {
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const buffersRef = useRef<Map<string, RealtimeEvent[]>>(new Map());
  const timersRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const channel = supabase
      .channel("events-realtime-ui")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: REALTIME_SCHEMA, table: REALTIME_TABLE },
        (payload) => {
          const newEv = (payload as any).new as RealtimeEvent;
          if (!newEv) return;
          const cam = newEv.camera_id || "unknown";
          const buf = buffersRef.current.get(cam) ?? [];
          buf.push(newEv);
          buffersRef.current.set(cam, buf);

          if (timersRef.current.has(cam)) return;
          const timer = setTimeout(() => {
            const batch = buffersRef.current.get(cam) ?? [];
            buffersRef.current.delete(cam);
            timersRef.current.delete(cam);
            if (batch.length) setEvents((prev) => [...prev, batch[batch.length - 1]]);
          }, OVERLAY_DEBOUNCE_MS);
          timersRef.current.set(cam, timer);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      buffersRef.current.clear();
    };
  }, []);

  return useMemo(() => ({ events }), [events]);
}
