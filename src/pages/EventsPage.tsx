import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EventsPage: React.FC = () => {
  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Events</h1>
        <p className="text-muted-foreground">Filtros e visualização de eventos (skeleton)</p>
      </header>

      <section className="mb-4 flex flex-wrap gap-3 items-center">
        {/* Date range skeleton */}
        <Input type="date" className="w-[180px]" aria-label="Data inicial" />
        <Input type="date" className="w-[180px]" aria-label="Data final" />

        {/* Camera filter */}
        <Select>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Camera" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>

        {/* Type filter */}
        <Select>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="face">face</SelectItem>
            <SelectItem value="reid+motion">reid+motion</SelectItem>
            <SelectItem value="vehicle">vehicle</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="secondary">Aplicar</Button>
      </section>

      <section className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Thumb</TableHead>
              <TableHead>Câmera</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Scores</TableHead>
              <TableHead>Pessoa/ID</TableHead>
              <TableHead>Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>
                <div className="w-16 h-10 bg-muted rounded" />
              </TableCell>
              <TableCell>cam-sim</TableCell>
              <TableCell>face</TableCell>
              <TableCell>0.92</TableCell>
              <TableCell>p-1234</TableCell>
              <TableCell>—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </main>
  );
};

export default EventsPage;
