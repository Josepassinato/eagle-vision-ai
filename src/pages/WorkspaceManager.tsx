import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Play, Square, Plus, Building } from "lucide-react";

export default function WorkspaceManager() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Organization creation
  const [orgName, setOrgName] = useState("");
  const [orgPlan, setOrgPlan] = useState("starter");

  // Camera addition
  const [cameraOrgId, setCameraOrgId] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [cameraUrl, setCameraUrl] = useState("");

  // Stream management
  const [streamOrgId, setStreamOrgId] = useState("");
  const [streamCameraId, setStreamCameraId] = useState("");
  const [streamAnalytic, setStreamAnalytic] = useState("peoplevision");
  const [stopStreamId, setStopStreamId] = useState("");

  const handleApiCall = async (endpoint: string, data: any) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data: response, error } = await supabase.functions.invoke(endpoint, {
        body: data
      });

      if (error) {
        setError(error.message || "Request failed");
      } else {
        setResult(response);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = () => {
    handleApiCall('org-create', {
      name: orgName,
      plan: orgPlan
    });
  };

  const addCamera = () => {
    handleApiCall('camera-add', {
      org_id: cameraOrgId,
      name: cameraName,
      source_url: cameraUrl
    });
  };

  const startStream = () => {
    handleApiCall('stream-start', {
      org_id: streamOrgId,
      camera_id: streamCameraId,
      analytic: streamAnalytic
    });
  };

  const stopStream = () => {
    handleApiCall('stream-stop', {
      org_id: streamOrgId,
      stream_id: stopStreamId
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Workspace & Stream Manager</h1>
        <p className="text-muted-foreground">
          Demonstração do sistema de gerenciamento de workspaces e streams
        </p>
      </div>

      <Tabs defaultValue="organization" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="organization">
            <Building className="w-4 h-4 mr-2" />
            Criar Org
          </TabsTrigger>
          <TabsTrigger value="camera">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Câmera
          </TabsTrigger>
          <TabsTrigger value="start">
            <Play className="w-4 h-4 mr-2" />
            Iniciar Stream
          </TabsTrigger>
          <TabsTrigger value="stop">
            <Square className="w-4 h-4 mr-2" />
            Parar Stream
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <Card>
            <CardHeader>
              <CardTitle>Criar Workspace</CardTitle>
              <CardDescription>
                Cria uma nova organização com quotas e API key
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome da Organização</label>
                <Input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Cliente X"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Plano</label>
                <select
                  value={orgPlan}
                  onChange={(e) => setOrgPlan(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <Button 
                onClick={createOrganization} 
                disabled={loading || !orgName}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Criar Organização
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="camera">
          <Card>
            <CardHeader>
              <CardTitle>Adicionar Câmera</CardTitle>
              <CardDescription>
                Anexa uma nova câmera ao workspace
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization ID</label>
                <Input
                  value={cameraOrgId}
                  onChange={(e) => setCameraOrgId(e.target.value)}
                  placeholder="org_id da organização"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Nome da Câmera</label>
                <Input
                  value={cameraName}
                  onChange={(e) => setCameraName(e.target.value)}
                  placeholder="Loja 1 - Entrada"
                />
              </div>
              <div>
                <label className="text-sm font-medium">URL da Fonte</label>
                <Input
                  value={cameraUrl}
                  onChange={(e) => setCameraUrl(e.target.value)}
                  placeholder="rtsp://192.168.1.100/cam1"
                />
              </div>
              <Button 
                onClick={addCamera} 
                disabled={loading || !cameraOrgId || !cameraName || !cameraUrl}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Adicionar Câmera
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="start">
          <Card>
            <CardHeader>
              <CardTitle>Iniciar Stream</CardTitle>
              <CardDescription>
                Inicia processamento com analítico específico
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization ID</label>
                <Input
                  value={streamOrgId}
                  onChange={(e) => setStreamOrgId(e.target.value)}
                  placeholder="org_id da organização"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Camera ID</label>
                <Input
                  value={streamCameraId}
                  onChange={(e) => setStreamCameraId(e.target.value)}
                  placeholder="camera_id da câmera"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Analítico</label>
                <select
                  value={streamAnalytic}
                  onChange={(e) => setStreamAnalytic(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="peoplevision">People Vision</option>
                  <option value="vehiclevision">Vehicle Vision</option>
                  <option value="safetyvision">Safety Vision</option>
                  <option value="edubehavior">EduBehavior</option>
                  <option value="alpr">ALPR</option>
                </select>
              </div>
              <Button 
                onClick={startStream} 
                disabled={loading || !streamOrgId || !streamCameraId}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Iniciar Stream
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stop">
          <Card>
            <CardHeader>
              <CardTitle>Parar Stream</CardTitle>
              <CardDescription>
                Para o processamento e registra o uso para billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Organization ID</label>
                <Input
                  value={streamOrgId}
                  onChange={(e) => setStreamOrgId(e.target.value)}
                  placeholder="org_id da organização"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Stream ID</label>
                <Input
                  value={stopStreamId}
                  onChange={(e) => setStopStreamId(e.target.value)}
                  placeholder="stream_id do stream ativo"
                />
              </div>
              <Button 
                onClick={stopStream} 
                disabled={loading || !streamOrgId || !stopStreamId}
                className="w-full"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Parar Stream
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Display */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Resultado da API
              {result.success && <Badge variant="outline" className="text-green-600">Success</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Endpoints Disponíveis</CardTitle>
          <CardDescription>
            Documentação dos endpoints do Demo Router
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Badge variant="outline">POST /org-create</Badge>
              <p className="text-sm text-muted-foreground">
                Cria workspace com orgs, quotas, org_users e API Key
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline">POST /camera-add</Badge>
              <p className="text-sm text-muted-foreground">
                Anexa câmera ao workspace específico
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline">POST /stream-start</Badge>
              <p className="text-sm text-muted-foreground">
                Provisiona worker e registra stream como running
              </p>
            </div>
            <div className="space-y-2">
              <Badge variant="outline">POST /stream-stop</Badge>
              <p className="text-sm text-muted-foreground">
                Para stream e registra uso para billing
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}