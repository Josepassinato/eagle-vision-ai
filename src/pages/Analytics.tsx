import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const data = Array.from({ length: 12 }).map((_, i) => ({
  t: `${i}:00`, people: Math.round(Math.random() * 20), vehicles: Math.round(Math.random() * 10), rate: Math.round(60 + Math.random() * 35)
}));

const Analytics: React.FC = () => {
  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-2xl">Analytics</h1>
        <p className="text-muted-foreground">Gráficos nativos e link para Grafana (skeleton)</p>
      </header>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display">People / Vehicles por hora</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis dataKey="t" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="people" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="vehicles" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display">Recognition rate (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
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
