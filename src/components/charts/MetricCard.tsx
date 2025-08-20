import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  trend,
  trendValue,
  status = 'info',
  icon,
  className
}) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (status === 'success') return 'text-green-600 dark:text-green-400';
    if (status === 'error') return 'text-red-600 dark:text-red-400';
    if (status === 'warning') return 'text-yellow-600 dark:text-yellow-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getStatusBadge = () => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive',
      info: 'outline'
    };
    
    return variants[status] || 'outline';
  };

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {(trend || trendValue) && (
          <div className="flex items-center gap-2 mt-2">
            {trend && (
              <div className={cn("flex items-center gap-1", getTrendColor())}>
                {getTrendIcon()}
              </div>
            )}
            {trendValue && (
              <Badge variant={getStatusBadge()} className="text-xs">
                {trendValue}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Status indicator bar */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 h-1",
          status === 'success' && "bg-green-500",
          status === 'warning' && "bg-yellow-500",
          status === 'error' && "bg-red-500",
          status === 'info' && "bg-blue-500"
        )}
      />
    </Card>
  );
};