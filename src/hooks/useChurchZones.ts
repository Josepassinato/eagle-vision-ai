import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChurchZone {
  id: string;
  camera_id: string;
  zone_type: 'altar' | 'corridor' | 'entrance' | 'exit' | 'restricted';
  zone_name: string;
  polygon: Array<{ x: number; y: number }>;
  is_active: boolean;
  counting_enabled: boolean;
  privacy_level: 'normal' | 'high' | 'no_bio';
  created_at: string;
  updated_at: string;
}

export const useChurchZones = (cameraId?: string) => {
  const [zones, setZones] = useState<ChurchZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchZones = async () => {
    try {
      let query = supabase
        .from('church_zones')
        .select('*')
        .order('created_at', { ascending: false });

      if (cameraId) {
        query = query.eq('camera_id', cameraId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setZones((data || []).map(item => ({
        ...item,
        zone_type: item.zone_type as ChurchZone['zone_type'],
        privacy_level: item.privacy_level as ChurchZone['privacy_level'],
        polygon: (item.polygon as Array<{ x: number; y: number }>) || []
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch church zones');
    } finally {
      setIsLoading(false);
    }
  };

  const createZone = async (zoneData: Omit<ChurchZone, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('church_zones')
        .insert([zoneData])
        .select()
        .single();

      if (error) throw error;
      await fetchZones(); // Refresh zones
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create zone');
      throw err;
    }
  };

  const updateZone = async (id: string, updates: Partial<ChurchZone>) => {
    try {
      const { data, error } = await supabase
        .from('church_zones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      await fetchZones(); // Refresh zones
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update zone');
      throw err;
    }
  };

  const deleteZone = async (id: string) => {
    try {
      const { error } = await supabase
        .from('church_zones')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchZones(); // Refresh zones
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete zone');
      throw err;
    }
  };

  const getZonesByType = (zoneType: ChurchZone['zone_type']) => {
    return zones.filter(zone => zone.zone_type === zoneType);
  };

  const getActiveZones = () => {
    return zones.filter(zone => zone.is_active);
  };

  const getCountingZones = () => {
    return zones.filter(zone => zone.counting_enabled);
  };

  const createDefaultZones = async (cameraId: string) => {
    const defaultZones = [
      {
        camera_id: cameraId,
        zone_type: 'entrance' as const,
        zone_name: 'Entrada Principal',
        polygon: [
          { x: 0.1, y: 0.1 },
          { x: 0.4, y: 0.1 },
          { x: 0.4, y: 0.3 },
          { x: 0.1, y: 0.3 }
        ],
        is_active: true,
        counting_enabled: true,
        privacy_level: 'normal' as const
      },
      {
        camera_id: cameraId,
        zone_type: 'altar' as const,
        zone_name: 'Área do Altar',
        polygon: [
          { x: 0.3, y: 0.6 },
          { x: 0.7, y: 0.6 },
          { x: 0.7, y: 0.9 },
          { x: 0.3, y: 0.9 }
        ],
        is_active: true,
        counting_enabled: false,
        privacy_level: 'high' as const
      },
      {
        camera_id: cameraId,
        zone_type: 'corridor' as const,
        zone_name: 'Corredor Central',
        polygon: [
          { x: 0.4, y: 0.2 },
          { x: 0.6, y: 0.2 },
          { x: 0.6, y: 0.8 },
          { x: 0.4, y: 0.8 }
        ],
        is_active: true,
        counting_enabled: true,
        privacy_level: 'normal' as const
      }
    ];

    try {
      const { data, error } = await supabase
        .from('church_zones')
        .insert(defaultZones)
        .select();

      if (error) throw error;
      await fetchZones(); // Refresh zones
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create default zones');
      throw err;
    }
  };

  useEffect(() => {
    fetchZones();
  }, [cameraId]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('church-zones')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'church_zones',
          filter: cameraId ? `camera_id=eq.${cameraId}` : undefined
        }, 
        () => fetchZones()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cameraId]);

  return {
    zones,
    isLoading,
    error,
    createZone,
    updateZone,
    deleteZone,
    getZonesByType,
    getActiveZones,
    getCountingZones,
    createDefaultZones,
    refresh: fetchZones
  };
};