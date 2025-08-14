import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Building2, 
  MessageSquare, 
  Webhook, 
  Shield, 
  Plus, 
  Play, 
  Pause, 
  Settings, 
  TestTube, 
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  BarChart3,
  Users,
  Key
} from 'lucide-react';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  method: string;
  event_types: string[];
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
}

interface IntegrationConfig {
  id: string;
  integration_type: string;
  name: string;
  is_active: boolean;
  sync_status: string;
  last_sync_at: string | null;
  sync_error: string | null;
}

interface SSOConfig {
  id: string;
  provider_name: string;
  provider_type: string;
  sso_url: string;
  is_active: boolean;
  auto_provision: boolean;
  default_role: string;
}

interface NotificationChannel {
  id: string;
  channel_type: string;
  channel_name: string;
  notification_types: string[];
  is_active: boolean;
}

const EnterpriseIntegrations: React.FC = () => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [ssoConfigs, setSsoConfigs] = useState<SSOConfig[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('teams-slack');

  // Teams/Slack form states
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationUrgency, setNotificationUrgency] = useState('normal');

  // Webhook form states
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState('POST');
  const [webhookEventTypes, setWebhookEventTypes] = useState<string[]>([]);

  // CRM form states
  const [crmType, setCrmType] = useState('salesforce');
  const [crmName, setCrmName] = useState('');
  const [crmApiKey, setCrmApiKey] = useState('');
  const [crmInstanceUrl, setCrmInstanceUrl] = useState('');

  // SSO form states
  const [ssoProviderName, setSsoProviderName] = useState('');
  const [ssoProviderType, setSsoProviderType] = useState('saml');
  const [ssoUrl, setSsoUrl] = useState('');
  const [ssoEntityId, setSsoEntityId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadWebhooks(),
        loadIntegrations(),
        loadSSOConfigs(),
        loadNotificationChannels()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados das integrações');
    } finally {
      setLoading(false);
    }
  };

  const loadWebhooks = async () => {
    const { data, error } = await supabase
      .from('webhook_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setWebhooks(data || []);
  };

  const loadIntegrations = async () => {
    const { data, error } = await supabase
      .from('integration_configurations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setIntegrations(data || []);
  };

  const loadSSOConfigs = async () => {
    const { data, error } = await supabase
      .from('sso_configurations')
      .select('*')
      .order('provider_name');

    if (error) throw error;
    setSsoConfigs(data || []);
  };

  const loadNotificationChannels = async () => {
    const { data, error } = await supabase
      .from('notification_channels')
      .select('*')
      .order('channel_name');

    if (error) throw error;
    setNotificationChannels(data || []);
  };

  const handleSendTeamsNotification = async () => {
    if (!teamsWebhookUrl || !notificationTitle || !notificationMessage) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('teams-slack-notifications', {
        body: {
          action: 'send_teams_notification',
          data: {
            webhook_url: teamsWebhookUrl,
            title: notificationTitle,
            message: notificationMessage,
            urgency: notificationUrgency
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Notificação enviada para o Teams com sucesso');
      } else {
        toast.error(`Falha ao enviar notificação: ${data.response_text}`);
      }
    } catch (error) {
      console.error('Error sending Teams notification:', error);
      toast.error('Erro ao enviar notificação para o Teams');
    } finally {
      setLoading(false);
    }
  };

  const handleSendSlackNotification = async () => {
    if (!slackWebhookUrl || !notificationTitle || !notificationMessage) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('teams-slack-notifications', {
        body: {
          action: 'send_slack_notification',
          data: {
            webhook_url: slackWebhookUrl,
            title: notificationTitle,
            message: notificationMessage,
            urgency: notificationUrgency
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Notificação enviada para o Slack com sucesso');
      } else {
        toast.error(`Falha ao enviar notificação: ${data.response_text}`);
      }
    } catch (error) {
      console.error('Error sending Slack notification:', error);
      toast.error('Erro ao enviar notificação para o Slack');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWebhook = async () => {
    if (!webhookName || !webhookUrl || webhookEventTypes.length === 0) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('webhook-manager', {
        body: {
          action: 'create_webhook',
          data: {
            name: webhookName,
            url: webhookUrl,
            method: webhookMethod,
            event_types: webhookEventTypes
          }
        }
      });

      if (error) throw error;

      toast.success('Webhook criado com sucesso');
      
      // Reset form
      setWebhookName('');
      setWebhookUrl('');
      setWebhookEventTypes([]);
      
      // Refresh webhooks
      await loadWebhooks();
    } catch (error) {
      console.error('Error creating webhook:', error);
      toast.error('Erro ao criar webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async (webhookId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('webhook-manager', {
        body: {
          action: 'test_webhook',
          data: {
            webhook_id: webhookId,
            test_payload: {
              message: 'Teste de webhook',
              timestamp: new Date().toISOString()
            }
          }
        }
      });

      if (error) throw error;

      if (data.test_result.success) {
        toast.success(`Webhook testado com sucesso - Status: ${data.test_result.status}`);
      } else {
        toast.error(`Falha no teste do webhook: ${data.test_result.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Error testing webhook:', error);
      toast.error('Erro ao testar webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (webhookId: string, isActive: boolean) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('webhook-manager', {
        body: {
          action: 'toggle_webhook',
          data: {
            webhook_id: webhookId,
            is_active: !isActive
          }
        }
      });

      if (error) throw error;

      toast.success(data.message);
      await loadWebhooks();
    } catch (error) {
      console.error('Error toggling webhook:', error);
      toast.error('Erro ao alterar status do webhook');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCRMIntegration = async () => {
    if (!crmName || !crmApiKey) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const configuration = {
        api_key: crmApiKey,
        ...(crmType === 'salesforce' && { instance_url: crmInstanceUrl })
      };

      const { error } = await supabase
        .from('integration_configurations')
        .insert({
          integration_type: crmType,
          name: crmName,
          configuration,
          is_active: true
        });

      if (error) throw error;

      toast.success('Integração CRM criada com sucesso');
      
      // Reset form
      setCrmName('');
      setCrmApiKey('');
      setCrmInstanceUrl('');
      
      // Refresh integrations
      await loadIntegrations();
    } catch (error) {
      console.error('Error creating CRM integration:', error);
      toast.error('Erro ao criar integração CRM');
    } finally {
      setLoading(false);
    }
  };

  const handleTestCRMIntegration = async (integrationId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('crm-integration', {
        body: {
          action: 'test_integration',
          data: { integration_id: integrationId }
        }
      });

      if (error) throw error;

      if (data.test_result.success) {
        toast.success(`Integração ${data.integration_type} testada com sucesso`);
      } else {
        toast.error(`Falha no teste da integração: ${data.test_result.message}`);
      }
    } catch (error) {
      console.error('Error testing CRM integration:', error);
      toast.error('Erro ao testar integração CRM');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSSOConfig = async () => {
    if (!ssoProviderName || !ssoUrl) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('sso_configurations')
        .insert({
          provider_name: ssoProviderName,
          provider_type: ssoProviderType,
          sso_url: ssoUrl,
          entity_id: ssoEntityId,
          is_active: true,
          auto_provision: false
        });

      if (error) throw error;

      toast.success('Configuração SSO criada com sucesso');
      
      // Reset form
      setSsoProviderName('');
      setSsoUrl('');
      setSsoEntityId('');
      
      // Refresh SSO configs
      await loadSSOConfigs();
    } catch (error) {
      console.error('Error creating SSO config:', error);
      toast.error('Erro ao criar configuração SSO');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSSOConfig = async (providerId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sso-saml-handler', {
        body: {
          action: 'test_sso_config',
          data: { provider_id: providerId }
        }
      });

      if (error) throw error;

      if (data.test_result.success) {
        toast.success(`SSO ${data.provider_name} testado com sucesso`);
      } else {
        toast.error(`Falha no teste SSO: ${data.test_result.message}`);
      }
    } catch (error) {
      console.error('Error testing SSO config:', error);
      toast.error('Erro ao testar configuração SSO');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, isActive?: boolean) => {
    if (isActive === false) {
      return <Badge variant="secondary">Inativo</Badge>;
    }

    switch (status) {
      case 'success':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Sucesso</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Integrações Enterprise</h1>
          <p className="text-muted-foreground">
            Teams/Slack, CRM, Webhooks e SSO/SAML
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="teams-slack" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Teams/Slack
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="crm" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            CRM
          </TabsTrigger>
          <TabsTrigger value="sso" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            SSO/SAML
          </TabsTrigger>
        </TabsList>

        {/* Teams/Slack Tab */}
        <TabsContent value="teams-slack" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Enviar Notificação Teams
                </CardTitle>
                <CardDescription>
                  Teste de notificação para Microsoft Teams
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teamsWebhook">URL do Webhook do Teams</Label>
                  <Input
                    id="teamsWebhook"
                    value={teamsWebhookUrl}
                    onChange={(e) => setTeamsWebhookUrl(e.target.value)}
                    placeholder="https://outlook.office.com/webhook/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationTitle">Título</Label>
                  <Input
                    id="notificationTitle"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    placeholder="Título da notificação"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationMessage">Mensagem</Label>
                  <Textarea
                    id="notificationMessage"
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    placeholder="Conteúdo da notificação"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgência</Label>
                  <Select value={notificationUrgency} onValueChange={setNotificationUrgency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleSendTeamsNotification}
                  disabled={loading}
                  className="w-full"
                >
                  Enviar para Teams
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Enviar Notificação Slack
                </CardTitle>
                <CardDescription>
                  Teste de notificação para Slack
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slackWebhook">URL do Webhook do Slack</Label>
                  <Input
                    id="slackWebhook"
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>

                <Button 
                  onClick={handleSendSlackNotification}
                  disabled={loading}
                  className="w-full"
                >
                  Enviar para Slack
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Canais de Notificação Configurados</CardTitle>
              <CardDescription>
                Canais ativos para notificações automáticas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notificationChannels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <span className="font-medium">{channel.channel_name}</span>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="outline">{channel.channel_type}</Badge>
                        {channel.notification_types.map(type => (
                          <Badge key={type} variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {getStatusBadge('success', channel.is_active)}
                  </div>
                ))}
                {notificationChannels.length === 0 && (
                  <p className="text-muted-foreground">Nenhum canal configurado</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Criar Novo Webhook
                </CardTitle>
                <CardDescription>
                  Configure webhooks para eventos do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookName">Nome do Webhook</Label>
                  <Input
                    id="webhookName"
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="ex: Sistema de Alertas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">URL do Webhook</Label>
                  <Input
                    id="webhookUrl"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.exemplo.com/webhook"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookMethod">Método HTTP</Label>
                  <Select value={webhookMethod} onValueChange={setWebhookMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipos de Eventos</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['incident_created', 'incident_resolved', 'alert_triggered', 'user_login', 'system_health'].map((eventType) => (
                      <label key={eventType} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={webhookEventTypes.includes(eventType)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWebhookEventTypes([...webhookEventTypes, eventType]);
                            } else {
                              setWebhookEventTypes(webhookEventTypes.filter(t => t !== eventType));
                            }
                          }}
                        />
                        <span className="text-sm">{eventType}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleCreateWebhook}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Webhook
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Webhooks Configurados</CardTitle>
                <CardDescription>
                  Webhooks ativos no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {webhooks.map((webhook) => (
                    <div key={webhook.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{webhook.name}</span>
                          <div className="text-sm text-muted-foreground">
                            {webhook.method} • {webhook.url}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestWebhook(webhook.id)}
                          >
                            <TestTube className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleWebhook(webhook.id, webhook.is_active)}
                          >
                            {webhook.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        {getStatusBadge('success', webhook.is_active)}
                        <div className="text-xs text-muted-foreground">
                          ✅ {webhook.success_count} • ❌ {webhook.failure_count}
                        </div>
                      </div>
                    </div>
                  ))}
                  {webhooks.length === 0 && (
                    <p className="text-muted-foreground">Nenhum webhook configurado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CRM Tab */}
        <TabsContent value="crm" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Nova Integração CRM
                </CardTitle>
                <CardDescription>
                  Conecte com Salesforce, HubSpot e outros CRMs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="crmType">Tipo de CRM</Label>
                  <Select value={crmType} onValueChange={setCrmType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salesforce">Salesforce</SelectItem>
                      <SelectItem value="hubspot">HubSpot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crmName">Nome da Integração</Label>
                  <Input
                    id="crmName"
                    value={crmName}
                    onChange={(e) => setCrmName(e.target.value)}
                    placeholder="ex: Salesforce Produção"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="crmApiKey">API Key / Access Token</Label>
                  <Input
                    id="crmApiKey"
                    type="password"
                    value={crmApiKey}
                    onChange={(e) => setCrmApiKey(e.target.value)}
                    placeholder="Token de acesso do CRM"
                  />
                </div>

                {crmType === 'salesforce' && (
                  <div className="space-y-2">
                    <Label htmlFor="crmInstanceUrl">Instance URL</Label>
                    <Input
                      id="crmInstanceUrl"
                      value={crmInstanceUrl}
                      onChange={(e) => setCrmInstanceUrl(e.target.value)}
                      placeholder="https://yourinstance.salesforce.com"
                    />
                  </div>
                )}

                <Button 
                  onClick={handleCreateCRMIntegration}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Integração
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Integrações CRM</CardTitle>
                <CardDescription>
                  Integrações ativas com sistemas CRM
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {integrations.map((integration) => (
                    <div key={integration.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{integration.name}</span>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline">{integration.integration_type}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestCRMIntegration(integration.id)}
                          >
                            <TestTube className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        {getStatusBadge(integration.sync_status, integration.is_active)}
                        <div className="text-xs text-muted-foreground">
                          {integration.last_sync_at 
                            ? `Sync: ${new Date(integration.last_sync_at).toLocaleDateString('pt-BR')}`
                            : 'Nunca sincronizado'
                          }
                        </div>
                      </div>
                      {integration.sync_error && (
                        <div className="mt-2 text-xs text-destructive">
                          {integration.sync_error}
                        </div>
                      )}
                    </div>
                  ))}
                  {integrations.length === 0 && (
                    <p className="text-muted-foreground">Nenhuma integração CRM configurada</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SSO Tab */}
        <TabsContent value="sso" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Nova Configuração SSO
                </CardTitle>
                <CardDescription>
                  Configure SAML, OIDC ou OAuth2 para Single Sign-On
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ssoProviderName">Nome do Provedor</Label>
                  <Input
                    id="ssoProviderName"
                    value={ssoProviderName}
                    onChange={(e) => setSsoProviderName(e.target.value)}
                    placeholder="ex: Azure AD"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssoProviderType">Tipo de Provedor</Label>
                  <Select value={ssoProviderType} onValueChange={setSsoProviderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saml">SAML 2.0</SelectItem>
                      <SelectItem value="oidc">OpenID Connect</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssoUrl">URL do SSO</Label>
                  <Input
                    id="ssoUrl"
                    value={ssoUrl}
                    onChange={(e) => setSsoUrl(e.target.value)}
                    placeholder="https://login.microsoftonline.com/..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssoEntityId">Entity ID (opcional)</Label>
                  <Input
                    id="ssoEntityId"
                    value={ssoEntityId}
                    onChange={(e) => setSsoEntityId(e.target.value)}
                    placeholder="Entity ID do provedor"
                  />
                </div>

                <Button 
                  onClick={handleCreateSSOConfig}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Configuração SSO
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações SSO</CardTitle>
                <CardDescription>
                  Provedores de Single Sign-On configurados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ssoConfigs.map((ssoConfig) => (
                    <div key={ssoConfig.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{ssoConfig.provider_name}</span>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline">{ssoConfig.provider_type.toUpperCase()}</Badge>
                            {ssoConfig.auto_provision && (
                              <Badge variant="secondary">Auto-provisionamento</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleTestSSOConfig(ssoConfig.id)}
                          >
                            <TestTube className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(ssoConfig.sso_url, '_blank')}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        {getStatusBadge('success', ssoConfig.is_active)}
                        <div className="text-xs text-muted-foreground">
                          Role padrão: {ssoConfig.default_role}
                        </div>
                      </div>
                    </div>
                  ))}
                  {ssoConfigs.length === 0 && (
                    <p className="text-muted-foreground">Nenhuma configuração SSO</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {loading && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Processando operação de integração...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default EnterpriseIntegrations;