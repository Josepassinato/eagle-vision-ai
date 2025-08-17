import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, MapPin, Eye, EyeOff } from 'lucide-react';
import { useChurchZones, ChurchZone } from '@/hooks/useChurchZones';
import { toast } from 'sonner';

interface ChurchZoneManagerProps {
  cameraId: string;
}

export const ChurchZoneManager: React.FC<ChurchZoneManagerProps> = ({ cameraId }) => {
  const { zones, isLoading, createZone, updateZone, deleteZone, createDefaultZones } = useChurchZones(cameraId);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newZone, setNewZone] = useState<Partial<ChurchZone>>({
    zone_type: 'entrance',
    zone_name: '',
    is_active: true,
    counting_enabled: false,
    privacy_level: 'normal',
    polygon: []
  });

  const handleCreateZone = async () => {
    if (!newZone.zone_name || !newZone.zone_type) {
      toast.error('Nome e tipo da zona são obrigatórios');
      return;
    }

    try {
      await createZone({
        camera_id: cameraId,
        zone_type: newZone.zone_type as ChurchZone['zone_type'],
        zone_name: newZone.zone_name,
        polygon: newZone.polygon || [
          { x: 0.2, y: 0.2 },
          { x: 0.8, y: 0.2 },
          { x: 0.8, y: 0.8 },
          { x: 0.2, y: 0.8 }
        ],
        is_active: newZone.is_active || true,
        counting_enabled: newZone.counting_enabled || false,
        privacy_level: newZone.privacy_level || 'normal'
      });

      toast.success('Zona criada com sucesso');
      setShowCreateForm(false);
      setNewZone({
        zone_type: 'entrance',
        zone_name: '',
        is_active: true,
        counting_enabled: false,
        privacy_level: 'normal',
        polygon: []
      });
    } catch (error) {
      toast.error('Erro ao criar zona');
    }
  };

  const handleToggleZone = async (zone: ChurchZone) => {
    try {
      await updateZone(zone.id, { is_active: !zone.is_active });
      toast.success(`Zona ${zone.is_active ? 'desativada' : 'ativada'}`);
    } catch (error) {
      toast.error('Erro ao atualizar zona');
    }
  };

  const handleToggleCounting = async (zone: ChurchZone) => {
    try {
      await updateZone(zone.id, { counting_enabled: !zone.counting_enabled });
      toast.success(`Contagem ${zone.counting_enabled ? 'desabilitada' : 'habilitada'}`);
    } catch (error) {
      toast.error('Erro ao atualizar contagem');
    }
  };

  const handleDeleteZone = async (zone: ChurchZone) => {
    if (!confirm(`Deseja excluir a zona "${zone.zone_name}"?`)) return;

    try {
      await deleteZone(zone.id);
      toast.success('Zona excluída com sucesso');
    } catch (error) {
      toast.error('Erro ao excluir zona');
    }
  };

  const handleCreateDefaults = async () => {
    try {
      await createDefaultZones(cameraId);
      toast.success('Zonas padrão criadas com sucesso');
    } catch (error) {
      toast.error('Erro ao criar zonas padrão');
    }
  };

  const getZoneTypeLabel = (type: ChurchZone['zone_type']) => {
    const labels = {
      altar: 'Altar',
      corridor: 'Corredor',
      entrance: 'Entrada',
      exit: 'Saída',
      restricted: 'Área Restrita'
    };
    return labels[type];
  };

  const getPrivacyLevelColor = (level: ChurchZone['privacy_level']) => {
    const colors = {
      normal: 'bg-muted',
      high: 'bg-warning',
      no_bio: 'bg-destructive'
    };
    return colors[level];
  };

  if (isLoading) {
    return <div className="text-center p-4">Carregando zonas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gerenciamento de Zonas</h3>
        <div className="space-x-2">
          {zones.length === 0 && (
            <Button onClick={handleCreateDefaults} variant="outline">
              <MapPin className="w-4 h-4 mr-2" />
              Criar Zonas Padrão
            </Button>
          )}
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Zona
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Zona</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zone-name">Nome da Zona</Label>
                <Input
                  id="zone-name"
                  value={newZone.zone_name || ''}
                  onChange={(e) => setNewZone({ ...newZone, zone_name: e.target.value })}
                  placeholder="Ex: Entrada Principal"
                />
              </div>
              <div>
                <Label htmlFor="zone-type">Tipo de Zona</Label>
                <Select
                  value={newZone.zone_type}
                  onValueChange={(value) => setNewZone({ ...newZone, zone_type: value as ChurchZone['zone_type'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrance">Entrada</SelectItem>
                    <SelectItem value="exit">Saída</SelectItem>
                    <SelectItem value="altar">Altar</SelectItem>
                    <SelectItem value="corridor">Corredor</SelectItem>
                    <SelectItem value="restricted">Área Restrita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="privacy-level">Nível de Privacidade</Label>
                <Select
                  value={newZone.privacy_level}
                  onValueChange={(value) => setNewZone({ ...newZone, privacy_level: value as ChurchZone['privacy_level'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="no_bio">Sem Biometria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="counting-enabled"
                    checked={newZone.counting_enabled}
                    onCheckedChange={(checked) => setNewZone({ ...newZone, counting_enabled: checked })}
                  />
                  <Label htmlFor="counting-enabled">Habilitar Contagem</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="zone-active"
                    checked={newZone.is_active}
                    onCheckedChange={(checked) => setNewZone({ ...newZone, is_active: checked })}
                  />
                  <Label htmlFor="zone-active">Zona Ativa</Label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateZone}>
                Criar Zona
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {zones.map((zone) => (
          <Card key={zone.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium">{zone.zone_name}</h4>
                    <Badge variant="secondary">
                      {getZoneTypeLabel(zone.zone_type)}
                    </Badge>
                    <Badge className={getPrivacyLevelColor(zone.privacy_level)}>
                      {zone.privacy_level === 'no_bio' ? 'Sem Bio' : 
                       zone.privacy_level === 'high' ? 'Alto' : 'Normal'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <span>Status: {zone.is_active ? 'Ativa' : 'Inativa'}</span>
                    <span>Contagem: {zone.counting_enabled ? 'Habilitada' : 'Desabilitada'}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleZone(zone)}
                  >
                    {zone.is_active ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleCounting(zone)}
                    disabled={!zone.is_active}
                  >
                    <MapPin className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteZone(zone)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {zones.length === 0 && !showCreateForm && (
        <Card>
          <CardContent className="text-center p-8">
            <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhuma zona configurada</h3>
            <p className="text-muted-foreground mb-4">
              Crie zonas para monitorar áreas específicas da igreja.
            </p>
            <Button onClick={handleCreateDefaults}>
              Criar Zonas Padrão
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};