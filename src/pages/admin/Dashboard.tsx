import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [stats, setStats] = useState({
    people24h: 0,
    vehicles24h: 0,
    avgLatency: 0,
    camerasOnline: 0
  });

  useEffect(() => {
    // Load credit balance
    supabase.from("credit_ledger").select("delta").then(({ data, error }) => {
      if (!error && data) setBalance(data.reduce((sum: number, r: any) => sum + (r.delta || 0), 0));
    });

    // Load real analytics data
    loadAnalytics();
    
    // Setup realtime subscriptions
    const frameAnalysisSubscription = supabase
      .channel('frame_analysis_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'frame_analysis' }, () => {
        loadAnalytics();
      })
      .subscribe();

    return () => {
      frameAnalysisSubscription.unsubscribe();
    };
  }, []);

  const loadAnalytics = async () => {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get people count from last 24h
    const { data: peopleData } = await supabase
      .from('detections')
      .select('id')
      .eq('detection_type', 'person')
      .gte('created_at', last24h);

    // Get vehicle count from last 24h  
    const { data: vehicleData } = await supabase
      .from('detections')
      .select('id')
      .in('detection_type', ['car', 'truck', 'motorcycle', 'bus'])
      .gte('created_at', last24h);

    // Get average processing latency
    const { data: latencyData } = await supabase
      .from('frame_analysis')
      .select('processing_time_ms')
      .gte('created_at', last24h);

    // Get online cameras
    const { data: cameraData } = await supabase
      .from('cameras')
      .select('id')
      .eq('online', true);

    const avgLatency = latencyData && latencyData.length > 0 
      ? Math.round(latencyData.reduce((sum, r) => sum + r.processing_time_ms, 0) / latencyData.length)
      : 0;

    setStats({
      people24h: peopleData?.length || 0,
      vehicles24h: vehicleData?.length || 0,
      avgLatency,
      camerasOnline: cameraData?.length || 0
    });
  };
  return (
    <div className="space-y-6">
      <Card className="shadow-primary">
        <CardHeader>
          <CardTitle>Créditos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-bold">{balance ?? "--"}</div>
              <p className="text-sm text-muted-foreground">saldo disponível</p>
            </div>
            <Link to="/app/credits" className="text-sm text-primary underline">Comprar créditos</Link>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Pessoas (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.people24h}</div>
            <p className="text-sm text-muted-foreground">detecções</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Veículos (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.vehicles24h}</div>
            <p className="text-sm text-muted-foreground">detecções</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Latência média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgLatency}ms</div>
            <p className="text-sm text-muted-foreground">processamento</p>
          </CardContent>
        </Card>
        <Card className="shadow-primary">
          <CardHeader>
            <CardTitle>Câmeras online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.camerasOnline}</div>
            <p className="text-sm text-muted-foreground">ativas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo por hora</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-md bg-card/40 border border-border" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-card/40 border">
                <div className="text-sm">Evento #{i + 1}</div>
                <div className="text-xs text-muted-foreground">--</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
