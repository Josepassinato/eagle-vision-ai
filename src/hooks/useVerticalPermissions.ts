import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VerticalPermission {
  vertical: string;
  hasAccess: boolean;
  subscriptionLevel: 'basic' | 'pro' | 'enterprise';
}

export const useVerticalPermissions = () => {
  const [permissions, setPermissions] = useState<VerticalPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [userVerticals, setUserVerticals] = useState<string[]>([]);

  useEffect(() => {
    fetchUserVerticals();
  }, []);

  const fetchUserVerticals = async () => {
    try {
      setLoading(true);
      
      // Em um sistema real, isso viria da tabela de assinaturas do usuário
      // Por ora, vou simular baseado no user metadata ou uma query
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setPermissions([]);
        setUserVerticals([]);
        return;
      }

      // Mock data - em produção viria do banco de dados
      // baseado na assinatura do usuário
      const mockPermissions: VerticalPermission[] = [
        { vertical: 'church', hasAccess: true, subscriptionLevel: 'pro' },
        { vertical: 'education', hasAccess: true, subscriptionLevel: 'basic' },
        { vertical: 'safety', hasAccess: false, subscriptionLevel: 'basic' },
        { vertical: 'antitheft', hasAccess: true, subscriptionLevel: 'enterprise' },
        { vertical: 'lpr', hasAccess: true, subscriptionLevel: 'pro' }
      ];

      const accessibleVerticals = mockPermissions
        .filter(p => p.hasAccess)
        .map(p => p.vertical);

      setPermissions(mockPermissions);
      setUserVerticals(accessibleVerticals);
    } catch (error) {
      console.error('Error fetching vertical permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccessToVertical = (vertical: string): boolean => {
    return permissions.find(p => p.vertical === vertical)?.hasAccess || false;
  };

  const getSubscriptionLevel = (vertical: string): 'basic' | 'pro' | 'enterprise' => {
    return permissions.find(p => p.vertical === vertical)?.subscriptionLevel || 'basic';
  };

  const getPrimaryVertical = (): string | null => {
    // Retorna o primeiro vertical que o usuário tem acesso
    return userVerticals.length > 0 ? userVerticals[0] : null;
  };

  return {
    permissions,
    userVerticals,
    loading,
    hasAccessToVertical,
    getSubscriptionLevel,
    getPrimaryVertical,
    refreshPermissions: fetchUserVerticals
  };
};