import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'good' | 'warning' | 'critical';
  icon?: React.ReactNode;
  description?: string;
}

const RealTimeMetricCard = ({
  title,
  value,
  unit,
  trend,
  trendValue,
  status = 'good',
  icon,
  description
}: MetricCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusIcon = () => {
    if (status === 'critical' || status === 'warning') {
      return <AlertTriangle className="h-4 w-4" />;
    }
    return null;
  };

  return (
    <Card className="relative overflow-hidden transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-muted-foreground">
              {icon}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Main Value */}
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold tracking-tight">
              {value}
            </span>
            {unit && (
              <span className="text-sm text-muted-foreground">
                {unit}
              </span>
            )}
          </div>

          {/* Trend and Status */}
          <div className="flex items-center justify-between">
            {trend && trendValue && (
              <div className="flex items-center space-x-1">
                {getTrendIcon()}
                <span className={`text-xs font-medium ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 
                  'text-gray-600'
                }`}>
                  {trendValue}
                </span>
              </div>
            )}

            {status !== 'good' && (
              <Badge 
                variant="outline" 
                className={`text-xs ${getStatusColor()}`}
              >
                <div className="flex items-center space-x-1">
                  {getStatusIcon()}
                  <span className="capitalize">{status}</span>
                </div>
              </Badge>
            )}
          </div>

          {/* Description */}
          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Animated indicator for real-time updates */}
        <div className="absolute top-0 right-0 w-2 h-2 m-2">
          <div className="w-full h-full bg-green-500 rounded-full animate-pulse"></div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RealTimeMetricCard;