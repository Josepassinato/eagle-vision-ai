import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Server, 
  Video, 
  Radio, 
  Network, 
  Shield, 
  Download,
  Eye,
  PlayCircle,
  Settings
} from "lucide-react";

const MediaGatewayCard = () => {
  return (
    <section className="py-16 px-6">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 px-4 py-2 text-accent border-accent/30 bg-accent/10">
            <Server className="w-4 h-4 mr-2" />
            Card 1 — Sistema Base
          </Badge>
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-foreground to-accent bg-clip-text text-transparent">
            Gateway de Mídia (MediaMTX)
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Sistema completo de streaming para receber e distribuir feeds de câmeras IP via múltiplos protocolos
          </p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Video className="w-6 h-6 text-accent" />
              Gateway de Mídia MediaMTX
            </CardTitle>
            <CardDescription>
              Receba streams via RTSP/RTMP/HLS/WebRTC/SRT com configuração Docker otimizada
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                <TabsTrigger value="config">Configuração</TabsTrigger>
                <TabsTrigger value="usage">Uso</TabsTrigger>
                <TabsTrigger value="files">Arquivos</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Network className="w-5 h-5 text-accent" />
                      Protocolos Suportados
                    </h3>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2">
                        <Badge variant="secondary">RTSP</Badge>
                        <span className="text-sm text-muted-foreground">Porta 8554/tcp</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="secondary">RTMP</Badge>
                        <span className="text-sm text-muted-foreground">Porta 1935/tcp</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="secondary">HLS</Badge>
                        <span className="text-sm text-muted-foreground">Porta 8888/tcp</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="secondary">WebRTC</Badge>
                        <span className="text-sm text-muted-foreground">8889/tcp + UDP 8000-8200</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Badge variant="secondary">SRT</Badge>
                        <span className="text-sm text-muted-foreground">Porta 8890/udp</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2">
                      <Shield className="w-5 h-5 text-accent" />
                      Recursos de Segurança
                    </h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Eye className="w-4 h-4 text-primary" />
                        Autenticação para leitura/publicação
                      </li>
                      <li className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-primary" />
                        Configuração on-demand para economia de recursos
                      </li>
                      <li className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-primary" />
                        Suporte a múltiplas câmeras simultaneamente
                      </li>
                    </ul>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="config" className="space-y-6">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">Configuração Rápida</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">1</Badge>
                      <span>Configure as câmeras IP no arquivo mediamtx.yml</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">2</Badge>
                      <span>Ajuste credenciais de acesso (.env)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">3</Badge>
                      <span>Execute: <code className="bg-background px-2 py-1 rounded">docker compose up -d</code></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">4</Badge>
                      <span>Abra as portas no firewall da VM</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Modo PULL (Câmera IP)</h4>
                    <p className="text-sm text-muted-foreground">
                      O servidor conecta na câmera automaticamente quando há visualizadores
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">Modo PUSH (Stream Direto)</h4>
                    <p className="text-sm text-muted-foreground">
                      Envie stream via RTMP/SRT diretamente para o servidor
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="usage" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Comandos de Teste</h3>
                  
                  <div className="space-y-4">
                    <div className="bg-background rounded-lg p-4 border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 text-accent" />
                        Visualizar Stream (HLS)
                      </h4>
                      <code className="text-sm">http://SEU_IP:8888/entrada/</code>
                    </div>

                    <div className="bg-background rounded-lg p-4 border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <PlayCircle className="w-4 h-4 text-accent" />
                        Visualizar Stream (RTSP)
                      </h4>
                      <code className="text-sm">rtsp://leitor:leitor123@SEU_IP:8554/entrada</code>
                    </div>

                    <div className="bg-background rounded-lg p-4 border">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-accent" />
                        Enviar Stream (RTMP)
                      </h4>
                      <code className="text-sm">rtmp://SEU_IP:1935/push-demo?user=pub&pass=pub123</code>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="files" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold">Arquivos Gerados</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        docker-compose.yml
                      </li>
                      <li className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        mediamtx.yml
                      </li>
                      <li className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        .env.example
                      </li>
                      <li className="flex items-center gap-2">
                        <Download className="w-4 h-4 text-primary" />
                        README.md
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold">Critérios de Aceite</h3>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-accent rounded-full" />
                        Docker compose sobe sem erros
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-accent rounded-full" />
                        RTSP funciona no VLC
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-accent rounded-full" />
                        HLS disponível no navegador
                      </li>
                      <li className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-accent rounded-full" />
                        README com instruções completas
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="pt-4">
                  <Button className="w-full" variant="hero">
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Arquivos de Configuração
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default MediaGatewayCard;