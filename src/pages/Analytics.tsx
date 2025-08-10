import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface EventRow { ts: string; camera_id: string; reason: string | null; label: string | null; }

const Analytics: React.FC = () => {
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [cameras, setCameras] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>(["person","car","truck","bus","motorcycle","bicycle"]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<EventRow[]>([]);

  const cameraInput = useMemo(() => cameras.join(","), [cameras]);
  const classesInput = useMemo(() => classes.join(","), [classes]);

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = (supabase as any)
        .from("events")
        .select("ts,camera_id,reason,label")
        .order("ts", { ascending: true });
      if (dateStart) query = query.gte("ts", dateStart);
      if (dateEnd) query = query.lte("ts", dateEnd);
      if (cameras.length) query = query.in("camera_id", cameras);
      if (classes.length) query = query.in("label", classes);
      const { data, error } = await query;
      if (error) throw error;
      setRows(data as EventRow[]);
    } catch (e) {
      toast({ title: "Erro ao carregar analytics", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd, JSON.stringify(cameras), JSON.stringify(classes)]);

  // Agrupar por hora
  const series = useMemo(() => {
    const buckets: Record<string, any> = {};
    for (const r of rows) {
      const t = format(parseISO(r.ts), "yyyy-MM-dd HH:00");
      buckets[t] ||= { t, person: 0, car: 0, truck: 0, bus: 0, motorcycle: 0, bicycle: 0 };
      const key = (r.label || "").toLowerCase();
      if (key in buckets[t]) buckets[t][key]++;
    }
    return Object.values(buckets).sort((a: any, b: any) => a.t.localeCompare(b.t));
  }, [rows]);

  const rateSeries = useMemo(() => {
    const buckets: Record<string, { t: string; face: number; reid: number; total: number; rate: number }> = {};
    for (const r of rows) {
      const t = format(parseISO(r.ts), "yyyy-MM-dd HH:00");
      buckets[t] ||= { t, face: 0, reid: 0, total: 0, rate: 0 };
      if (r.reason === "face") buckets[t].face++;
      if (r.reason === "reid+motion") buckets[t].reid++;
      buckets[t].total++;
    }
    for (const k of Object.keys(buckets)) {
      const b = buckets[k];
      b.rate = b.total ? Math.round((b.face / b.total) * 100) : 0;
    }
    return Object.values(buckets).sort((a, b) => a.t.localeCompare(b.t));
  }, [rows]);

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Analytics</h1>
        <p className="text-muted-foreground">Gráficos nativos e link para Grafana</p>
      </header>

      <section className="mb-4 flex flex-wrap gap-3 items-center">
        <Input type="date" className="w-[180px]" aria-label="Data inicial" value={dateStart} onChange={(e)=>setDateStart(e.target.value)} />
        <Input type="date" className="w-[180px]" aria-label="Data final" value={dateEnd} onChange={(e)=>setDateEnd(e.target.value)} />
        <Input className="w-[240px]" placeholder="camera_id (separe por vírgula)" value={cameraInput} onChange={(e)=>setCameras(e.target.value.split(",").map(s=>s.trim()).filter(Boolean))} />
        <Input className="w-[260px]" placeholder="classes (person,car,truck,...)" value={classesInput} onChange={(e)=>setClasses(e.target.value.split(",").map(s=>s.trim()).filter(Boolean))} />
        <Button variant="secondary" onClick={fetchData} disabled={loading}>Aplicar</Button>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">People / Vehicles por hora</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series as any[]}>
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Bar dataKey="person" stackId="a" fill="hsl(var(--overlay-person))" />
                <Bar dataKey="car" stackId="a" fill="hsl(var(--overlay-car))" />
                <Bar dataKey="truck" stackId="a" fill="hsl(var(--overlay-truck))" />
                <Bar dataKey="bus" stackId="a" fill="hsl(var(--overlay-bus))" />
                <Bar dataKey="motorcycle" stackId="a" fill="hsl(var(--overlay-motorcycle))" />
                <Bar dataKey="bicycle" stackId="a" fill="hsl(var(--overlay-bicycle))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Recognition rate (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rateSeries}>
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <a className="story-link text-sm" href="http://localhost:3000" target="_blank" rel="noreferrer">Abrir no Grafana</a>
      </div>
    </main>
  );
};

export default Analytics;
