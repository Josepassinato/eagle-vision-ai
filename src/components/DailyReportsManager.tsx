import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FileText, 
  Mail, 
  Calendar, 
  Users, 
  Clock,
  Download,
  Send,
  Settings,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReportJob {
  id: string;
  report_type: string;
  report_date: string;
  status: string;
  generated_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  metadata: any;
  error_message: string | null;
  created_at: string;
}

interface ReportRecipient {
  id: string;
  email: string;
  phone: string | null;
  report_types: string[];
  is_active: boolean;
  created_at: string;
}

const DailyReportsManager: React.FC = () => {
  const [reportJobs, setReportJobs] = useState<ReportJob[]>([]);
  const [recipients, setRecipients] = useState<ReportRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [newRecipientPhone, setNewRecipientPhone] = useState('');
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);

  const loadReportJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('report_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setReportJobs(data || []);
    } catch (error) {
      console.error('Error loading report jobs:', error);
      toast.error('Erro ao carregar relatórios');
    }
  };

  const loadRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from('report_recipients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecipients(data || []);
    } catch (error) {
      console.error('Error loading recipients:', error);
      toast.error('Erro ao carregar destinatários');
    }
  };

  const generateManualReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-report-generator', {
        body: {
          reportDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          orgId: 'manual'
        }
      });

      if (error) throw error;

      toast.success('Relatório gerado e enviado com sucesso!');
      loadReportJobs();
    } catch (error) {
      console.error('Error generating manual report:', error);
      toast.error('Erro ao gerar relatório manual');
    } finally {
      setLoading(false);
    }
  };

  const addRecipient = async () => {
    if (!newRecipientEmail) {
      toast.error('Email é obrigatório');
      return;
    }

    try {
      const { error } = await supabase
        .from('report_recipients')
        .insert({
          email: newRecipientEmail,
          phone: newRecipientPhone || null,
          report_types: ['daily'],
          is_active: true
        });

      if (error) throw error;

      toast.success('Destinatário adicionado com sucesso!');
      setNewRecipientEmail('');
      setNewRecipientPhone('');
      setIsAddRecipientOpen(false);
      loadRecipients();
    } catch (error) {
      console.error('Error adding recipient:', error);
      toast.error('Erro ao adicionar destinatário');
    }
  };

  const toggleRecipientStatus = async (recipientId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('report_recipients')
        .update({ is_active: !isActive })
        .eq('id', recipientId);

      if (error) throw error;

      toast.success('Status do destinatário atualizado!');
      loadRecipients();
    } catch (error) {
      console.error('Error updating recipient status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const deleteRecipient = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from('report_recipients')
        .delete()
        .eq('id', recipientId);

      if (error) throw error;

      toast.success('Destinatário removido com sucesso!');
      loadRecipients();
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast.error('Erro ao remover destinatário');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'pending': { variant: 'secondary' as const, icon: Clock, text: 'Pendente' },
      'generating': { variant: 'default' as const, icon: Settings, text: 'Gerando' },
      'completed': { variant: 'default' as const, icon: CheckCircle, text: 'Concluído' },
      'failed': { variant: 'destructive' as const, icon: AlertCircle, text: 'Erro' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.text}
      </Badge>
    );
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  useEffect(() => {
    loadReportJobs();
    loadRecipients();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Relatórios Diários Automáticos
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Geração e envio automático de relatórios diários de segurança com estatísticas de incidentes
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={generateManualReport} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Gerando...' : 'Gerar Relatório Manual'}
            </Button>
          </div>

          <Tabs defaultValue="jobs" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="jobs" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="recipients" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Destinatários
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="jobs" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Histórico de Relatórios</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data do Relatório</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gerado em</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Destinatários</TableHead>
                        <TableHead>Resumo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell>
                            {new Date(job.report_date).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>{formatDateTime(job.generated_at)}</TableCell>
                          <TableCell>{formatDateTime(job.sent_at)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.recipients_count}</Badge>
                          </TableCell>
                          <TableCell>
                            {job.metadata?.summary && (
                              <div className="text-sm space-y-1">
                                <div>Incidentes: {job.metadata.summary.totalIncidents}</div>
                                <div>Descarte: {job.metadata.summary.discardedPercentage?.toFixed(1)}%</div>
                              </div>
                            )}
                            {job.error_message && (
                              <div className="text-sm text-destructive">
                                Erro: {job.error_message}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recipients" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">Destinatários dos Relatórios</CardTitle>
                  <Dialog open={isAddRecipientOpen} onOpenChange={setIsAddRecipientOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Destinatário</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newRecipientEmail}
                            onChange={(e) => setNewRecipientEmail(e.target.value)}
                            placeholder="usuario@empresa.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                          <Input
                            id="phone"
                            value={newRecipientPhone}
                            onChange={(e) => setNewRecipientPhone(e.target.value)}
                            placeholder="+55 11 99999-9999"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={addRecipient} className="flex-1">
                            Adicionar
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => setIsAddRecipientOpen(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Tipos de Relatório</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipients.map((recipient) => (
                        <TableRow key={recipient.id}>
                          <TableCell className="flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            {recipient.email}
                          </TableCell>
                          <TableCell>{recipient.phone || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {recipient.report_types.map((type) => (
                                <Badge key={type} variant="secondary" className="text-xs">
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={recipient.is_active}
                              onCheckedChange={() => toggleRecipientStatus(recipient.id, recipient.is_active)}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteRecipient(recipient.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configurações do Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Horário de Envio</Label>
                      <div className="text-sm text-muted-foreground">
                        07:00 UTC (04:00 Brasília) - Diariamente
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Formato dos Relatórios</Label>
                      <div className="text-sm text-muted-foreground">
                        HTML (email) + CSV (anexo)
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Dados Incluídos</Label>
                      <div className="text-sm text-muted-foreground">
                        <ul className="list-disc list-inside space-y-1">
                          <li>Incidentes por câmera</li>
                          <li>Distribuição por tipo de regra</li>
                          <li>Análise de horários de pico</li>
                          <li>Duração média dos incidentes</li>
                          <li>Percentual de eventos descartados</li>
                          <li>Amostra de 3-5 eventos relevantes</li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Status do Cron Job</Label>
                      <Badge variant="default" className="flex items-center gap-2 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Ativo (ID: daily-security-report)
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyReportsManager;