import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Download, Sparkles, TrendingUp, Shield, Activity, DollarSign, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import DailyReportsManager from "@/components/DailyReportsManager";

interface ReportData {
  report: string;
  reportId: string;
  metadata: any;
}

export default function AIReports() {
  const [reportType, setReportType] = useState<string>("");
  const [timeRange, setTimeRange] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<ReportData | null>(null);

  const reportTypes = [
    { value: "security", label: "Relatório de Segurança", icon: Shield, color: "text-red-500" },
    { value: "performance", label: "Análise de Performance", icon: Activity, color: "text-blue-500" },
    { value: "incidents", label: "Relatório de Incidentes", icon: FileText, color: "text-orange-500" },
    { value: "roi", label: "Análise de ROI", icon: DollarSign, color: "text-green-500" }
  ];

  const timeRanges = [
    { value: "24h", label: "Últimas 24 horas" },
    { value: "7d", label: "Últimos 7 dias" },
    { value: "30d", label: "Últimos 30 dias" }
  ];

  const handleGenerateReport = async () => {
    if (!reportType || !timeRange) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo de relatório e período",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-report-generator', {
        body: {
          reportType,
          timeRange,
          includeRecommendations: true
        }
      });

      if (error) throw error;

      setCurrentReport(data);
      toast({
        title: "Relatório gerado com sucesso",
        description: "O relatório foi gerado pela IA com insights inteligentes"
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Tente novamente em alguns instantes",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = () => {
    if (!currentReport) return;

    const blob = new Blob([currentReport.report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${reportType}-${timeRange}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedReportType = reportTypes.find(r => r.value === reportType);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Relatórios com IA</h1>
          <p className="text-muted-foreground">Gere relatórios inteligentes com insights automáticos</p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Powered by GPT-4
        </Badge>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="daily" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Relatórios Diários
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Relatórios Personalizados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <DailyReportsManager />
        </TabsContent>

        <TabsContent value="custom" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuração do Relatório */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Configurar Relatório
                </CardTitle>
                <CardDescription>
                  Selecione o tipo de análise e período
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Relatório</label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha o tipo de relatório" />
                    </SelectTrigger>
                    <SelectContent>
                      {reportTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className={`h-4 w-4 ${type.color}`} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Período de Análise</label>
                  <Select value={timeRange} onValueChange={setTimeRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o período" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <Button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating || !reportType || !timeRange}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Gerando com IA...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Gerar Relatório
                    </>
                  )}
                </Button>

                {currentReport && (
                  <Button 
                    variant="outline" 
                    onClick={handleDownloadReport}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Relatório
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Visualização do Relatório */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {selectedReportType && <selectedReportType.icon className={`h-5 w-5 ${selectedReportType.color}`} />}
                  {selectedReportType?.label || "Relatório"}
                </CardTitle>
                <CardDescription>
                  {currentReport ? "Relatório gerado com insights da IA" : "Configure e gere um relatório para visualizar"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentReport ? (
                  <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {currentReport.report}
                      </pre>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[600px] text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum relatório gerado</h3>
                    <p className="text-muted-foreground">
                      Configure os parâmetros e clique em "Gerar Relatório" para criar um relatório com IA
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}