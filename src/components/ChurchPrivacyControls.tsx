import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { usePrivacyMode } from '@/hooks/usePrivacyMode';
import { toast } from 'sonner';

export const ChurchPrivacyControls: React.FC = () => {
  const { 
    config, 
    isLoading, 
    updatePrivacyConfig, 
    enableNoBioMode, 
    disableNoBioMode, 
    getPrivacyLevel, 
    isCompliant 
  } = usePrivacyMode();

  const handleToggleNoBio = async () => {
    try {
      if (config.mode_no_bio) {
        await disableNoBioMode();
        toast.success('Modo Sem Biometria desabilitado');
      } else {
        await enableNoBioMode();
        toast.success('Modo Sem Biometria habilitado');
      }
    } catch (error) {
      toast.error('Erro ao alterar modo de privacidade');
    }
  };

  const handleUpdateConfig = async (updates: Partial<typeof config>) => {
    try {
      await updatePrivacyConfig(updates);
      toast.success('Configurações de privacidade atualizadas');
    } catch (error) {
      toast.error('Erro ao atualizar configurações');
    }
  };

  const getPrivacyLevelColor = () => {
    const level = getPrivacyLevel();
    const colors = {
      low: 'bg-destructive',
      medium: 'bg-warning',
      high: 'bg-success',
      no_bio: 'bg-primary'
    };
    return colors[level];
  };

  const getPrivacyLevelLabel = () => {
    const level = getPrivacyLevel();
    const labels = {
      low: 'Baixo',
      medium: 'Médio',
      high: 'Alto',
      no_bio: 'Sem Biometria'
    };
    return labels[level];
  };

  if (isLoading) {
    return <div className="text-center p-4">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Privacy Level Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5" />
              <span>Nível de Privacidade</span>
            </CardTitle>
            <Badge className={getPrivacyLevelColor()}>
              {getPrivacyLevelLabel()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!isCompliant() && (
            <Alert className="mb-4">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                As configurações atuais podem não estar em conformidade com as leis de privacidade. 
                Recomendamos habilitar pelo menos o blur de rostos.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Modo Sem Biometria</Label>
                <p className="text-sm text-muted-foreground">
                  Ativa anonimização completa - rostos, corpos e áudio
                </p>
              </div>
              <Switch
                checked={config.mode_no_bio}
                onCheckedChange={handleToggleNoBio}
              />
            </div>

            {config.mode_no_bio && (
              <Alert>
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  Modo Sem Biometria ativo. Todos os dados pessoais são automaticamente anonimizados.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Privacy Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controles de Privacidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center space-x-2">
                    <EyeOff className="w-4 h-4" />
                    <span>Blur de Rostos</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automaticamente desfoca rostos detectados
                  </p>
                </div>
                <Switch
                  checked={config.blur_faces}
                  onCheckedChange={(checked) => handleUpdateConfig({ blur_faces: checked })}
                  disabled={config.mode_no_bio}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <span>Blur de Corpos</span>
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Desfoca corpos inteiros para máxima privacidade
                  </p>
                </div>
                <Switch
                  checked={config.blur_bodies}
                  onCheckedChange={(checked) => handleUpdateConfig({ blur_bodies: checked })}
                  disabled={config.mode_no_bio}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Anonimizar Áudio</Label>
                  <p className="text-sm text-muted-foreground">
                    Remove ou modifica características de voz
                  </p>
                </div>
                <Switch
                  checked={config.anonymize_audio}
                  onCheckedChange={(checked) => handleUpdateConfig({ anonymize_audio: checked })}
                  disabled={config.mode_no_bio}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="flex items-center space-x-2 mb-3">
                  <Clock className="w-4 h-4" />
                  <span>Retenção de Dados: {config.retention_hours}h</span>
                </Label>
                <Slider
                  value={[config.retention_hours]}
                  onValueChange={([value]) => handleUpdateConfig({ retention_hours: value })}
                  max={168} // 7 days
                  min={1}
                  step={1}
                  disabled={config.mode_no_bio}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1h</span>
                  <span>7 dias</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Consentimento Obrigatório</Label>
                  <p className="text-sm text-muted-foreground">
                    Requer consentimento explícito dos visitantes
                  </p>
                </div>
                <Switch
                  checked={config.consent_required}
                  onCheckedChange={(checked) => handleUpdateConfig({ consent_required: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => handleUpdateConfig({
                blur_faces: false,
                blur_bodies: false,
                anonymize_audio: false,
                retention_hours: 168
              })}
              disabled={config.mode_no_bio}
            >
              Privacidade Baixa
            </Button>

            <Button
              variant="outline"
              onClick={() => handleUpdateConfig({
                blur_faces: true,
                blur_bodies: false,
                anonymize_audio: false,
                retention_hours: 72
              })}
              disabled={config.mode_no_bio}
            >
              Privacidade Média
            </Button>

            <Button
              variant="outline"
              onClick={() => handleUpdateConfig({
                blur_faces: true,
                blur_bodies: true,
                anonymize_audio: true,
                retention_hours: 24
              })}
              disabled={config.mode_no_bio}
            >
              Privacidade Alta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações de Conformidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm">LGPD - Lei Geral de Proteção de Dados</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm">GDPR - Regulamento Europeu de Proteção de Dados</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-success" />
              <span className="text-sm">Diretrizes de Privacidade Religiosa</span>
            </div>
          </div>
          
          <Alert className="mt-4">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Sempre consulte um advogado especializado em privacidade para garantir 
              conformidade total com as leis locais e regulamentações específicas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};