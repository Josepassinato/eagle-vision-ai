import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, Car, Calendar, Camera, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface VehicleDetection {
  id: string;
  plate_text: string;
  camera_id: string;
  detected_at: string;
  confidence: number;
  image_url?: string;
  vehicle_type?: string;
  color?: string;
}

export const VehicleDetectionsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [detections, setDetections] = useState<VehicleDetection[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const searchPlates = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Busca vazia",
        description: "Digite uma placa para buscar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("search_plates", {
        search_term: searchTerm,
        limit_count: 50,
      });

      if (error) throw error;

      setDetections(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "Nenhum resultado",
          description: "Nenhuma detecção encontrada para esta busca",
        });
      }
    } catch (error: any) {
      console.error("Erro ao buscar placas:", error);
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecentDetections = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vehicle_detections")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      setDetections(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar detecções:", error);
      toast({
        title: "Erro ao carregar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecentDetections();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("vehicle_detections_changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "vehicle_detections",
        },
        (payload) => {
          setDetections((prev) => [payload.new as VehicleDetection, ...prev.slice(0, 19)]);
          toast({
            title: "Nova detecção",
            description: `Placa ${payload.new.plate_text} detectada`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const exportCSV = () => {
    const csv = [
      ["Placa", "Câmera", "Data/Hora", "Confiança", "Tipo", "Cor"].join(","),
      ...detections.map((d) =>
        [
          d.plate_text,
          d.camera_id,
          format(new Date(d.detected_at), "dd/MM/yyyy HH:mm:ss"),
          `${(d.confidence * 100).toFixed(1)}%`,
          d.vehicle_type || "N/A",
          d.color || "N/A",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vehicle_detections_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Detecções de Veículos (LPR)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa (ex: ABC1234 ou ABC1D23)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && searchPlates()}
                className="pl-10"
              />
            </div>
            <Button onClick={searchPlates} disabled={loading}>
              Buscar
            </Button>
            <Button variant="outline" onClick={loadRecentDetections} disabled={loading}>
              Recentes
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={detections.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando detecções...
              </div>
            ) : detections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma detecção encontrada
              </div>
            ) : (
              detections.map((detection) => (
                <Card key={detection.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold">{detection.plate_text}</span>
                        <Badge variant={detection.confidence > 0.8 ? "default" : "secondary"}>
                          {(detection.confidence * 100).toFixed(1)}% confiança
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Camera className="h-4 w-4" />
                          <span>{detection.camera_id}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{format(new Date(detection.detected_at), "dd/MM/yyyy HH:mm:ss")}</span>
                        </div>
                      </div>

                      {(detection.vehicle_type || detection.color) && (
                        <div className="flex gap-2">
                          {detection.vehicle_type && (
                            <Badge variant="outline">{detection.vehicle_type}</Badge>
                          )}
                          {detection.color && (
                            <Badge variant="outline">{detection.color}</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {detection.image_url && (
                      <img
                        src={detection.image_url}
                        alt={`Veículo ${detection.plate_text}`}
                        className="w-32 h-20 object-cover rounded border"
                      />
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded">
              <div className="text-sm text-muted-foreground">Total de Detecções</div>
              <div className="text-2xl font-bold">{detections.length}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-muted-foreground">Confiança Média</div>
              <div className="text-2xl font-bold">
                {detections.length > 0
                  ? `${((detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length) * 100).toFixed(1)}%`
                  : "N/A"}
              </div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-muted-foreground">Câmeras Ativas</div>
              <div className="text-2xl font-bold">
                {new Set(detections.map((d) => d.camera_id)).size}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
