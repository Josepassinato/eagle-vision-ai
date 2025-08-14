import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Bell, MessageSquare, Mail, Smartphone, Settings, Plus, Edit, Trash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NotificationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: string[];
  channels: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  recipients: string[];
}

interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'whatsapp' | 'teams' | 'webhook';
  name: string;
  config: Record<string, any>;
  enabled: boolean;
}

export default function IntelligentAlertSystem() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load existing rules and channels
    loadNotificationRules();
    loadNotificationChannels();
  }, []);

  const loadNotificationRules = () => {
    // Simulate API call
    setRules([
      {
        id: '1',
        name: 'Critical Security Alert',
        trigger: 'security_incident',
        conditions: ['severity = critical', 'confidence > 0.8'],
        channels: ['email', 'sms', 'teams'],
        priority: 'critical',
        enabled: true,
        recipients: ['security@company.com', '+1234567890']
      },
      {
        id: '2',
        name: 'Camera Offline',
        trigger: 'camera_offline',
        conditions: ['duration > 5 minutes'],
        channels: ['email', 'teams'],
        priority: 'high',
        enabled: true,
        recipients: ['ops@company.com']
      },
      {
        id: '3',
        name: 'High Detection Volume',
        trigger: 'detection_volume',
        conditions: ['count > 100 per minute', 'camera_zone = entrance'],
        channels: ['webhook'],
        priority: 'medium',
        enabled: true,
        recipients: ['https://api.company.com/alerts']
      }
    ]);
  };

  const loadNotificationChannels = () => {
    setChannels([
      {
        id: 'email',
        type: 'email',
        name: 'Email Notifications',
        config: { smtp_server: 'smtp.company.com', port: 587 },
        enabled: true
      },
      {
        id: 'sms',
        type: 'sms',
        name: 'SMS Alerts',
        config: { provider: 'twilio', api_key: '***' },
        enabled: true
      },
      {
        id: 'teams',
        type: 'teams',
        name: 'Microsoft Teams',
        config: { webhook_url: 'https://company.webhook.office.com/***' },
        enabled: true
      },
      {
        id: 'whatsapp',
        type: 'whatsapp',
        name: 'WhatsApp Business',
        config: { phone_number: '+1234567890', api_token: '***' },
        enabled: false
      }
    ]);
  };

  const handleCreateRule = () => {
    setIsCreating(true);
    setEditingRule({
      id: '',
      name: '',
      trigger: '',
      conditions: [],
      channels: [],
      priority: 'medium',
      enabled: true,
      recipients: []
    });
  };

  const handleSaveRule = (rule: NotificationRule) => {
    if (rule.id) {
      // Update existing rule
      setRules(prev => prev.map(r => r.id === rule.id ? rule : r));
      toast({
        title: "Rule Updated",
        description: "Notification rule has been updated successfully."
      });
    } else {
      // Create new rule
      const newRule = { ...rule, id: Date.now().toString() };
      setRules(prev => [...prev, newRule]);
      toast({
        title: "Rule Created",
        description: "New notification rule has been created successfully."
      });
    }
    setIsCreating(false);
    setEditingRule(null);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));
    toast({
      title: "Rule Deleted",
      description: "Notification rule has been deleted."
    });
  };

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => 
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    ));
  };

  const handleTestNotification = async (rule: NotificationRule) => {
    toast({
      title: "Test Notification Sent",
      description: `Test alert sent via ${rule.channels.join(', ')} for rule "${rule.name}"`
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      case 'medium': return 'outline';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'sms': return <Smartphone className="h-4 w-4" />;
      case 'teams': return <MessageSquare className="h-4 w-4" />;
      case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Intelligent Alert System</h1>
          <p className="text-muted-foreground">Configure smart notifications and escalation rules</p>
        </div>
        <Button onClick={handleCreateRule}>
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">Notification Rules</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="escalation">Escalation</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {/* Notification Rules */}
          <div className="grid gap-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                    />
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <Badge variant={getPriorityColor(rule.priority)}>
                      {rule.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleTestNotification(rule)}>
                      Test
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingRule(rule);
                      setIsCreating(true);
                    }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium">Trigger: </span>
                      <code className="text-sm bg-muted px-2 py-1 rounded">{rule.trigger}</code>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Conditions: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.conditions.map((condition, index) => (
                          <Badge key={index} variant="outline">{condition}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Channels: </span>
                      <div className="flex items-center space-x-2 mt-1">
                        {rule.channels.map((channel) => {
                          const channelConfig = channels.find(c => c.id === channel);
                          return (
                            <div key={channel} className="flex items-center space-x-1">
                              {getChannelIcon(channelConfig?.type || 'email')}
                              <span className="text-sm">{channelConfig?.name || channel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Recipients: </span>
                      <span className="text-sm text-muted-foreground">
                        {rule.recipients.join(', ')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          {/* Notification Channels */}
          <div className="grid gap-4">
            {channels.map((channel) => (
              <Card key={channel.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center space-x-3">
                    {getChannelIcon(channel.type)}
                    <CardTitle className="text-lg">{channel.name}</CardTitle>
                    <Badge variant={channel.enabled ? 'default' : 'outline'}>
                      {channel.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Type: {channel.type} • Status: {channel.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="escalation" className="space-y-4">
          {/* Escalation Rules */}
          <Card>
            <CardHeader>
              <CardTitle>Escalation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm font-medium">
                  <div>Priority Level</div>
                  <div>Initial Response</div>
                  <div>Escalation (15 min)</div>
                  <div>Final Escalation (30 min)</div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Badge variant="destructive">Critical</Badge>
                  <div>Security Team + Manager</div>
                  <div>Director + On-call Engineer</div>
                  <div>C-Level + External Support</div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Badge variant="secondary">High</Badge>
                  <div>Operations Team</div>
                  <div>Manager + Senior Engineer</div>
                  <div>Director</div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Badge variant="outline">Medium</Badge>
                  <div>Assigned Engineer</div>
                  <div>Team Lead</div>
                  <div>Manager</div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <Badge variant="outline">Low</Badge>
                  <div>Automated Ticket</div>
                  <div>Daily Review</div>
                  <div>Weekly Review</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Alert Analytics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">847</div>
                <p className="text-xs text-muted-foreground">Alerts sent (24h)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground">Delivery rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">4.2 min</div>
                <p className="text-xs text-muted-foreground">Avg response time</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">Escalations</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alert Volume by Priority</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Critical</span>
                  <span className="text-sm font-medium">12 (1.4%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">High</span>
                  <span className="text-sm font-medium">67 (7.9%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Medium</span>
                  <span className="text-sm font-medium">423 (49.9%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Low</span>
                  <span className="text-sm font-medium">345 (40.8%)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Rule Modal would go here */}
      {isCreating && editingRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingRule.id ? 'Edit' : 'Create'} Notification Rule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Rule Name</label>
                <Input 
                  value={editingRule.name}
                  onChange={(e) => setEditingRule(prev => prev ? {...prev, name: e.target.value} : null)}
                  placeholder="Enter rule name"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Trigger Event</label>
                <Select value={editingRule.trigger} onValueChange={(value) => 
                  setEditingRule(prev => prev ? {...prev, trigger: value} : null)
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="security_incident">Security Incident</SelectItem>
                    <SelectItem value="camera_offline">Camera Offline</SelectItem>
                    <SelectItem value="detection_volume">High Detection Volume</SelectItem>
                    <SelectItem value="system_error">System Error</SelectItem>
                    <SelectItem value="performance_threshold">Performance Threshold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={editingRule.priority} onValueChange={(value: any) => 
                  setEditingRule(prev => prev ? {...prev, priority: value} : null)
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsCreating(false);
                  setEditingRule(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={() => handleSaveRule(editingRule)}>
                  Save Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}