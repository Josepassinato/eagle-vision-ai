import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PredictionModel {
  id: string;
  model_name: string;
  model_type: string;
  model_version: string;
  accuracy_score?: number;
  status: 'training' | 'active' | 'deprecated';
}

interface Prediction {
  model_name: string;
  model_type: string;
  value: number;
  confidence: number;
  timeframe: string;
  camera_id?: string;
  metadata: any;
}

interface PredictionSummary {
  total_predictions: number;
  high_confidence: number;
  avg_confidence: number;
  risk_alerts: number;
  crowd_alerts: number;
}

export const usePredictiveAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createModel = async (modelConfig: {
    model_name: string;
    model_type: string;
    parameters: Record<string, any>;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('predictive-analytics', {
        body: {
          action: 'create_model',
          model_config: modelConfig
        }
      });

      if (error) throw error;
      return data.model;
    } catch (err: any) {
      setError(err.message || 'Failed to create model');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getPredictions = async (params?: {
    timeframe?: string;
    confidence_threshold?: number;
    cameras?: string[];
  }): Promise<{ predictions: Prediction[]; summary: PredictionSummary }> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('predictive-analytics', {
        body: {
          action: 'get_predictions',
          prediction_params: params
        }
      });

      if (error) throw error;
      return {
        predictions: data.predictions,
        summary: data.summary
      };
    } catch (err: any) {
      setError(err.message || 'Failed to get predictions');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const trainModel = async (modelConfig: {
    model_name: string;
    model_type: string;
    parameters: Record<string, any>;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('predictive-analytics', {
        body: {
          action: 'train_model',
          model_config: modelConfig
        }
      });

      if (error) throw error;
      return data.training_job;
    } catch (err: any) {
      setError(err.message || 'Failed to start training');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validatePrediction = async (validationData: {
    prediction_id: string;
    actual_value: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('predictive-analytics', {
        body: {
          action: 'validate_prediction',
          validation_data: validationData
        }
      });

      if (error) throw error;
      return data.validation;
    } catch (err: any) {
      setError(err.message || 'Failed to validate prediction');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createModel,
    getPredictions,
    trainModel,
    validatePrediction
  };
};