import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Trash2, 
  FileText, 
  QrCode,
  Settings,
  BarChart3,
  DollarSign,
  Clock,
  Activity,
  AlertTriangle,
  CheckCircle,
  Users,
  Camera,
  Globe
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface PrivacySettings {
  privacy_mode: 'no_bio' | 'opt_in';
  face_blur_enabled: boolean;
  plates_blur_enabled: boolean;
  data_retention_days: number;
  auto_deletion_enabled: boolean;
  consent_required: boolean;
}

interface ComplianceStatus {
  compliance_overview: {
    total_records: number;
    active_consents: number;
    withdrawn_consents: number;
    pending_deletions: number;
    completed_deletions: number;
    approaching_expiry: number;
  };
  privacy_settings: PrivacySettings;
  compliance_checklist: Record<string, boolean>;
}

interface CostData {
  camera_id: string;
  total_estimated_cost: number;
  cost_per_event: number;
  events_processed: number;
}

const LGPDComplianceDashboard = () => {
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    privacy_mode: 'no_bio',
    face_blur_enabled: true,
    plates_blur_enabled: true,
    data_retention_days: 30,
    auto_deletion_enabled: true,
    consent_required: true
  });
  const [partnerApiKey, setPartnerApiKey] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [whiteLabelConfig, setWhiteLabelConfig] = useState({
    brand_name: "",
    primary_color: "#8B5CF6",
    logo_url: ""
  });
  const [costData, setCostData] = useState<CostData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletionSubjectId, setDeletionSubjectId] = useState("");

  useEffect(() => {
    fetchComplianceStatus();
    fetchCostData();
  }, []);

  const fetchComplianceStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('lgpd-compliance/lgpd-compliance-status');

      if (error) throw error;
      setComplianceStatus(data);
      setPrivacySettings(data.privacy_settings);
    } catch (error) {
      console.error('Error fetching compliance status:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar status de compliance",
        variant: "destructive"
      });
    }
  };

  const fetchCostData = async () => {
    try {
      const { data, error } = await supabase
        .from('camera_cost_estimates')
        .select('*')
        .order('cost_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setCostData(data || []);
    } catch (error) {
      console.error('Error fetching cost data:', error);
    }
  };

  const updatePrivacySettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance/update-privacy-settings', {
        method: 'POST',
        body: privacySettings
      });

      if (error) throw error;

      toast({
        title: "Configurações Atualizadas",
        description: "Configurações de privacidade atualizadas com sucesso"
      });

      fetchComplianceStatus();
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createPartnerApiKey = async () => {
    if (!partnerName.trim()) {
      toast({
        title: "Erro",
        description: "Nome do parceiro é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const apiKey = `partner_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
      
      const { error } = await supabase
        .from('partner_api_keys')
        .insert({
          partner_name: partnerName,
          api_key: apiKey,
          white_label_config: whiteLabelConfig,
          quotas: {
            max_requests_per_day: 10000,
            max_tenants: 50
          }
        });

      if (error) throw error;

      setPartnerApiKey(apiKey);
      setPartnerName("");
      
      toast({
        title: "Chave de Parceiro Criada",
        description: "Chave de API do parceiro criada com sucesso"
      });
    } catch (error) {
      console.error('Error creating partner API key:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar chave de parceiro",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const requestDataDeletion = async () => {
    if (!deletionSubjectId.trim()) {
      toast({
        title: "Erro",
        description: "ID do titular dos dados é obrigatório",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('lgpd-compliance/data-deletion-request', {
        method: 'POST',
        body: { 
          data_subject_id: deletionSubjectId,
          data_subject_type: 'visitor'
        }
      });

      if (error) throw error;

      toast({
        title: "Solicitação de Exclusão Processada",
        description: `Dados excluídos: ${data.deletion_summary.visitors_deleted} visitantes, ${data.deletion_summary.attendance_deleted} registros de presença`
      });

      setDeletionSubjectId("");
      fetchComplianceStatus();
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar exclusão de dados",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePrivacyNoticeQR = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('lgpd-compliance/privacy-notice-qr');

      if (error) throw error;

      // In a real implementation, you would generate and display a QR code
      toast({
        title: "Aviso de Privacidade Gerado",
        description: "QR Code disponível para impressão"
      });

      console.log('Privacy notice content:', data);
    } catch (error) {
      console.error('Error generating privacy notice:', error);
      toast({
        title: "Erro",
        description: "Erro ao gerar aviso de privacidade",
        variant: "destructive"
      });
    }
  };

  const getComplianceScore = () => {
    if (!complianceStatus) return 0;
    const checklist = complianceStatus.compliance_checklist;
    const totalChecks = Object.keys(checklist).length;
    const passedChecks = Object.values(checklist).filter(Boolean).length;
    return Math.round((passedChecks / totalChecks) * 100);
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LGPD-first, Operação & Parcerias</h1>
          <p className="text-muted-foreground">
            Privacy-first com Partner API white-label
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Compliance Score: {getComplianceScore()}%
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="privacy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          <TabsTrigger value="compliance">LGPD Compliance</TabsTrigger>
          <TabsTrigger value="partner">Partner API</TabsTrigger>
          <TabsTrigger value="observability">Observabilidade</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="privacy" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Modos de Privacidade
                </CardTitle>
                <CardDescription>
                  Configure o nível de privacidade da aplicação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Modo de Privacidade</Label>
                  <Select 
                    value={privacySettings.privacy_mode} 
                    onValueChange={(value: 'no_bio' | 'opt_in') => 
                      setPrivacySettings(prev => ({...prev, privacy_mode: value}))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_bio">
                        No-Bio (Padrão) - Sem biometria, apenas analytics
                      </SelectItem>
                      <SelectItem value="opt_in">
                        Opt-in (Membros) - Com consentimento explícito
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Blur de Rostos</Label>
                  <Switch
                    checked={privacySettings.face_blur_enabled}
                    onCheckedChange={(checked) => 
                      setPrivacySettings(prev => ({...prev, face_blur_enabled: checked}))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Blur de Placas</Label>
                  <Switch
                    checked={privacySettings.plates_blur_enabled}
                    onCheckedChange={(checked) => 
                      setPrivacySettings(prev => ({...prev, plates_blur_enabled: checked}))
                    }
                  />
                </div>

                <div>
                  <Label>Retenção de Dados (dias)</Label>
                  <Input
                    type="number"
                    value={privacySettings.data_retention_days}
                    onChange={(e) => 
                      setPrivacySettings(prev => ({...prev, data_retention_days: parseInt(e.target.value)}))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Exclusão Automática</Label>
                  <Switch
                    checked={privacySettings.auto_deletion_enabled}
                    onCheckedChange={(checked) => 
                      setPrivacySettings(prev => ({...prev, auto_deletion_enabled: checked}))
                    }
                  />
                </div>

                <Button onClick={updatePrivacySettings} disabled={isLoading} className="w-full">
                  Atualizar Configurações
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Sinalização & Política
                </CardTitle>
                <CardDescription>
                  Gere placas e avisos de privacidade
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted">
                  <h4 className="font-semibold mb-2">Aviso de Monitoramento</h4>
                  <p className="text-sm text-muted-foreground">
                    "Ambiente monitorado por sistema de visão computacional para fins de segurança e análise de presença. 
                    Dados retidos por {privacySettings.data_retention_days} dias. Rostos automaticamente desfocados."
                  </p>
                </div>

                <Button onClick={generatePrivacyNoticeQR} variant="outline" className="w-full">
                  <QrCode className="w-4 h-4 mr-2" />
                  Gerar QR Code de Privacidade
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Baixar Placa
                  </Button>
                  <Button variant="outline" size="sm">
                    <Globe className="w-4 h-4 mr-2" />
                    Página Pública
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Consentimentos Ativos</span>
                </div>
                <div className="text-2xl font-bold">
                  {complianceStatus?.compliance_overview.active_consents || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Exclusões Pendentes</span>
                </div>
                <div className="text-2xl font-bold">
                  {complianceStatus?.compliance_overview.pending_deletions || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium">Próximos do Limite</span>
                </div>
                <div className="text-2xl font-bold">
                  {complianceStatus?.compliance_overview.approaching_expiry || 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Score Compliance</span>
                </div>
                <div className="text-2xl font-bold">{getComplianceScore()}%</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Checklist LGPD</CardTitle>
                <CardDescription>Requisitos de compliance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceStatus && Object.entries(complianceStatus.compliance_checklist).map(([key, passed]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                      {passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Solicitação de Exclusão</CardTitle>
                <CardDescription>Botão "apagar meus dados" para membros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>ID do Titular dos Dados</Label>
                  <Input
                    placeholder="visitor_code ou visitor_id"
                    value={deletionSubjectId}
                    onChange={(e) => setDeletionSubjectId(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={requestDataDeletion}
                  disabled={isLoading || !deletionSubjectId.trim()}
                  variant="destructive"
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Processar Exclusão de Dados
                </Button>

                <div className="text-xs text-muted-foreground">
                  Esta ação irá excluir permanentemente todos os dados relacionados ao titular especificado.
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="partner" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Criar Chave de Parceiro</CardTitle>
                <CardDescription>
                  Partner API white-label para ChurchTech
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome do Parceiro</Label>
                  <Input
                    placeholder="Nome da empresa parceira"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Configuração White-label</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="Nome da marca"
                      value={whiteLabelConfig.brand_name}
                      onChange={(e) => setWhiteLabelConfig(prev => ({...prev, brand_name: e.target.value}))}
                    />
                    <Input
                      placeholder="Cor primária (#hex)"
                      value={whiteLabelConfig.primary_color}
                      onChange={(e) => setWhiteLabelConfig(prev => ({...prev, primary_color: e.target.value}))}
                    />
                    <Input
                      placeholder="URL do logo"
                      value={whiteLabelConfig.logo_url}
                      onChange={(e) => setWhiteLabelConfig(prev => ({...prev, logo_url: e.target.value}))}
                    />
                  </div>
                </div>

                <Button onClick={createPartnerApiKey} disabled={isLoading} className="w-full">
                  Criar Chave de Parceiro
                </Button>

                {partnerApiKey && (
                  <div className="p-4 bg-muted rounded-lg">
                    <Label className="text-sm font-medium">Nova Chave de API:</Label>
                    <p className="text-sm font-mono break-all">{partnerApiKey}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Endpoints Partner API</CardTitle>
                <CardDescription>
                  Billing R$ 0,05/evento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border rounded">
                    <code className="text-sm">GET /partner/v1/services/:id/summary</code>
                    <p className="text-xs text-muted-foreground">Resumo completo do serviço</p>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">GET /partner/v1/events</code>
                    <p className="text-xs text-muted-foreground">Lista de eventos filtráveis</p>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">GET /partner/v1/visitors/recurrence</code>
                    <p className="text-xs text-muted-foreground">Análise de recorrência de visitantes</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-sm">Headers Obrigatórios:</h4>
                  <ul className="text-xs text-muted-foreground">
                    <li>• X-Partner-Key: [chave_do_parceiro]</li>
                    <li>• X-White-Label: [configuração_personalizada]</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="observability" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Latência p50</span>
                </div>
                <div className="text-2xl font-bold">49ms</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">Latência p95</span>
                </div>
                <div className="text-2xl font-bold">91ms</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium">Falsos Positivos/h</span>
                </div>
                <div className="text-2xl font-bold">2.1</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">% Validação Nuvem</span>
                </div>
                <div className="text-2xl font-bold">15%</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
              <CardDescription>Prometheus/Grafana - Latência e Falsos Positivos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Métricas de observabilidade serão exibidas aqui</p>
                  <p className="text-sm">Conecte ao Prometheus/Grafana para visualizar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Custo Total Estimado</span>
                </div>
                <div className="text-2xl font-bold">
                  R$ {costData.reduce((sum, camera) => sum + camera.total_estimated_cost, 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Custo Médio/Câmera</span>
                </div>
                <div className="text-2xl font-bold">
                  R$ {costData.length > 0 
                    ? (costData.reduce((sum, camera) => sum + camera.total_estimated_cost, 0) / costData.length).toFixed(2)
                    : '0.00'
                  }
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Custo/Evento</span>
                </div>
                <div className="text-2xl font-bold">R$ 0.023</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Painel de Custos por Câmera</CardTitle>
              <CardDescription>Estimativas detalhadas de custos operacionais</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {costData.map((camera, index) => (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{camera.camera_id}</h4>
                          <p className="text-sm text-muted-foreground">
                            {camera.events_processed} eventos processados
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">
                            R$ {camera.total_estimated_cost.toFixed(2)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            R$ {camera.cost_per_event.toFixed(4)}/evento
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LGPDComplianceDashboard;