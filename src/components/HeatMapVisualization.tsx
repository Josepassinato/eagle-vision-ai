import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Thermometer, Eye, Clock, Users } from 'lucide-react';

interface HeatMapProps {
  data: number[][];
  width?: number;
  height?: number;
  colorScheme?: 'heat' | 'density' | 'flow';
  overlayImage?: string;
  hotSpots?: Array<{
    x: number;
    y: number;
    intensity: number;
    relative_position: {
      x_percent: number;
      y_percent: number;
    };
  }>;
  onZoneSelect?: (zone: { x: number; y: number; width: number; height: number }) => void;
}

const HeatMapVisualization: React.FC<HeatMapProps> = ({
  data,
  width = 400,
  height = 300,
  colorScheme = 'heat',
  overlayImage,
  hotSpots = [],
  onZoneSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedDataType, setSelectedDataType] = useState<'movement' | 'dwell' | 'interaction'>('movement');
  const [showHotSpots, setShowHotSpots] = useState(true);
  const [selectedZone, setSelectedZone] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const getColorForIntensity = (intensity: number): string => {
    const schemes = {
      heat: [
        { stop: 0, color: [0, 0, 255, 0] },      // Transparent blue
        { stop: 0.2, color: [0, 0, 255, 100] },  // Light blue
        { stop: 0.4, color: [0, 255, 255, 150] }, // Cyan
        { stop: 0.6, color: [0, 255, 0, 180] },  // Green
        { stop: 0.8, color: [255, 255, 0, 200] }, // Yellow
        { stop: 1.0, color: [255, 0, 0, 230] }   // Red
      ],
      density: [
        { stop: 0, color: [255, 255, 255, 0] },
        { stop: 0.3, color: [173, 216, 230, 100] },
        { stop: 0.6, color: [65, 105, 225, 150] },
        { stop: 1.0, color: [25, 25, 112, 200] }
      ],
      flow: [
        { stop: 0, color: [0, 255, 0, 0] },
        { stop: 0.5, color: [255, 255, 0, 120] },
        { stop: 1.0, color: [255, 0, 0, 180] }
      ]
    };

    const scheme = schemes[colorScheme];
    let color = scheme[0].color;

    for (let i = 0; i < scheme.length - 1; i++) {
      if (intensity >= scheme[i].stop && intensity <= scheme[i + 1].stop) {
        const t = (intensity - scheme[i].stop) / (scheme[i + 1].stop - scheme[i].stop);
        color = [
          Math.round(scheme[i].color[0] + t * (scheme[i + 1].color[0] - scheme[i].color[0])),
          Math.round(scheme[i].color[1] + t * (scheme[i + 1].color[1] - scheme[i].color[1])),
          Math.round(scheme[i].color[2] + t * (scheme[i + 1].color[2] - scheme[i].color[2])),
          Math.round(scheme[i].color[3] + t * (scheme[i + 1].color[3] - scheme[i].color[3]))
        ];
        break;
      }
    }

    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})`;
  };

  const drawHeatMap = () => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw overlay image if provided
    if (overlayImage) {
      const img = new Image();
      img.onload = () => {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(img, 0, 0, width, height);
        ctx.globalAlpha = 1.0;
        drawHeatMapData(ctx);
      };
      img.src = overlayImage;
    } else {
      drawHeatMapData(ctx);
    }
  };

  const drawHeatMapData = (ctx: CanvasRenderingContext2D) => {
    const cellWidth = width / data[0].length;
    const cellHeight = height / data.length;

    // Draw heat map cells
    for (let y = 0; y < data.length; y++) {
      for (let x = 0; x < data[y].length; x++) {
        const intensity = data[y][x];
        if (intensity > 0) {
          ctx.fillStyle = getColorForIntensity(intensity);
          ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
        }
      }
    }

    // Draw hot spots
    if (showHotSpots && hotSpots.length > 0) {
      hotSpots.forEach((hotSpot, index) => {
        const spotX = (hotSpot.relative_position.x_percent / 100) * width;
        const spotY = (hotSpot.relative_position.y_percent / 100) * height;
        const radius = Math.max(10, hotSpot.intensity * 20);

        // Draw hot spot circle
        ctx.beginPath();
        ctx.arc(spotX, spotY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw intensity label
        ctx.fillStyle = '#ff0000';
        ctx.font = '12px sans-serif';
        ctx.fillText(`${(hotSpot.intensity * 100).toFixed(0)}%`, spotX + radius + 5, spotY - 5);
      });
    }

    // Draw selected zone
    if (selectedZone) {
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(selectedZone.x, selectedZone.y, selectedZone.width, selectedZone.height);
    }
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !onZoneSelect) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Create a selection zone (100x100 pixels centered on click)
    const zoneWidth = 100;
    const zoneHeight = 100;
    const zone = {
      x: Math.max(0, x - zoneWidth / 2),
      y: Math.max(0, y - zoneHeight / 2),
      width: Math.min(zoneWidth, width - x + zoneWidth / 2),
      height: Math.min(zoneHeight, height - y + zoneHeight / 2)
    };

    setSelectedZone(zone);
    onZoneSelect(zone);
  };

  useEffect(() => {
    drawHeatMap();
  }, [data, colorScheme, showHotSpots, selectedZone, overlayImage]);

  const getDataTypeIcon = (type: string) => {
    switch (type) {
      case 'movement':
        return <Users className="h-4 w-4" />;
      case 'dwell':
        return <Clock className="h-4 w-4" />;
      case 'interaction':
        return <Eye className="h-4 w-4" />;
      default:
        return <Thermometer className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Thermometer className="h-5 w-5" />
            <span>Heat Map Analysis</span>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Select value={selectedDataType} onValueChange={(value: any) => setSelectedDataType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="movement">
                  <div className="flex items-center space-x-2">
                    {getDataTypeIcon('movement')}
                    <span>Movement</span>
                  </div>
                </SelectItem>
                <SelectItem value="dwell">
                  <div className="flex items-center space-x-2">
                    {getDataTypeIcon('dwell')}
                    <span>Dwell Time</span>
                  </div>
                </SelectItem>
                <SelectItem value="interaction">
                  <div className="flex items-center space-x-2">
                    {getDataTypeIcon('interaction')}
                    <span>Interactions</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant={showHotSpots ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHotSpots(!showHotSpots)}
            >
              Hot Spots
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Canvas */}
          <div className="relative border rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={width}
              height={height}
              className="cursor-crosshair"
              onClick={handleCanvasClick}
              style={{ width: '100%', height: 'auto', maxWidth: width }}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">Intensity:</span>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-blue-200 rounded"></div>
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-xs">High</span>
              </div>
            </div>

            {hotSpots.length > 0 && (
              <Badge variant="secondary">
                {hotSpots.length} Hot Spots Detected
              </Badge>
            )}
          </div>

          {/* Hot Spots Summary */}
          {showHotSpots && hotSpots.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Top Hot Spots:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {hotSpots.slice(0, 4).map((spot, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                    <span className="text-sm">
                      Zone {index + 1} ({spot.relative_position.x_percent.toFixed(0)}%, {spot.relative_position.y_percent.toFixed(0)}%)
                    </span>
                    <Badge variant="outline">
                      {(spot.intensity * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <p className="text-xs text-muted-foreground">
            Click on the heat map to select and analyze specific zones. Hot spots indicate areas of high activity.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatMapVisualization;