import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChurchEvent {
  id: string;
  camera_id: string;
  event_type: 'person_count' | 'run_detected' | 'fall_detected' | 'intrusion_detected' | 'loitering_detected' | 'reach_into_bag';
  confidence: number;
  clip_uri?: string;
  metadata: Record<string, any>;
  zone_name?: string;
  person_count: number;
  timestamp: string;
}

export interface ChurchAnalytics {
  id: string;
  camera_id: string;
  date: string;
  total_attendance: number;
  peak_attendance: number;
  avg_attendance: number;
  entry_count: number;
  exit_count: number;
  safety_events: number;
  privacy_mode_enabled: boolean;
  service_times: Array<{ start: string; end: string; name: string }>;
  zone_metrics: Record<string, number>;
}

export const useChurchAnalytics = (cameraId?: string) => {
  const [events, setEvents] = useState<ChurchEvent[]>([]);
  const [analytics, setAnalytics] = useState<ChurchAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      let query = supabase
        .from('church_events')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (cameraId) {
        query = query.eq('camera_id', cameraId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents((data || []).map(item => ({
        ...item,
        event_type: item.event_type as ChurchEvent['event_type'],
        metadata: item.metadata as Record<string, any>
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch church events');
    }
  };

  const fetchAnalytics = async () => {
    try {
      let query = supabase
        .from('church_analytics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      if (cameraId) {
        query = query.eq('camera_id', cameraId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAnalytics((data || []).map(item => ({
        ...item,
        service_times: (item.service_times as any) || [],
        zone_metrics: (item.zone_metrics as Record<string, number>) || {}
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch church analytics');
    }
  };

  const createEvent = async (eventData: Omit<ChurchEvent, 'id' | 'timestamp'>) => {
    try {
      const { data, error } = await supabase
        .from('church_events')
        .insert([eventData])
        .select()
        .single();

      if (error) throw error;
      await fetchEvents(); // Refresh events
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
      throw err;
    }
  };

  const updateAnalytics = async (analyticsData: Partial<ChurchAnalytics> & { camera_id: string; date: string }) => {
    try {
      const { data, error } = await supabase
        .from('church_analytics')
        .upsert([analyticsData], { onConflict: 'camera_id,date' })
        .select()
        .single();

      if (error) throw error;
      await fetchAnalytics(); // Refresh analytics
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update analytics');
      throw err;
    }
  };

  const getEventsByType = (eventType: ChurchEvent['event_type']) => {
    return events.filter(event => event.event_type === eventType);
  };

  const getTodayStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayAnalytics = analytics.find(a => a.date === today);
    
    return {
      attendance: todayAnalytics?.total_attendance || 0,
      peak: todayAnalytics?.peak_attendance || 0,
      entries: todayAnalytics?.entry_count || 0,
      exits: todayAnalytics?.exit_count || 0,
      safety: todayAnalytics?.safety_events || 0
    };
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchEvents(), fetchAnalytics()]);
      setIsLoading(false);
    };

    loadData();
  }, [cameraId]);

  // Real-time subscriptions
  useEffect(() => {
    const eventsChannel = supabase
      .channel('church-events')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'church_events',
          filter: cameraId ? `camera_id=eq.${cameraId}` : undefined
        }, 
        () => fetchEvents()
      )
      .subscribe();

    const analyticsChannel = supabase
      .channel('church-analytics')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'church_analytics',
          filter: cameraId ? `camera_id=eq.${cameraId}` : undefined
        }, 
        () => fetchAnalytics()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(analyticsChannel);
    };
  }, [cameraId]);

  return {
    events,
    analytics,
    isLoading,
    error,
    createEvent,
    updateAnalytics,
    getEventsByType,
    getTodayStats,
    refresh: () => {
      fetchEvents();
      fetchAnalytics();
    }
  };
};