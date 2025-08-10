import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Clock, Users, FileText, Eye, EyeOff, AlertTriangle } from "lucide-react";

interface PrivacySettings {
  id?: string;
  face_blur_enabled: boolean;
  license_plate_blur_enabled: boolean;
  anonymization_mode: string;
  data_minimization: boolean;
  consent_required: boolean;
  compliance_framework: string;
}

interface RetentionPolicy {
  id?: string;
  data_type: string;
  retention_days: number;
  auto_delete: boolean;
  legal_basis: string;
}

interface DataSubjectRequest {
  id?: string;
  request_type: string;
  data_subject_type: string;
  data_subject_id: string;
  requester_email: string;
  requester_name: string;
  description: string;
  status: string;
  response_due_date?: string;
}

export default function PrivacyCompliance() {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    face_blur_enabled: false,
    license_plate_blur_enabled: false,
    anonymization_mode: 'none',
    data_minimization: true,
    consent_required: true,
    compliance_framework: 'LGPD'
  });
  
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [dataRequests, setDataRequests] = useState<DataSubjectRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch privacy settings
      const { data: settings } = await supabase
        .from('privacy_settings')
        .select('*')
        .single();
      
      if (settings) {
        setPrivacySettings(settings);
      }

      // Fetch retention policies
      const { data: policies } = await supabase
        .from('retention_policies')
        .select('*')
        .order('data_type');
      
      if (policies) {
        setRetentionPolicies(policies);
      }

      // Fetch data subject requests
      const { data: requests } = await supabase
        .from('data_subject_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (requests) {
        setDataRequests(requests);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados de privacidade",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePrivacySettings = async () => {
    try {
      // Get current org_id (this would typically come from auth context)
      const { data: orgUsers } = await supabase
        .from('org_users')
        .select('org_id')
        .limit(1)
        .single();

      if (!orgUsers?.org_id) {
        throw new Error('No organization found');
      }

      const { error } = await supabase
        .from('privacy_settings')
        .upsert({
          ...privacySettings,
          org_id: orgUsers.org_id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Configurações de privacidade atualizadas"
      });
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive"
      });
    }
  };

  const updateRetentionPolicy = async (policy: RetentionPolicy) => {
    try {
      // Get current org_id
      const { data: orgUsers } = await supabase
        .from('org_users')
        .select('org_id')
        .limit(1)
        .single();

      if (!orgUsers?.org_id) {
        throw new Error('No organization found');
      }

      const { error } = await supabase
        .from('retention_policies')
        .upsert({
          ...policy,
          org_id: orgUsers.org_id
        });

      if (error) throw error;

      await fetchData();
      toast({
        title: "Sucesso",
        description: "Política de retenção atualizada"
      });
    } catch (error) {
      console.error('Error updating retention policy:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar política de retenção",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/20 text-success border-success/30';
      case 'in_progress': return 'bg-warning/20 text-warning border-warning/30';
      case 'pending': return 'bg-info/20 text-info border-info/30';
      case 'rejected': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <Shield className="h-6 w-6 animate-pulse" />
              <span className="ml-2">Carregando configurações...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Privacidade & Compliance</h1>
          <p className="text-muted-foreground">Configurações LGPD/FERPA e políticas de dados</p>
        </div>
        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
          {privacySettings.compliance_framework}
        </Badge>
      </div>

      <Tabs defaultValue="privacy" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="privacy">Privacidade</TabsTrigger>
          <TabsTrigger value="retention">Retenção</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="privacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Configurações de Privacidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="compliance">Framework de Compliance</Label>
                    <Select 
                      value={privacySettings.compliance_framework}
                      onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, compliance_framework: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LGPD">LGPD (Brasil)</SelectItem>
                        <SelectItem value="FERPA">FERPA (EUA)</SelectItem>
                        <SelectItem value="GDPR">GDPR (Europa)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="anonymization">Modo de Anonimização</Label>
                    <Select 
                      value={privacySettings.anonymization_mode}
                      onValueChange={(value) => setPrivacySettings(prev => ({ ...prev, anonymization_mode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="partial">Parcial</SelectItem>
                        <SelectItem value="full">Completo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Desfocar Faces</Label>
                      <p className="text-sm text-muted-foreground">Anonimizar faces em clips e overlays</p>
                    </div>
                    <Switch
                      checked={privacySettings.face_blur_enabled}
                      onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, face_blur_enabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Desfocar Placas</Label>
                      <p className="text-sm text-muted-foreground">Anonimizar placas de veículos</p>
                    </div>
                    <Switch
                      checked={privacySettings.license_plate_blur_enabled}
                      onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, license_plate_blur_enabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Consentimento Obrigatório</Label>
                      <p className="text-sm text-muted-foreground">Exigir consentimento explícito</p>
                    </div>
                    <Switch
                      checked={privacySettings.consent_required}
                      onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, consent_required: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Minimização de Dados</Label>
                      <p className="text-sm text-muted-foreground">Coletar apenas dados necessários</p>
                    </div>
                    <Switch
                      checked={privacySettings.data_minimization}
                      onCheckedChange={(checked) => setPrivacySettings(prev => ({ ...prev, data_minimization: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={updatePrivacySettings}>
                  <Shield className="h-4 w-4 mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Políticas de Retenção de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {retentionPolicies.map((policy, index) => (
                  <div key={policy.id || index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="font-medium capitalize">{policy.data_type.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        Base legal: {policy.legal_basis}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={policy.retention_days}
                          onChange={(e) => {
                            const updated = [...retentionPolicies];
                            updated[index] = { ...policy, retention_days: parseInt(e.target.value) };
                            setRetentionPolicies(updated);
                          }}
                          className="w-20"
                        />
                        <span className="text-sm">dias</span>
                      </div>
                      <Switch
                        checked={policy.auto_delete}
                        onCheckedChange={(checked) => {
                          const updated = [...retentionPolicies];
                          updated[index] = { ...policy, auto_delete: checked };
                          setRetentionPolicies(updated);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => updateRetentionPolicy(policy)}
                      >
                        Atualizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Solicitações de Titular de Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma solicitação encontrada
                  </div>
                ) : (
                  dataRequests.map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{request.request_type}</span>
                            <Badge className={getStatusColor(request.status)}>
                              {request.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.data_subject_type}: {request.data_subject_id}
                          </div>
                          <div className="text-sm">
                            Solicitante: {request.requester_name} ({request.requester_email})
                          </div>
                          {request.description && (
                            <div className="text-sm">{request.description}</div>
                          )}
                        </div>
                        {request.response_due_date && (
                          <div className="text-sm text-muted-foreground">
                            Prazo: {new Date(request.response_due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Trilha de Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Os logs de auditoria são mantidos conforme as políticas de retenção configuradas.
                  Todas as ações sensíveis são registradas automaticamente.
                </AlertDescription>
              </Alert>
              
              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-4 gap-4 text-sm font-medium border-b pb-2">
                  <span>Ação</span>
                  <span>Recurso</span>
                  <span>Usuário</span>
                  <span>Data</span>
                </div>
                <div className="text-center py-4 text-muted-foreground">
                  Logs de auditoria serão exibidos aqui
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}