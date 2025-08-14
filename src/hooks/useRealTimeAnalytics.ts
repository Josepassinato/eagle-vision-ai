import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealTimeMetrics {
  frameProcessingRate: number;
  detectionAccuracy: string;
  networkLatency: number;
  systemLoad: number;
  activeStreams: number;
  errorRate: string;
  storageUsage: number;
  alertsTriggered: number;
  peopleDetected: number;
  incidentsReported: number;
}

interface WebSocketMessage {
  type: 'connection_established' | 'metrics_update' | 'error';
  data?: RealTimeMetrics;
  timestamp: string;
  error?: string;
}

export const useRealTimeAnalytics = () => {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    try {
      // Use full URL to Supabase edge function with WebSocket protocol
      const wsUrl = `wss://avbswnnywjyvqfxezgfl.functions.supabase.co/real-time-analytics`;
      
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Real-time analytics WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          console.log('Received WebSocket message:', message);

          switch (message.type) {
            case 'connection_established':
              console.log('WebSocket connection established');
              break;
              
            case 'metrics_update':
              if (message.data) {
                setMetrics(message.data);
              }
              break;
              
            case 'error':
              setError(message.error || 'Unknown WebSocket error');
              break;
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
          setError('Error parsing real-time data');
        }
      };

      wsRef.current.onclose = () => {
        console.log('Real-time analytics WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            connect();
          }
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('WebSocket connection error');
        setIsConnected(false);
      };
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError('Failed to create WebSocket connection');
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setMetrics(null);
  };

  const getDashboardData = async (timeframe: string = '1h') => {
    try {
      const { data, error } = await supabase.functions.invoke('real-time-analytics', {
        body: {
          action: 'get_dashboard_data',
          timeframe
        }
      });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      throw err;
    }
  };

  const publishMetric = async (metricData: any) => {
    try {
      const { data, error } = await supabase.functions.invoke('real-time-analytics', {
        body: {
          action: 'publish_metric',
          metric_data: metricData
        }
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error publishing metric:', err);
      throw err;
    }
  };

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    metrics,
    isConnected,
    error,
    connect,
    disconnect,
    getDashboardData,
    publishMetric
  };
};