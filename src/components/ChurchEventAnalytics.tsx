import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Users, AlertTriangle, Shield, Play, Clock } from 'lucide-react';
import { useChurchAnalytics } from '@/hooks/useChurchAnalytics';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChurchEventAnalyticsProps {
  cameraId?: string;
}

export const ChurchEventAnalytics: React.FC<ChurchEventAnalyticsProps> = ({ cameraId }) => {
  const { events, analytics, isLoading, getEventsByType, getTodayStats } = useChurchAnalytics(cameraId);

  const todayStats = getTodayStats();

  const getEventIcon = (eventType: string) => {
    const icons = {
      person_count: Users,
      run_detected: Activity,
      fall_detected: AlertTriangle,
      intrusion_detected: Shield,
      loitering_detected: Clock,
      reach_into_bag: AlertTriangle
    };
    return icons[eventType as keyof typeof icons] || Activity;
  };

  const getEventColor = (eventType: string) => {
    const colors = {
      person_count: 'bg-primary',
      run_detected: 'bg-warning',
      fall_detected: 'bg-destructive',
      intrusion_detected: 'bg-destructive',
      loitering_detected: 'bg-warning',
      reach_into_bag: 'bg-warning'
    };
    return colors[eventType as keyof typeof colors] || 'bg-muted';
  };

  const getEventLabel = (eventType: string) => {
    const labels = {
      person_count: 'Contagem',
      run_detected: 'Corrida',
      fall_detected: 'Queda',
      intrusion_detected: 'Intrusão',
      loitering_detected: 'Permanência',
      reach_into_bag: 'Procurar na Bolsa'
    };
    return labels[eventType as keyof typeof labels] || eventType;
  };

  if (isLoading) {
    return <div className="text-center p-4">Carregando analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Today's Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Presença Atual</p>
                <p className="text-2xl font-bold">{todayStats.attendance}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Pico</p>
                <p className="text-2xl font-bold">{todayStats.peak}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-info" />
              <div>
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-2xl font-bold">{todayStats.entries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-2xl font-bold">{todayStats.exits}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Eventos</p>
                <p className="text-2xl font-bold">{todayStats.safety}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Counts by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Eventos por Tipo (Últimas 24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {['person_count', 'run_detected', 'fall_detected', 'intrusion_detected', 'loitering_detected', 'reach_into_bag'].map((eventType) => {
              const eventCount = getEventsByType(eventType as any).length;
              const Icon = getEventIcon(eventType);
              
              return (
                <div key={eventType} className="flex items-center space-x-3 p-3 rounded-lg border">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{getEventLabel(eventType)}</p>
                    <p className="text-2xl font-bold">{eventCount}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Eventos Recentes</CardTitle>
            <Badge variant="secondary">{events.length} eventos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.slice(0, 10).map((event) => {
              const Icon = getEventIcon(event.event_type);
              
              return (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <div>
                      <p className="font-medium">{getEventLabel(event.event_type)}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>{event.camera_id}</span>
                        {event.zone_name && (
                          <>
                            <span>•</span>
                            <span>{event.zone_name}</span>
                          </>
                        )}
                        {event.person_count > 0 && (
                          <>
                            <span>•</span>
                            <span>{event.person_count} pessoas</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <Badge className={getEventColor(event.event_type)}>
                      {Math.round(event.confidence * 100)}% confiança
                    </Badge>
                    {event.clip_uri && (
                      <Button variant="ghost" size="sm">
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(event.timestamp), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {events.length === 0 && (
            <div className="text-center p-8">
              <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Nenhum evento registrado</h3>
              <p className="text-muted-foreground">
                Os eventos aparecerão aqui quando detectados pelas câmeras.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Analytics */}
      {analytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analytics Semanais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.slice(0, 7).map((data) => (
                <div key={data.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{new Date(data.date).toLocaleDateString('pt-BR')}</p>
                    <p className="text-sm text-muted-foreground">
                      Câmera: {data.camera_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{data.total_attendance} pessoas</p>
                    <p className="text-sm text-muted-foreground">
                      Pico: {data.peak_attendance} | Eventos: {data.safety_events}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};