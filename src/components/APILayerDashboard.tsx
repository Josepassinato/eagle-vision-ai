import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw, Server, Database, Users, Activity, Clock, Eye } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  api_key: string;
  is_active: boolean;
  created_at: string;
}

interface OccupancyData {
  zones: Array<{
    camera_id: string;
    zone_name: string;
    current_count: number;
    last_updated: string;
  }>;
  total_occupancy: number;
  active_services: Array<{
    id: string;
    name: string;
    start_time: string;
  }>;
}

const APILayerDashboard = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [occupancyData, setOccupancyData] = useState<OccupancyData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newTenantName, setNewTenantName] = useState("");

  // Test event data
  const [testEvent, setTestEvent] = useState({
    camera_id: "cam_001",
    event_type: "entry",
    confidence: 0.85,
    person_count: 5,
    zone_name: "main_entrance"
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
      if (data && data.length > 0 && !selectedTenant) {
        setSelectedTenant(data[0]);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar tenants');
    }
  };

  const createTenant = async () => {
    if (!newTenantName.trim()) {
      toast.error('Nome do tenant é obrigatório');
      return;
    }

    try {
      setIsLoading(true);
      const apiKey = `vsk_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      
      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: newTenantName,
          api_key: apiKey,
          subdomain: newTenantName.toLowerCase().replace(/\s+/g, '-')
        })
        .select()
        .single();

      if (error) throw error;

      setTenants(prev => [data, ...prev]);
      setNewTenantName("");
      toast.success('Tenant criado com sucesso');
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('Erro ao criar tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const testEventIngestion = async () => {
    if (!selectedTenant) {
      toast.error('Selecione um tenant primeiro');
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('api-v1-events', {
        body: testEvent,
        headers: {
          'x-api-key': selectedTenant.api_key
        }
      });

      if (error) throw error;

      toast.success(`Evento ingerido com sucesso em ${data.processing_time_ms}ms`);
    } catch (error) {
      console.error('Error testing event ingestion:', error);
      toast.error('Erro ao testar ingestão de eventos');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLiveOccupancy = async () => {
    if (!selectedTenant) {
      toast.error('Selecione um tenant primeiro');
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('api-v1-occupancy', {
        headers: {
          'x-api-key': selectedTenant.api_key
        }
      });

      if (error) throw error;

      setOccupancyData(data);
      toast.success('Ocupação atualizada');
    } catch (error) {
      console.error('Error fetching occupancy:', error);
      toast.error('Erro ao buscar ocupação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API & Data Layer</h1>
          <p className="text-muted-foreground">
            Cloud Run + Cloud SQL + Cloud Storage
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <Server className="w-4 h-4" />
          FastAPI Endpoints
        </Badge>
      </div>

      <Tabs defaultValue="tenants" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="events">Events API</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy API</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Tenant Management
              </CardTitle>
              <CardDescription>
                Gerencie tenants e chaves de API para isolamento de dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome do novo tenant"
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  onClick={createTenant} 
                  disabled={isLoading}
                  className="shrink-0"
                >
                  Criar Tenant
                </Button>
              </div>

              <div className="grid gap-4">
                {tenants.map((tenant) => (
                  <Card 
                    key={tenant.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedTenant?.id === tenant.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedTenant(tenant)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{tenant.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            API Key: {tenant.api_key.substring(0, 20)}...
                          </p>
                        </div>
                        <Badge variant={tenant.is_active ? "default" : "secondary"}>
                          {tenant.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Events API Testing
              </CardTitle>
              <CardDescription>
                POST /v1/events - Teste de ingestão de eventos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedTenant && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium">Tenant Selecionado:</Label>
                  <p className="text-sm">{selectedTenant.name}</p>
                  <p className="text-xs text-muted-foreground">
                    API Key: {selectedTenant.api_key.substring(0, 30)}...
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Camera ID</Label>
                  <Input
                    value={testEvent.camera_id}
                    onChange={(e) => setTestEvent(prev => ({...prev, camera_id: e.target.value}))}
                  />
                </div>
                <div>
                  <Label>Event Type</Label>
                  <Input
                    value={testEvent.event_type}
                    onChange={(e) => setTestEvent(prev => ({...prev, event_type: e.target.value}))}
                  />
                </div>
                <div>
                  <Label>Confidence</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={testEvent.confidence}
                    onChange={(e) => setTestEvent(prev => ({...prev, confidence: parseFloat(e.target.value)}))}
                  />
                </div>
                <div>
                  <Label>Person Count</Label>
                  <Input
                    type="number"
                    value={testEvent.person_count}
                    onChange={(e) => setTestEvent(prev => ({...prev, person_count: parseInt(e.target.value)}))}
                  />
                </div>
              </div>

              <Button 
                onClick={testEventIngestion}
                disabled={isLoading || !selectedTenant}
                className="w-full"
              >
                {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Testar Ingestão de Evento
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Live Occupancy
              </CardTitle>
              <CardDescription>
                GET /v1/occupancy/live - Ocupação em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={fetchLiveOccupancy}
                disabled={isLoading || !selectedTenant}
                className="w-full"
              >
                {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                Buscar Ocupação Atual
              </Button>

              {occupancyData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{occupancyData.total_occupancy}</div>
                        <p className="text-sm text-muted-foreground">Ocupação Total</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-2xl font-bold">{occupancyData.active_services.length}</div>
                        <p className="text-sm text-muted-foreground">Serviços Ativos</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Ocupação por Zona</h4>
                    <div className="grid gap-2">
                      {occupancyData.zones.map((zone, index) => (
                        <Card key={index}>
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{zone.zone_name}</p>
                                <p className="text-sm text-muted-foreground">{zone.camera_id}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold">{zone.current_count}</div>
                                <p className="text-xs text-muted-foreground">
                                  {zone.last_updated ? new Date(zone.last_updated).toLocaleTimeString() : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">API Response Time</span>
                </div>
                <div className="text-2xl font-bold">&lt; 300ms</div>
                <p className="text-xs text-muted-foreground">p95 latency target</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Event Throughput</span>
                </div>
                <div className="text-2xl font-bold">200+</div>
                <p className="text-xs text-muted-foreground">events/min capacity</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Data Retention</span>
                </div>
                <div className="text-2xl font-bold">30d</div>
                <p className="text-xs text-muted-foreground">auto cleanup</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
              <CardDescription>Documentação dos endpoints disponíveis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <code className="text-sm">POST /v1/events</code>
                    <p className="text-xs text-muted-foreground">Ingestão de eventos do edge e Vertex AI</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <code className="text-sm">GET /v1/services/&#123;id&#125;/summary</code>
                    <p className="text-xs text-muted-foreground">Resumo completo do culto/serviço</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <code className="text-sm">GET /v1/occupancy/live</code>
                    <p className="text-xs text-muted-foreground">Ocupação ao vivo por zona/porta</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <code className="text-sm">POST /v1/visitors/checkin</code>
                    <p className="text-xs text-muted-foreground">Check-in via QR/NFC</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <code className="text-sm">POST /v1/members/import</code>
                    <p className="text-xs text-muted-foreground">Importação de membros com opt-in</p>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default APILayerDashboard;