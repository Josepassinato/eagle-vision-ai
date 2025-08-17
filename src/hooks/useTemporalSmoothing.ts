import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DetectionState {
  track_id: string;
  camera_id: string;
  confidence_history: number[];
  smoothed_confidence: number;
  frame_count: number;
  hysteresis_state: 'idle' | 'entering' | 'active' | 'exiting';
  state_enter_time?: Date;
  last_detection_time: Date;
  last_position: number[];
  motion_magnitude: number;
  last_event_emitted?: Date;
  event_count: number;
}

interface SmoothingConfig {
  smoothing_window_frames: number;
  hysteresis_enter_threshold: number;
  hysteresis_exit_threshold: number;
  min_event_duration_ms: number;
  motion_threshold: number;
}

export function useTemporalSmoothing() {
  const [detectionStates, setDetectionStates] = useState<Map<string, DetectionState>>(new Map());
  const configCache = useRef<Map<string, SmoothingConfig>>(new Map());

  const getCameraConfig = useCallback(async (cameraId: string): Promise<SmoothingConfig> => {
    // Check cache first
    if (configCache.current.has(cameraId)) {
      return configCache.current.get(cameraId)!;
    }

    try {
      const { data, error } = await supabase
        .from('camera_ai_profiles')
        .select(`
          smoothing_window_frames,
          hysteresis_enter_threshold,
          hysteresis_exit_threshold,
          min_event_duration_ms,
          motion_threshold
        `)
        .eq('camera_id', cameraId)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        // Return default config
        const defaultConfig: SmoothingConfig = {
          smoothing_window_frames: 5,
          hysteresis_enter_threshold: 0.7,
          hysteresis_exit_threshold: 0.5,
          min_event_duration_ms: 1000,
          motion_threshold: 0.02
        };
        configCache.current.set(cameraId, defaultConfig);
        return defaultConfig;
      }

      const config: SmoothingConfig = {
        smoothing_window_frames: data.smoothing_window_frames,
        hysteresis_enter_threshold: data.hysteresis_enter_threshold,
        hysteresis_exit_threshold: data.hysteresis_exit_threshold,
        min_event_duration_ms: data.min_event_duration_ms,
        motion_threshold: data.motion_threshold
      };

      configCache.current.set(cameraId, config);
      return config;
    } catch (error) {
      console.error('Error loading camera config:', error);
      const defaultConfig: SmoothingConfig = {
        smoothing_window_frames: 5,
        hysteresis_enter_threshold: 0.7,
        hysteresis_exit_threshold: 0.5,
        min_event_duration_ms: 1000,
        motion_threshold: 0.02
      };
      return defaultConfig;
    }
  }, []);

  const calculateExponentialMovingAverage = (
    history: number[], 
    windowSize: number
  ): number => {
    if (history.length === 0) return 0;
    
    const alpha = 2 / (windowSize + 1);
    let ema = history[0];
    
    for (let i = 1; i < history.length; i++) {
      ema = alpha * history[i] + (1 - alpha) * ema;
    }
    
    return ema;
  };

  const calculateMotionMagnitude = (
    currentPos: number[],
    lastPos: number[]
  ): number => {
    if (lastPos.length !== 4 || currentPos.length !== 4) return 0;
    
    const dx = currentPos[0] - lastPos[0];
    const dy = currentPos[1] - lastPos[1];
    const dw = currentPos[2] - lastPos[2];
    const dh = currentPos[3] - lastPos[3];
    
    return Math.sqrt(dx * dx + dy * dy + dw * dw + dh * dh);
  };

  const updateDetectionState = useCallback(async (
    cameraId: string,
    trackId: string,
    confidence: number,
    bbox: number[]
  ): Promise<{ shouldEmitEvent: boolean; smoothedConfidence: number }> => {
    const config = await getCameraConfig(cameraId);
    const stateKey = `${cameraId}-${trackId}`;
    
    setDetectionStates(prevStates => {
      const newStates = new Map(prevStates);
      const currentState = newStates.get(stateKey);
      const now = new Date();

      if (!currentState) {
        // Initialize new state
        const newState: DetectionState = {
          track_id: trackId,
          camera_id: cameraId,
          confidence_history: [confidence],
          smoothed_confidence: confidence,
          frame_count: 1,
          hysteresis_state: confidence >= config.hysteresis_enter_threshold ? 'entering' : 'idle',
          state_enter_time: confidence >= config.hysteresis_enter_threshold ? now : undefined,
          last_detection_time: now,
          last_position: bbox,
          motion_magnitude: 0,
          event_count: 0
        };
        
        newStates.set(stateKey, newState);
        return newStates;
      }

      // Update confidence history
      const updatedHistory = [...currentState.confidence_history, confidence]
        .slice(-config.smoothing_window_frames);
      
      const smoothedConfidence = calculateExponentialMovingAverage(
        updatedHistory, 
        config.smoothing_window_frames
      );

      // Calculate motion
      const motionMagnitude = calculateMotionMagnitude(bbox, currentState.last_position);

      // Update hysteresis state
      let newHysteresisState = currentState.hysteresis_state;
      let stateEnterTime = currentState.state_enter_time;

      switch (currentState.hysteresis_state) {
        case 'idle':
          if (smoothedConfidence >= config.hysteresis_enter_threshold) {
            newHysteresisState = 'entering';
            stateEnterTime = now;
          }
          break;
        
        case 'entering':
          if (smoothedConfidence >= config.hysteresis_enter_threshold) {
            newHysteresisState = 'active';
          } else if (smoothedConfidence < config.hysteresis_exit_threshold) {
            newHysteresisState = 'idle';
            stateEnterTime = undefined;
          }
          break;
        
        case 'active':
          if (smoothedConfidence < config.hysteresis_exit_threshold) {
            newHysteresisState = 'exiting';
          }
          break;
        
        case 'exiting':
          if (smoothedConfidence >= config.hysteresis_enter_threshold) {
            newHysteresisState = 'active';
          } else if (smoothedConfidence < config.hysteresis_exit_threshold) {
            newHysteresisState = 'idle';
            stateEnterTime = undefined;
          }
          break;
      }

      const updatedState: DetectionState = {
        ...currentState,
        confidence_history: updatedHistory,
        smoothed_confidence: smoothedConfidence,
        frame_count: currentState.frame_count + 1,
        hysteresis_state: newHysteresisState,
        state_enter_time: stateEnterTime,
        last_detection_time: now,
        last_position: bbox,
        motion_magnitude: motionMagnitude
      };

      newStates.set(stateKey, updatedState);
      return newStates;
    });

    // Determine if event should be emitted
    const state = detectionStates.get(stateKey);
    if (!state) return { shouldEmitEvent: false, smoothedConfidence: confidence };

    const shouldEmitEvent = 
      state.hysteresis_state === 'active' &&
      state.state_enter_time &&
      (Date.now() - state.state_enter_time.getTime()) >= config.min_event_duration_ms &&
      (!state.last_event_emitted || 
       (Date.now() - state.last_event_emitted.getTime()) >= config.min_event_duration_ms);

    if (shouldEmitEvent) {
      // Update last event emitted time
      setDetectionStates(prevStates => {
        const newStates = new Map(prevStates);
        const currentState = newStates.get(stateKey);
        if (currentState) {
          newStates.set(stateKey, {
            ...currentState,
            last_event_emitted: new Date(),
            event_count: currentState.event_count + 1
          });
        }
        return newStates;
      });

      // Persist to database
      try {
        await supabase
          .from('detection_pipeline_state')
          .upsert({
            org_id: (await supabase.auth.getUser()).data.user?.id,
            camera_id: cameraId,
            track_id: trackId,
            confidence_history: state.confidence_history,
            smoothed_confidence: state.smoothed_confidence,
            frame_count: state.frame_count,
            hysteresis_state: state.hysteresis_state,
            state_enter_time: state.state_enter_time?.toISOString(),
            last_detection_time: state.last_detection_time.toISOString(),
            last_position: state.last_position,
            motion_magnitude: state.motion_magnitude,
            last_event_emitted: new Date().toISOString(),
            event_count: state.event_count + 1
          }, {
            onConflict: 'camera_id,track_id,org_id'
          });
      } catch (error) {
        console.error('Error persisting pipeline state:', error);
      }
    }

    return { 
      shouldEmitEvent, 
      smoothedConfidence: state.smoothed_confidence 
    };
  }, [getCameraConfig, detectionStates]);

  const cleanupExpiredStates = useCallback((maxAgeMs: number = 30000) => {
    const now = Date.now();
    setDetectionStates(prevStates => {
      const newStates = new Map(prevStates);
      
      for (const [key, state] of newStates.entries()) {
        if (now - state.last_detection_time.getTime() > maxAgeMs) {
          newStates.delete(key);
        }
      }
      
      return newStates;
    });
  }, []);

  const getStateForTrack = useCallback((cameraId: string, trackId: string): DetectionState | null => {
    return detectionStates.get(`${cameraId}-${trackId}`) || null;
  }, [detectionStates]);

  const getStatesForCamera = useCallback((cameraId: string): DetectionState[] => {
    return Array.from(detectionStates.values()).filter(state => state.camera_id === cameraId);
  }, [detectionStates]);

  return {
    updateDetectionState,
    cleanupExpiredStates,
    getStateForTrack,
    getStatesForCamera,
    detectionStates: Array.from(detectionStates.values())
  };
}