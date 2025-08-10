import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/integrations/supabase/storage";
import { SIGNED_URL_TTL } from "@/config";

interface IncidentRow {
  id: number;
  camera_id: string;
  severity: string;
  ts: string;
  meta: any;
}

export default function Antitheft() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<IncidentRow | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [labels, setLabels] = useState<any | null>(null);

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("antitheft_incidents")
        .select("id,camera_id,severity,ts,meta")
        .order("ts", { ascending: false })
        .limit(50);
      if (error) throw error;
      setRows(data as IncidentRow[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIncidents(); }, []);

  useEffect(() => {
    const run = async () => {
      if (!selected) { setVideoUrl(null); setLabels(null); return; }
      const vid = await getSignedUrl("antitheft_clips", `${selected.id}/video.mp4`, SIGNED_URL_TTL);
      setVideoUrl(vid);
      try {
        const jsonUrl = await getSignedUrl("antitheft_clips", `${selected.id}/labels.json`, SIGNED_URL_TTL);
        if (jsonUrl) {
          const resp = await fetch(jsonUrl);
          if (resp.ok) setLabels(await resp.json());
        }
      } catch {}
    };
    run();
  }, [selected]);

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Antitheft Incidents</h1>
        <p className="text-muted-foreground">Clipes e metadados do bucket antitheft_clips</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Últimos incidentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Câmera</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.camera_id}</TableCell>
                    <TableCell>{r.severity}</TableCell>
                    <TableCell>{new Date(r.ts).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={()=>setSelected(r)}>Ver</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Incidente #{selected?.id}</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              {videoUrl ? (
                <video src={videoUrl} controls className="w-full rounded-md" />
              ) : (
                <div className="w-full h-48 rounded-md bg-muted" />
              )}
            </div>
            <div className="text-sm space-y-2">
              <div><span className="text-muted-foreground">Câmera:</span> {selected?.camera_id}</div>
              <div><span className="text-muted-foreground">Severidade:</span> {selected?.severity}</div>
              <div><span className="text-muted-foreground">Timestamp:</span> {selected ? new Date(selected.ts).toLocaleString() : ""}</div>
              <div className="mt-2">
                <div className="text-muted-foreground mb-1">Labels.json</div>
                <pre className="max-h-64 overflow-auto text-xs bg-muted p-2 rounded-md">
                  {labels ? JSON.stringify(labels, null, 2) : "—"}
                </pre>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
