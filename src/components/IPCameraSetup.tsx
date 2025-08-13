import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Wifi, Loader2 } from "lucide-react";

interface CameraConfig {
  name: string;
  ip_address: string;
  brand: string;
  model: string;
  username: string;
  password: string;
  port: number;
  http_port: number;
}

interface IPCameraSetupProps {
  onCameraAdded: (camera: any) => void;
}

export const IPCameraSetup = ({ onCameraAdded }: IPCameraSetupProps) => {
  const [config, setConfig] = useState<CameraConfig>({
    name: "",
    ip_address: "",
    brand: "",
    model: "",
    username: "admin",
    password: "",
    port: 554,
    http_port: 80
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  const cameraBrands = [
    { value: "hikvision", label: "Hikvision", rtsp_path: "/ISAPI/Streaming/Channels/101" },
    { value: "dahua", label: "Dahua", rtsp_path: "/cam/realmonitor?channel=1&subtype=0" },
    { value: "intelbras", label: "Intelbras", rtsp_path: "/streaming/channels/1" },
    { value: "axis", label: "Axis", rtsp_path: "/video1" },
    { value: "uniview", label: "Uniview", rtsp_path: "/live/ch1" },
    { value: "generic", label: "Genérica", rtsp_path: "/stream1" }
  ];

  const handleBrandChange = (brand: string) => {
    const brandInfo = cameraBrands.find(b => b.value === brand);
    setConfig(prev => ({
      ...prev,
      brand: brandInfo?.label || brand
    }));
  };

  const testConnection = async () => {
    if (!config.ip_address) {
      toast({
        title: "Erro",
        description: "Endereço IP é obrigatório",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'test-connection',
          ...config
        }
      });

      if (error) throw error;

      setTestResult(data);
      
      toast({
        title: data.success ? "Conexão bem-sucedida! ✅" : "Falha na conexão ❌",
        description: data.success 
          ? "Câmera acessível e stream funcionando"
          : `Erro: ${data.error || 'Não foi possível conectar'}`,
        variant: data.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Erro no teste:', error);
      toast({
        title: "Erro no teste",
        description: "Não foi possível testar a conexão",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  };

  const saveCamera = async () => {
    if (!config.name || !config.ip_address) {
      toast({
        title: "Erro",
        description: "Nome e IP são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('ip-camera-manager', {
        body: {
          action: 'save-config',
          ...config
        }
      });

      if (error) throw error;

      toast({
        title: "Câmera salva! 🎉",
        description: data.message || "Configuração salva com sucesso",
      });

      onCameraAdded(data.data);
      
      // Reset form
      setConfig({
        name: "",
        ip_address: "",
        brand: "",
        model: "",
        username: "admin",
        password: "",
        port: 554,
        http_port: 80
      });
      setTestResult(null);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar a câmera",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Adicionar Câmera IP
        </CardTitle>
        <CardDescription>
          Configure uma nova câmera IP para monitoramento
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Câmera</Label>
            <Input
              id="name"
              placeholder="Ex: Câmera Entrada"
              value={config.name}
              onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ip">Endereço IP</Label>
            <Input
              id="ip"
              placeholder="192.168.1.100"
              value={config.ip_address}
              onChange={(e) => setConfig(prev => ({ ...prev, ip_address: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand">Marca</Label>
            <Select value={config.brand} onValueChange={handleBrandChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a marca" />
              </SelectTrigger>
              <SelectContent>
                {cameraBrands.map((brand) => (
                  <SelectItem key={brand.value} value={brand.value}>
                    {brand.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modelo</Label>
            <Input
              id="model"
              placeholder="Ex: DS-2CD2xxx"
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Usuário</Label>
            <Input
              id="username"
              value={config.username}
              onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rtsp_port">Porta RTSP</Label>
            <Input
              id="rtsp_port"
              type="number"
              value={config.port}
              onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 554 }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="http_port">Porta HTTP</Label>
            <Input
              id="http_port"
              type="number"
              value={config.http_port}
              onChange={(e) => setConfig(prev => ({ ...prev, http_port: parseInt(e.target.value) || 80 }))}
            />
          </div>
        </div>

        {testResult && (
          <div className={`p-4 rounded-lg border ${
            testResult.success 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={testResult.success ? "default" : "destructive"}>
                {testResult.success ? "✅ Conectado" : "❌ Falha"}
              </Badge>
              {testResult.http_accessible && (
                <Badge variant="outline">HTTP OK</Badge>
              )}
            </div>
            
            {testResult.stream_url && (
              <p className="text-sm text-green-700">
                Stream: <code className="bg-green-100 px-1 rounded">{testResult.stream_url}</code>
              </p>
            )}
            
            {testResult.error && (
              <p className="text-sm text-red-700">
                Erro: {testResult.error}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button 
            onClick={testConnection} 
            disabled={testing || !config.ip_address}
            variant="outline"
            className="flex-1"
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Wifi className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>

          <Button 
            onClick={saveCamera}
            disabled={saving || !config.name || !config.ip_address}
            className="flex-1"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            Salvar Câmera
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};