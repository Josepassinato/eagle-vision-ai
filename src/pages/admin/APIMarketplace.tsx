import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  Store, 
  Plug, 
  Code, 
  Shield, 
  Zap, 
  Search, 
  Star, 
  Download, 
  ExternalLink,
  CheckCircle,
  Settings,
  Globe,
  Smartphone
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  rating: number;
  downloads: number;
  price: string;
  developer: string;
  icon: any;
  features: string[];
  installed?: boolean;
  enabled?: boolean;
}

export default function APIMarketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(new Set());

  const plugins: Plugin[] = [
    {
      id: "1",
      name: "WhatsApp Integration",
      description: "Envie alertas e relatórios via WhatsApp Business API",
      category: "notifications",
      version: "2.1.0",
      rating: 4.8,
      downloads: 1250,
      price: "R$ 29/mês",
      developer: "Vision Labs",
      icon: Smartphone,
      features: ["Alertas em tempo real", "Relatórios automáticos", "Comandos por chat", "Múltiplos grupos"]
    },
    {
      id: "2",
      name: "Advanced Analytics",
      description: "Análises preditivas e machine learning avançado",
      category: "analytics",
      version: "1.5.2",
      rating: 4.9,
      downloads: 890,
      price: "R$ 99/mês",
      developer: "AI Insights",
      icon: Zap,
      features: ["Previsão de tendências", "Detecção de anomalias", "Relatórios personalizados", "API completa"]
    },
    {
      id: "3",
      name: "Compliance Suite",
      description: "Ferramentas para conformidade LGPD e auditoria",
      category: "security",
      version: "3.0.1",
      rating: 4.7,
      downloads: 654,
      price: "R$ 149/mês",
      developer: "SecureVision",
      icon: Shield,
      features: ["Auditoria automática", "Relatórios LGPD", "Anonimização", "Logs de acesso"]
    },
    {
      id: "4",
      name: "API Gateway",
      description: "Gateway unificado para todas as integrações",
      category: "integration",
      version: "2.3.0",
      rating: 4.6,
      downloads: 432,
      price: "Gratuito",
      developer: "OpenVision",
      icon: Globe,
      features: ["Rate limiting", "Autenticação", "Logs centralizados", "Webhooks"]
    }
  ];

  const categories = [
    { value: "all", label: "Todos" },
    { value: "notifications", label: "Notificações" },
    { value: "analytics", label: "Analytics" },
    { value: "security", label: "Segurança" },
    { value: "integration", label: "Integração" }
  ];

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleInstall = (pluginId: string) => {
    setInstalledPlugins(prev => new Set([...prev, pluginId]));
    toast({
      title: "Plugin instalado",
      description: "O plugin foi instalado com sucesso"
    });
  };

  const handleToggleEnable = (pluginId: string) => {
    setEnabledPlugins(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pluginId)) {
        newSet.delete(pluginId);
      } else {
        newSet.add(pluginId);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">API Marketplace</h1>
          <p className="text-muted-foreground">Descubra e instale plugins para estender suas funcionalidades</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Store className="h-4 w-4" />
          {plugins.length} Plugins Disponíveis
        </Badge>
      </div>

      <Tabs defaultValue="marketplace" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="installed">Instalados</TabsTrigger>
          <TabsTrigger value="developer">Developer Portal</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplace" className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar plugins..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.value)}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Grid de Plugins */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.map((plugin) => {
              const isInstalled = installedPlugins.has(plugin.id);
              const isEnabled = enabledPlugins.has(plugin.id);
              
              return (
                <Card key={plugin.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <plugin.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{plugin.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm">{plugin.rating}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">{plugin.downloads} downloads</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{plugin.version}</Badge>
                    </div>
                    <CardDescription>{plugin.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Recursos:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {plugin.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <div className="font-semibold">{plugin.price}</div>
                        <div className="text-sm text-muted-foreground">por {plugin.developer}</div>
                      </div>
                      
                      {isInstalled ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => handleToggleEnable(plugin.id)}
                          />
                          <span className="text-sm">{isEnabled ? "Ativo" : "Inativo"}</span>
                        </div>
                      ) : (
                        <Button onClick={() => handleInstall(plugin.id)}>
                          <Download className="h-4 w-4 mr-2" />
                          Instalar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="installed" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plugins Instalados</CardTitle>
              <CardDescription>Gerencie seus plugins ativos</CardDescription>
            </CardHeader>
            <CardContent>
              {installedPlugins.size === 0 ? (
                <div className="text-center py-8">
                  <Plug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum plugin instalado</h3>
                  <p className="text-muted-foreground">Explore o marketplace para encontrar plugins úteis</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Array.from(installedPlugins).map(pluginId => {
                    const plugin = plugins.find(p => p.id === pluginId);
                    if (!plugin) return null;
                    
                    const isEnabled = enabledPlugins.has(pluginId);
                    
                    return (
                      <div key={pluginId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <plugin.icon className="h-8 w-8 text-primary" />
                          <div>
                            <h4 className="font-semibold">{plugin.name}</h4>
                            <p className="text-sm text-muted-foreground">{plugin.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={isEnabled ? "default" : "secondary"}>
                            {isEnabled ? "Ativo" : "Inativo"}
                          </Badge>
                          <Switch
                            checked={isEnabled}
                            onCheckedChange={() => handleToggleEnable(pluginId)}
                          />
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="developer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                Developer Portal
              </CardTitle>
              <CardDescription>Documentação e recursos para desenvolvedores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">API Documentation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Documentação completa da API com exemplos
                    </p>
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ver Documentação
                    </Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">SDK & Tools</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      SDKs em Python, JavaScript e outras linguagens
                    </p>
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download SDK
                    </Button>
                  </CardContent>
                </Card>
              </div>
              
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Publique seu Plugin</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Compartilhe suas soluções com a comunidade e monetize seus plugins
                </p>
                <Button>
                  <Plug className="h-4 w-4 mr-2" />
                  Começar Desenvolvimento
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}