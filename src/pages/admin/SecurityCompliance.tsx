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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Shield, 
  Lock, 
  Eye, 
  FileText, 
  Users, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Search
} from 'lucide-react';

interface PersonalDataRecord {
  id: string;
  table_name: string;
  column_name: string;
  data_category: string;
  purpose: string;
  legal_basis: string;
  retention_period_days: number;
  anonymization_method: string;
  is_anonymized: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id: string;
  timestamp: string;
  metadata: any;
}

interface DataAccessLog {
  id: string;
  access_type: string;
  resource_type: string;
  resource_id: string;
  data_subject_id: string;
  purpose: string;
  timestamp: string;
  user_id: string;
}

interface RBACPermission {
  id: string;
  name: string;
  description: string;
  resource_type: string;
  action: string;
}

interface EncryptionKey {
  id: string;
  key_name: string;
  key_type: string;
  key_purpose: string;
  is_active: boolean;
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  days_until_expiry: number;
}

const SecurityCompliance: React.FC = () => {
  const [personalDataInventory, setPersonalDataInventory] = useState<PersonalDataRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataAccessLogs, setDataAccessLogs] = useState<DataAccessLog[]>([]);
  const [rbacPermissions, setRbacPermissions] = useState<RBACPermission[]>([]);
  const [encryptionKeys, setEncryptionKeys] = useState<EncryptionKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('gdpr');

  // GDPR/LGPD form states
  const [dataSubjectId, setDataSubjectId] = useState('');
  const [requestType, setRequestType] = useState('access');
  const [requesterEmail, setRequesterEmail] = useState('');

  // RBAC form states
  const [newPermissionName, setNewPermissionName] = useState('');
  const [newPermissionDescription, setNewPermissionDescription] = useState('');
  const [newPermissionResource, setNewPermissionResource] = useState('');
  const [newPermissionAction, setNewPermissionAction] = useState('');

  // Encryption form states
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState('aes256');
  const [newKeyPurpose, setNewKeyPurpose] = useState('data');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPersonalDataInventory(),
        loadAuditLogs(),
        loadDataAccessLogs(),
        loadRBACPermissions(),
        loadEncryptionKeys()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados de segurança');
    } finally {
      setLoading(false);
    }
  };

  const loadPersonalDataInventory = async () => {
    const { data, error } = await supabase
      .from('personal_data_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setPersonalDataInventory(data || []);
  };

  const loadAuditLogs = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
    setAuditLogs(data || []);
  };

  const loadDataAccessLogs = async () => {
    const { data, error } = await supabase
      .from('data_access_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;
    setDataAccessLogs(data || []);
  };

  const loadRBACPermissions = async () => {
    const { data, error } = await supabase
      .from('rbac_permissions')
      .select('*')
      .order('name');

    if (error) throw error;
    setRbacPermissions(data || []);
  };

  const loadEncryptionKeys = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: { action: 'list_keys' }
      });

      if (error) throw error;
      setEncryptionKeys(data.keys || []);
    } catch (error) {
      console.error('Error loading encryption keys:', error);
    }
  };

  const handleDataSubjectRequest = async () => {
    if (!dataSubjectId || !requesterEmail) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gdpr-compliance', {
        body: {
          action: 'handle_data_request',
          data: {
            request_type: requestType,
            data_subject_id: dataSubjectId,
            requester_email: requesterEmail
          }
        }
      });

      if (error) throw error;

      toast.success(`Solicitação de ${requestType} processada com sucesso`);
      
      // Reset form
      setDataSubjectId('');
      setRequesterEmail('');
      
      // Refresh logs
      await loadAuditLogs();
      await loadDataAccessLogs();
    } catch (error) {
      console.error('Error processing data subject request:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePermission = async () => {
    if (!newPermissionName || !newPermissionResource || !newPermissionAction) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rbac-manager', {
        body: {
          action: 'create_permission',
          data: {
            name: newPermissionName,
            description: newPermissionDescription,
            resource_type: newPermissionResource,
            action: newPermissionAction
          }
        }
      });

      if (error) throw error;

      toast.success('Permissão criada com sucesso');
      
      // Reset form
      setNewPermissionName('');
      setNewPermissionDescription('');
      setNewPermissionResource('');
      setNewPermissionAction('');
      
      // Refresh permissions
      await loadRBACPermissions();
    } catch (error) {
      console.error('Error creating permission:', error);
      toast.error('Erro ao criar permissão');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEncryptionKey = async () => {
    if (!newKeyName) {
      toast.error('Por favor, informe o nome da chave');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: {
          action: 'generate_key',
          data: {
            key_name: newKeyName,
            key_type: newKeyType,
            key_purpose: newKeyPurpose
          }
        }
      });

      if (error) throw error;

      toast.success('Chave de criptografia gerada com sucesso');
      
      // Reset form
      setNewKeyName('');
      
      // Refresh keys
      await loadEncryptionKeys();
    } catch (error) {
      console.error('Error generating encryption key:', error);
      toast.error('Erro ao gerar chave de criptografia');
    } finally {
      setLoading(false);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-encryption', {
        body: {
          action: 'rotate_key',
          data: { key_id: keyId }
        }
      });

      if (error) throw error;

      toast.success('Chave rotacionada com sucesso');
      await loadEncryptionKeys();
    } catch (error) {
      console.error('Error rotating key:', error);
      toast.error('Erro ao rotacionar chave');
    } finally {
      setLoading(false);
    }
  };

  const exportDataSubjectData = async (dataSubjectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('gdpr-compliance', {
        body: {
          action: 'handle_data_request',
          data: {
            request_type: 'access',
            data_subject_id: dataSubjectId,
            requester_email: 'export@system.com'
          }
        }
      });

      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${dataSubjectId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Dados exportados com sucesso');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold text-foreground">Segurança & Compliance</h1>
          <p className="text-muted-foreground">
            Gestão completa de GDPR/LGPD, auditoria, RBAC e criptografia
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="gdpr" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            GDPR/LGPD
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="rbac" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            RBAC
          </TabsTrigger>
          <TabsTrigger value="encryption" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Criptografia
          </TabsTrigger>
        </TabsList>

        {/* GDPR/LGPD Tab */}
        <TabsContent value="gdpr" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Solicitações de Titular de Dados
                </CardTitle>
                <CardDescription>
                  Processe solicitações de acesso, retificação e exclusão de dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dataSubjectId">ID do Titular dos Dados</Label>
                  <Input
                    id="dataSubjectId"
                    value={dataSubjectId}
                    onChange={(e) => setDataSubjectId(e.target.value)}
                    placeholder="UUID da pessoa"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="requestType">Tipo de Solicitação</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="access">Acesso aos Dados</SelectItem>
                      <SelectItem value="rectification">Retificação</SelectItem>
                      <SelectItem value="deletion">Exclusão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requesterEmail">Email do Solicitante</Label>
                  <Input
                    id="requesterEmail"
                    type="email"
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>

                <Button 
                  onClick={handleDataSubjectRequest}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Processando...' : 'Processar Solicitação'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventário de Dados Pessoais</CardTitle>
                <CardDescription>
                  Dados pessoais identificados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {personalDataInventory.map((record) => (
                    <div key={record.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{record.table_name}.{record.column_name}</span>
                          <Badge 
                            variant={record.data_category === 'biometric' ? 'destructive' : 'secondary'}
                            className="ml-2"
                          >
                            {record.data_category}
                          </Badge>
                        </div>
                        {record.is_anonymized && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">{record.purpose}</p>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Base Legal: {record.legal_basis}</span>
                        <span>Retenção: {record.retention_period_days} dias</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Audit Tab */}
        <TabsContent value="audit" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Logs de Auditoria
                </CardTitle>
                <CardDescription>
                  Registro completo de ações do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{log.action}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span>{log.resource_type}</span>
                        {log.resource_id && <span className="ml-2">ID: {log.resource_id}</span>}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer">Metadados</summary>
                          <pre className="text-xs mt-1 p-2 bg-muted rounded">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logs de Acesso a Dados</CardTitle>
                <CardDescription>
                  Monitoramento de acesso a dados pessoais
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {dataAccessLogs.map((log) => (
                    <div key={log.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={log.access_type === 'delete' ? 'destructive' : 'outline'}
                          >
                            {log.access_type}
                          </Badge>
                          <span className="text-sm">{log.resource_type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {log.data_subject_id && (
                        <div className="text-sm text-muted-foreground">
                          Titular: {log.data_subject_id}
                        </div>
                      )}
                      {log.purpose && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Finalidade: {log.purpose}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RBAC Tab */}
        <TabsContent value="rbac" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Criar Nova Permissão
                </CardTitle>
                <CardDescription>
                  Defina permissões granulares para recursos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="permissionName">Nome da Permissão</Label>
                  <Input
                    id="permissionName"
                    value={newPermissionName}
                    onChange={(e) => setNewPermissionName(e.target.value)}
                    placeholder="ex: cameras.create"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="permissionDescription">Descrição</Label>
                  <Textarea
                    id="permissionDescription"
                    value={newPermissionDescription}
                    onChange={(e) => setNewPermissionDescription(e.target.value)}
                    placeholder="Descrição da permissão"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="resourceType">Tipo de Recurso</Label>
                    <Input
                      id="resourceType"
                      value={newPermissionResource}
                      onChange={(e) => setNewPermissionResource(e.target.value)}
                      placeholder="ex: cameras"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="action">Ação</Label>
                    <Select value={newPermissionAction} onValueChange={setNewPermissionAction}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="read">Read</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="execute">Execute</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleCreatePermission}
                  disabled={loading}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Permissão
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Permissões Existentes</CardTitle>
                <CardDescription>
                  Permissões disponíveis no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {rbacPermissions.map((permission) => (
                    <div key={permission.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{permission.name}</span>
                        <Badge variant="outline">
                          {permission.action}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {permission.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Recurso: {permission.resource_type}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Encryption Tab */}
        <TabsContent value="encryption" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Gerar Nova Chave
                </CardTitle>
                <CardDescription>
                  Criar chaves de criptografia para proteção de dados
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="keyName">Nome da Chave</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="ex: user-data-key"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyType">Tipo de Chave</Label>
                    <Select value={newKeyType} onValueChange={setNewKeyType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aes256">AES-256</SelectItem>
                        <SelectItem value="rsa2048">RSA-2048</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyPurpose">Finalidade</Label>
                    <Select value={newKeyPurpose} onValueChange={setNewKeyPurpose}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="data">Dados</SelectItem>
                        <SelectItem value="transport">Transporte</SelectItem>
                        <SelectItem value="backup">Backup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button 
                  onClick={handleGenerateEncryptionKey}
                  disabled={loading}
                  className="w-full"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Gerar Chave
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chaves de Criptografia</CardTitle>
                <CardDescription>
                  Gestão das chaves ativas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {encryptionKeys.map((key) => (
                    <div key={key.id} className="border rounded p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium">{key.key_name}</span>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="outline">{key.key_type}</Badge>
                            <Badge variant="outline">{key.key_purpose}</Badge>
                            {key.is_expired && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Expirada
                              </Badge>
                            )}
                            {key.is_active && !key.is_expired && (
                              <Badge variant="default">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ativa
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRotateKey(key.id)}
                          disabled={loading}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div>Criada: {new Date(key.created_at).toLocaleDateString('pt-BR')}</div>
                        <div>
                          {key.is_expired 
                            ? `Expirou há ${Math.abs(key.days_until_expiry)} dias`
                            : `Expira em ${key.days_until_expiry} dias`
                          }
                        </div>
                      </div>
                    </div>
                  ))}
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
            Processando operação de segurança...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default SecurityCompliance;