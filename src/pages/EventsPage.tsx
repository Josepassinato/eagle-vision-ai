import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getEvidenceSignedUrl } from "@/integrations/supabase/storage";
import { toast } from "@/hooks/use-toast";
import { SIGNED_URL_TTL } from "@/config";

interface EventRow {
  id: string | number;
  camera_id: string;
  ts: string;
  reason: string | null;
  label: string | null;
  conf: number | null;
  bbox: number[] | null;
  thumb_path: string | null;
  person_id: string | null;
  person_name: string | null;
}

const PAGE_SIZE = 20;

const EventsPage: React.FC = () => {
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");
  const [cameras, setCameras] = useState<string[]>([]);
  const [reason, setReason] = useState<string>("all");
  const [q, setQ] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [rows, setRows] = useState<EventRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [selected, setSelected] = useState<EventRow | null>(null);

  const cameraInput = useMemo(() => cameras.join(","), [cameras]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      let query = (supabase as any)
        .from("events")
        .select("id,camera_id,ts,reason,label,conf,bbox,thumb_path,person_id,person_name", { count: "exact" })
        .order("ts", { ascending: false });

      if (dateStart) query = query.gte("ts", dateStart);
      if (dateEnd) query = query.lte("ts", dateEnd);
      if (cameras.length) query = query.in("camera_id", cameras);
      if (reason !== "all") query = query.eq("reason", reason);
      if (q) query = query.or(`person_name.ilike.%${q}%,person_id.eq.${q}`);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      setRows(data as EventRow[]);
      setTotal(count || 0);
    } catch (e) {
      toast({ title: "Erro ao carregar eventos", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStart, dateEnd, JSON.stringify(cameras), reason, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Events</h1>
        <p className="text-muted-foreground">Filtros e visualização de eventos</p>
      </header>

      <section className="mb-4 flex flex-wrap gap-3 items-center">
        <Input type="date" className="w-[180px]" aria-label="Data inicial" value={dateStart} onChange={(e)=>{setPage(0);setDateStart(e.target.value);}} />
        <Input type="date" className="w-[180px]" aria-label="Data final" value={dateEnd} onChange={(e)=>{setPage(0);setDateEnd(e.target.value);}} />

        {/* camera_id multi via input simples separado por vírgula (rápido) */}
        <Input className="w-[240px]" placeholder="camera_id (separe por vírgula)" value={cameraInput} onChange={(e)=>{setPage(0);setCameras(e.target.value.split(",").map(s=>s.trim()).filter(Boolean));}} />

        <Select value={reason} onValueChange={(v)=>{setPage(0);setReason(v);}}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="face">face</SelectItem>
            <SelectItem value="reid+motion">reid+motion</SelectItem>
            <SelectItem value="vehicle">vehicle</SelectItem>
          </SelectContent>
        </Select>

        <Input className="w-[220px]" placeholder="pessoa (nome ou id)" value={q} onChange={(e)=>{setPage(0);setQ(e.target.value);}} />

        <Button variant="secondary" onClick={()=>{setPage(0);fetchEvents();}} disabled={loading}>Aplicar</Button>
      </section>

      <section className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thumb</TableHead>
              <TableHead>Câmera</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Classe/Score</TableHead>
              <TableHead>Pessoa/ID</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={()=>setSelected(r)}>
                <TableCell>
                  <ThumbCell path={r.thumb_path} />
                </TableCell>
                <TableCell>{r.camera_id}</TableCell>
                <TableCell>{r.reason}</TableCell>
                <TableCell>{r.label}{r.conf ? ` (${(r.conf*100).toFixed(0)}%)` : ""}</TableCell>
                <TableCell>{r.person_name || r.person_id || "—"}</TableCell>
                <TableCell>{new Date(r.ts).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">Página {page+1} de {totalPages} • {total} eventos</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={()=>setPage((p)=>Math.max(0,p-1))} disabled={page===0 || loading}>Anterior</Button>
          <Button variant="outline" onClick={()=>setPage((p)=>Math.min(totalPages-1,p+1))} disabled={page>=totalPages-1 || loading}>Próxima</Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Detalhe do evento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <ThumbCell path={selected.thumb_path} className="w-full h-48 rounded-md overflow-hidden" />
              </div>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Câmera:</span> {selected.camera_id}</div>
                <div><span className="text-muted-foreground">Timestamp:</span> {new Date(selected.ts).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Motivo:</span> {selected.reason}</div>
                <div><span className="text-muted-foreground">Classe/Score:</span> {selected.label} {selected.conf ? `(${(selected.conf*100).toFixed(0)}%)` : ""}</div>
                <div><span className="text-muted-foreground">Pessoa:</span> {selected.person_name || selected.person_id || "—"}</div>
                <div className="pt-2">
                  <a className="story-link text-sm" href={`http://localhost:3000?from=${encodeURIComponent(new Date(new Date(selected.ts).getTime()-30000).toISOString())}&to=${encodeURIComponent(new Date(new Date(selected.ts).getTime()+30000).toISOString())}&camera=${encodeURIComponent(selected.camera_id)}`} target="_blank" rel="noreferrer">Abrir no Grafana (±30s)</a>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

function normalizePath(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("evidence/") ? path.replace(/^evidence\//, "") : path;
}

function ThumbCell({ path, className = "w-16 h-10 rounded bg-muted" }: { path: string | null; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const run = async () => {
      const p = normalizePath(path);
      if (!p) { setUrl(null); return; }
      const signed = await getEvidenceSignedUrl(p, SIGNED_URL_TTL);
      if (active) setUrl(signed);
    };
    run();
    return () => { active = false; };
  }, [path]);
  if (!url) return <div className={className} />;
  return <img src={url} alt="thumbnail do evento" className={className} loading="lazy" />;
}

export default EventsPage;
