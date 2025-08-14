import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  ShoppingCart, 
  Factory, 
  Heart, 
  GraduationCap,
  Building,
  Car,
  Shield,
  Settings,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Users
} from "lucide-react";

interface VerticalConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  features: string[];
  compliance: string[];
  integrations: string[];
  enabled: boolean;
  setupProgress: number;
}

export default function IndustryVerticals() {
  const [verticals, setVerticals] = useState<VerticalConfig[]>([
    {
      id: "retail",
      name: "Varejo & E-commerce",
      description: "Soluções especializadas para comércio e varejo",
      icon: ShoppingCart,
      color: "text-blue-600",
      features: [
        "Análise de comportamento do cliente",
        "Detecção de furtos",
        "Heatmaps de tráfego",
        "Controle de filas",
        "Análise demográfica"
      ],
      compliance: ["LGPD", "PCI DSS"],
      integrations: ["PDV", "ERP", "CRM"],
      enabled: true,
      setupProgress: 85
    },
    {
      id: "manufacturing",
      name: "Indústria & Manufatura",
      description: "Otimização para ambientes industriais",
      icon: Factory,
      color: "text-orange-600",
      features: [
        "Monitoramento de EPI",
        "Detecção de acidentes",
        "Controle de qualidade",
        "Eficiência operacional",
        "Auditoria de segurança"
      ],
      compliance: ["ISO 45001", "OHSAS 18001"],
      integrations: ["MES", "SCADA", "ERP"],
      enabled: false,
      setupProgress: 45
    },
    {
      id: "healthcare",
      name: "Saúde & Hospitais",
      description: "Conformidade e segurança em ambientes de saúde",
      icon: Heart,
      color: "text-red-600",
      features: [
        "Controle de acesso HIPAA",
        "Monitoramento de higiene",
        "Rastreamento de equipamentos",
        "Análise de fluxo de pacientes",
        "Detecção de quedas"
      ],
      compliance: ["HIPAA", "ANVISA", "LGPD"],
      integrations: ["HIS", "PACS", "EMR"],
      enabled: false,
      setupProgress: 30
    },
    {
      id: "education",
      name: "Educação",
      description: "Soluções para instituições de ensino",
      icon: GraduationCap,
      color: "text-green-600",
      features: [
        "Análise comportamental",
        "Detecção de bullying",
        "Controle de presença",
        "Segurança escolar",
        "Monitoramento de atenção"
      ],
      compliance: ["LGPD", "ECA"],
      integrations: ["LMS", "SIS", "Biblioteca"],
      enabled: true,
      setupProgress: 70
    },
    {
      id: "office",
      name: "Escritórios Corporativos",
      description: "Gestão inteligente de espaços corporativos",
      icon: Building,
      color: "text-purple-600",
      features: [
        "Ocupação de espaços",
        "Controle de acesso",
        "Análise de produtividade",
        "Gestão de recursos",
        "Compliance corporativo"
      ],
      compliance: ["LGPD", "SOX"],
      integrations: ["AD", "HR", "Facilities"],
      enabled: false,
      setupProgress: 60
    },
    {
      id: "transportation",
      name: "Transporte & Logística",
      description: "Otimização de operações de transporte",
      icon: Car,
      color: "text-indigo-600",
      features: [
        "Rastreamento de veículos",
        "Análise de rotas",
        "Detecção de fadiga",
        "Controle de carga",
        "Gestão de frota"
      ],
      compliance: ["ANTT", "CONTRAN"],
      integrations: ["TMS", "WMS", "GPS"],
      enabled: false,
      setupProgress: 20
    }
  ]);

  const enabledVerticals = verticals.filter(v => v.enabled);
  const totalSetupProgress = verticals.reduce((sum, v) => sum + (v.enabled ? v.setupProgress : 0), 0) / enabledVerticals.length || 0;

  const handleToggleVertical = (verticalId: string) => {
    setVerticals(prev => prev.map(v => 
      v.id === verticalId ? { ...v, enabled: !v.enabled } : v
    ));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Verticais da Indústria</h1>
          <p className="text-muted-foreground">Configure soluções específicas para seu setor</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {enabledVerticals.length} Ativas
          </Badge>
          <Badge variant="outline" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {Math.round(totalSetupProgress)}% Configurado
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="configuration">Configuração</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {verticals.map((vertical) => (
              <Card key={vertical.id} className={`transition-all ${vertical.enabled ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 bg-primary/10 rounded-lg`}>
                        <vertical.icon className={`h-6 w-6 ${vertical.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{vertical.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={vertical.setupProgress} className="w-20 h-2" />
                          <span className="text-sm text-muted-foreground">{vertical.setupProgress}%</span>
                        </div>
                      </div>
                    </div>
                    <Switch
                      checked={vertical.enabled}
                      onCheckedChange={() => handleToggleVertical(vertical.id)}
                    />
                  </div>
                  <CardDescription>{vertical.description}</CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Funcionalidades:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {vertical.features.slice(0, 3).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                      {vertical.features.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{vertical.features.length - 3} mais...
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Compliance:</h4>
                    <div className="flex flex-wrap gap-1">
                      {vertical.compliance.map((comp) => (
                        <Badge key={comp} variant="secondary" className="text-xs">
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Integrações:</h4>
                    <div className="flex flex-wrap gap-1">
                      {vertical.integrations.map((integration) => (
                        <Badge key={integration} variant="outline" className="text-xs">
                          {integration}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {vertical.enabled && (
                    <Button variant="outline" className="w-full" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {enabledVerticals.map((vertical) => (
              <Card key={vertical.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <vertical.icon className={`h-5 w-5 ${vertical.color}`} />
                    {vertical.name}
                  </CardTitle>
                  <CardDescription>
                    Progresso da configuração: {vertical.setupProgress}%
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={vertical.setupProgress} className="w-full" />
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Configuração básica</span>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Integrações</span>
                      {vertical.setupProgress > 50 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Compliance</span>
                      {vertical.setupProgress > 80 ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                  
                  <Button className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Detalhes
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Verticais Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{enabledVerticals.length}</div>
                <p className="text-sm text-muted-foreground">de {verticals.length} disponíveis</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Configuração Média</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Math.round(totalSetupProgress)}%</div>
                <p className="text-sm text-muted-foreground">progresso geral</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Integrações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {enabledVerticals.reduce((sum, v) => sum + v.integrations.length, 0)}
                </div>
                <p className="text-sm text-muted-foreground">conectadas</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Compliance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {new Set(enabledVerticals.flatMap(v => v.compliance)).size}
                </div>
                <p className="text-sm text-muted-foreground">padrões ativos</p>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Performance por Vertical</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enabledVerticals.map((vertical) => (
                  <div key={vertical.id} className="flex items-center gap-4">
                    <vertical.icon className={`h-5 w-5 ${vertical.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{vertical.name}</span>
                        <span className="text-sm text-muted-foreground">{vertical.setupProgress}%</span>
                      </div>
                      <Progress value={vertical.setupProgress} className="h-2" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}