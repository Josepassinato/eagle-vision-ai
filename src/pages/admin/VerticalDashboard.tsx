import React from 'react';
import { useVerticalPermissions } from '@/hooks/useVerticalPermissions';
import { PastorDashboard } from '@/components/PastorDashboard';
import { EduBehaviorDashboard } from '@/components/EduBehaviorDashboard';
import { SafetyVisionDashboard } from '@/components/SafetyVisionDashboard';
import { AntitheftDashboard } from '@/components/AntitheftDashboard';
import { LPRDashboard } from '@/components/LPRDashboard';
import { AIIntelligence } from '@/components/AIIntelligence';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Church, 
  GraduationCap, 
  HardHat, 
  ShoppingCart, 
  Car,
  Lock,
  Crown,
  Zap,
  Brain
} from 'lucide-react';

export default function VerticalDashboard() {
  const { 
    userVerticals, 
    loading, 
    hasAccessToVertical, 
    getPrimaryVertical,
    getSubscriptionLevel 
  } = useVerticalPermissions();

  const [selectedVertical, setSelectedVertical] = React.useState<string | null>(null);
  const [dashboardData, setDashboardData] = React.useState<any>(null);

  // Auto-seleciona o primeiro vertical disponível
  React.useEffect(() => {
    if (!selectedVertical && userVerticals.length > 0) {
      setSelectedVertical(getPrimaryVertical());
    }
  }, [userVerticals, selectedVertical, getPrimaryVertical]);

  // Load real dashboard data based on selected vertical
  React.useEffect(() => {
    const loadVerticalData = async () => {
      if (selectedVertical) {
        // In production, this would fetch real data from the backend
        // For now, we'll set to null to show empty states
        setDashboardData(null);
      }
    };
    
    loadVerticalData();
  }, [selectedVertical]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando seus dashboards...</p>
        </div>
      </div>
    );
  }

  if (userVerticals.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Lock className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">Nenhum Dashboard Disponível</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Você não possui acesso a nenhuma vertical específica. Entre em contato com nossa equipe para ativar seus dashboards.
          </p>
          <Button>Falar com Vendas</Button>
        </CardContent>
      </Card>
    );
  }

  const verticalConfig = {
    church: {
      name: 'Vision4Church',
      icon: Church,
      description: 'Dashboard para gestão pastoral e administrativa',
      component: PastorDashboard
    },
    education: {
      name: 'EduBehavior',
      icon: GraduationCap,
      description: 'Analytics comportamental educacional',
      component: EduBehaviorDashboard
    },
    safety: {
      name: 'SafetyVision',
      icon: HardHat,
      description: 'Segurança e conformidade industrial',
      component: SafetyVisionDashboard
    },
    antitheft: {
      name: 'Antifurto Inteligente',
      icon: ShoppingCart,
      description: 'Prevenção de perdas no varejo',
      component: AntitheftDashboard
    },
    lpr: {
      name: 'LPR - Controle de Acesso',
      icon: Car,
      description: 'Leitura de placas e controle veicular',
      component: LPRDashboard
    }
  };

  const getSubscriptionIcon = (level: string) => {
    switch (level) {
      case 'enterprise': return <Crown className="h-4 w-4" />;
      case 'pro': return <Zap className="h-4 w-4" />;
      default: return null;
    }
  };

  const getSubscriptionColor = (level: string) => {
    switch (level) {
      case 'enterprise': return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black';
      case 'pro': return 'bg-gradient-to-r from-blue-500 to-blue-700 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderDashboard = () => {
    if (!selectedVertical) return null;

    const config = verticalConfig[selectedVertical as keyof typeof verticalConfig];
    if (!config) return null;

    const DashboardComponent = config.component;
    return <DashboardComponent />;
  };

  return (
    <div className="space-y-6">
      {/* Header - Seletor de Verticais */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">Dashboard Executivo</h1>
        <p className="text-muted-foreground mb-6">
          Escolha a vertical para visualizar métricas e relatórios específicos
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {userVerticals.map((vertical) => {
            const config = verticalConfig[vertical as keyof typeof verticalConfig];
            if (!config) return null;

            const Icon = config.icon;
            const isSelected = selectedVertical === vertical;
            const subscriptionLevel = getSubscriptionLevel(vertical);

            return (
              <Card 
                key={vertical}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  isSelected 
                    ? 'ring-2 ring-primary bg-primary/5' 
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => setSelectedVertical(vertical)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{config.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    
                    <Badge className={getSubscriptionColor(subscriptionLevel)}>
                      <div className="flex items-center space-x-1">
                        {getSubscriptionIcon(subscriptionLevel)}
                        <span className="capitalize">{subscriptionLevel}</span>
                      </div>
                    </Badge>
                  </div>
                  
                  {isSelected && (
                    <div className="text-xs text-primary font-medium">
                      ← Dashboard ativo
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Dashboard Content */}
      {selectedVertical ? (
        <div className="space-y-8">
          {/* IA Intelligence Section */}
          <AIIntelligence 
            vertical={selectedVertical}
            dashboardData={dashboardData}
            cameraId="cam_001" // Em produção viria do contexto
          />
          
          {/* Dashboard Principal */}
          <div>
            {renderDashboard()}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Selecione uma Vertical</h3>
            <p className="text-muted-foreground">
              Escolha uma das verticais acima para visualizar o dashboard específico
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}