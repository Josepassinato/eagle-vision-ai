import { useEffect, useRef, useState, useCallback } from "react";
import { pipeline, env } from "@huggingface/transformers";

// Configure transformers to use local models (no CDN)
env.allowLocalModels = false;
env.allowRemoteModels = true;

export type Detection = {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};

export type DetectionEvent = {
  id: string;
  camera_id: string;
  bbox: number[]; // [x1, y1, x2, y2] normalized 0-1
  label: string;
  conf: number;
  ts: string;
  person_id?: string;
  person_name?: string;
};

export function useBrowserDetection(
  videoRef: React.RefObject<HTMLVideoElement>,
  enabled: boolean = true,
  analytic: "people_count" | "vehicle_count" | "safety" | "airport" | "edubehavior" = "people_count"
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [events, setEvents] = useState<DetectionEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const detectorRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastProcessTime = useRef<number>(0);

  // Initialize detector based on analytic type
  const initializeDetector = useCallback(async () => {
    if (detectorRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Initializing ${analytic} detector...`);
      
      // Use YOLO tiny model - faster and works well with WASM
      const modelName = "Xenova/yolov8n"; // Nano version for speed
      
      detectorRef.current = await pipeline("object-detection", modelName, {
        device: "wasm", // Use WASM instead of WebGPU
        revision: "main",
      });
      
      console.log(`${analytic} detector initialized successfully`);
    } catch (err) {
      console.error("Failed to initialize detector:", err);
      setError(`Failed to load AI model: ${err}`);
    } finally {
      setIsLoading(false);
    }
  }, [analytic]);

  // Filter detections based on analytic type
  const filterDetections = useCallback((detections: Detection[]): Detection[] => {
    const peopleLabels = ["person"];
    const vehicleLabels = ["car", "truck", "bus", "motorcycle", "bicycle"];
    const safetyLabels = ["person", "car", "truck"];
    
    return detections.filter(det => {
      const label = det.label.toLowerCase();
      const score = det.score || 0;
      
      // Minimum confidence threshold
      if (score < 0.4) return false;
      
      switch (analytic) {
        case "people_count":
        case "edubehavior":
          return peopleLabels.includes(label);
        case "vehicle_count":
          return vehicleLabels.includes(label);
        case "safety":
          return safetyLabels.includes(label);
        default:
          return score > 0.5; // General detection
      }
    });
  }, [analytic]);

  // Process video frame for detection
  const processFrame = useCallback(async () => {
    if (!enabled || !detectorRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    if (video.paused || video.ended || video.readyState < 2) return;

    const now = Date.now();
    if (now - lastProcessTime.current < 1000) return; // Throttle to 1 FPS for performance
    lastProcessTime.current = now;

    try {
      // Create canvas for processing
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d")!;
      
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Run detection
      const results = await detectorRef.current(canvas);
      const filtered = filterDetections(results);
      
      setDetections(filtered);
      
      // Convert to events format
      const newEvents: DetectionEvent[] = filtered.map(det => ({
        id: `det_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        camera_id: "demo_browser",
        bbox: [
          det.box.xmin / canvas.width,
          det.box.ymin / canvas.height,
          det.box.xmax / canvas.width,
          det.box.ymax / canvas.height,
        ],
        label: det.label,
        conf: det.score,
        ts: new Date().toISOString(),
        person_name: det.label === "person" ? `Person ${Math.floor(Math.random() * 100)}` : undefined,
      }));
      
      setEvents(newEvents);
      
      // Update counts
      const newCounts: Record<string, number> = {};
      filtered.forEach(det => {
        const label = det.label.toLowerCase();
        newCounts[label] = (newCounts[label] || 0) + 1;
      });
      setCounts(newCounts);
      
    } catch (err) {
      console.warn("Detection error:", err);
    }
  }, [enabled, videoRef, analytic, filterDetections]);

  // Animation loop for continuous detection
  useEffect(() => {
    if (!enabled) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = () => {
      processFrame();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, processFrame]);

  // Initialize detector when enabled
  useEffect(() => {
    if (enabled && !detectorRef.current && !isLoading) {
      initializeDetector();
    }
  }, [enabled, initializeDetector, isLoading]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      detectorRef.current = null;
    };
  }, []);

  return {
    isLoading,
    error,
    detections,
    events,
    counts,
    isReady: !!detectorRef.current && !isLoading,
  };
}