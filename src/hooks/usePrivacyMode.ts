import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PrivacyConfig {
  mode_no_bio: boolean;
  blur_faces: boolean;
  blur_bodies: boolean;
  anonymize_audio: boolean;
  retention_hours: number;
  consent_required: boolean;
}

export const usePrivacyMode = () => {
  const [config, setConfig] = useState<PrivacyConfig>({
    mode_no_bio: false,
    blur_faces: true,
    blur_bodies: false,
    anonymize_audio: false,
    retention_hours: 24,
    consent_required: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrivacyConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('key, value')
        .in('key', [
          'CHURCH_MODE_NO_BIO',
          'CHURCH_BLUR_FACES',
          'CHURCH_BLUR_BODIES',
          'CHURCH_ANONYMIZE_AUDIO',
          'CHURCH_RETENTION_HOURS',
          'CHURCH_CONSENT_REQUIRED'
        ]);

      if (error) throw error;

      const configMap = (data || []).reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {} as Record<string, string>);

      setConfig({
        mode_no_bio: configMap.CHURCH_MODE_NO_BIO === 'true',
        blur_faces: configMap.CHURCH_BLUR_FACES !== 'false', // Default true
        blur_bodies: configMap.CHURCH_BLUR_BODIES === 'true',
        anonymize_audio: configMap.CHURCH_ANONYMIZE_AUDIO === 'true',
        retention_hours: parseInt(configMap.CHURCH_RETENTION_HOURS || '24'),
        consent_required: configMap.CHURCH_CONSENT_REQUIRED !== 'false' // Default true
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch privacy config');
    } finally {
      setIsLoading(false);
    }
  };

  const updatePrivacyConfig = async (updates: Partial<PrivacyConfig>) => {
    try {
      const configUpdates = [];

      if (updates.mode_no_bio !== undefined) {
        configUpdates.push({
          key: 'CHURCH_MODE_NO_BIO',
          value: updates.mode_no_bio.toString()
        });
      }

      if (updates.blur_faces !== undefined) {
        configUpdates.push({
          key: 'CHURCH_BLUR_FACES',
          value: updates.blur_faces.toString()
        });
      }

      if (updates.blur_bodies !== undefined) {
        configUpdates.push({
          key: 'CHURCH_BLUR_BODIES',
          value: updates.blur_bodies.toString()
        });
      }

      if (updates.anonymize_audio !== undefined) {
        configUpdates.push({
          key: 'CHURCH_ANONYMIZE_AUDIO',
          value: updates.anonymize_audio.toString()
        });
      }

      if (updates.retention_hours !== undefined) {
        configUpdates.push({
          key: 'CHURCH_RETENTION_HOURS',
          value: updates.retention_hours.toString()
        });
      }

      if (updates.consent_required !== undefined) {
        configUpdates.push({
          key: 'CHURCH_CONSENT_REQUIRED',
          value: updates.consent_required.toString()
        });
      }

      for (const update of configUpdates) {
        const { error } = await supabase
          .from('app_config')
          .upsert([update], { onConflict: 'key' });

        if (error) throw error;
      }

      await fetchPrivacyConfig(); // Refresh config
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update privacy config');
      throw err;
    }
  };

  const enableNoBioMode = async () => {
    await updatePrivacyConfig({
      mode_no_bio: true,
      blur_faces: true,
      blur_bodies: true,
      anonymize_audio: true,
      retention_hours: 1 // Minimal retention in no-bio mode
    });
  };

  const disableNoBioMode = async () => {
    await updatePrivacyConfig({
      mode_no_bio: false,
      blur_faces: false,
      blur_bodies: false,
      anonymize_audio: false,
      retention_hours: 24
    });
  };

  const getPrivacyLevel = (): 'low' | 'medium' | 'high' | 'no_bio' => {
    if (config.mode_no_bio) return 'no_bio';
    if (config.blur_faces && config.blur_bodies && config.anonymize_audio) return 'high';
    if (config.blur_faces) return 'medium';
    return 'low';
  };

  const isCompliant = () => {
    // Check if current config meets basic privacy requirements
    return config.consent_required && (config.blur_faces || config.mode_no_bio);
  };

  useEffect(() => {
    fetchPrivacyConfig();
  }, []);

  return {
    config,
    isLoading,
    error,
    updatePrivacyConfig,
    enableNoBioMode,
    disableNoBioMode,
    getPrivacyLevel,
    isCompliant,
    refresh: fetchPrivacyConfig
  };
};