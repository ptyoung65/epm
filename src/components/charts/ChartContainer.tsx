import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  Download, 
  Maximize2, 
  RefreshCw, 
  Settings,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  height?: string;
  loading?: boolean;
  error?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onFullscreen?: () => void;
  timeRange?: string;
  onTimeRangeChange?: (value: string) => void;
  status?: 'normal' | 'warning' | 'critical';
  badge?: string;
  tabs?: Array<{
    value: string;
    label: string;
    content: React.ReactNode;
  }>;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  description,
  children,
  className,
  height = 'h-80',
  loading = false,
  error,
  onRefresh,
  onExport,
  onFullscreen,
  timeRange,
  onTimeRangeChange,
  status = 'normal',
  badge,
  tabs
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const getStatusColor = () => {
    switch (status) {
      case 'warning':
        return 'border-yellow-500 dark:border-yellow-400';
      case 'critical':
        return 'border-red-500 dark:border-red-400';
      default:
        return '';
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'warning':
        return <Badge variant="secondary" className="ml-2">경고</Badge>;
      case 'critical':
        return <Badge variant="destructive" className="ml-2">위험</Badge>;
      default:
        return null;
    }
  };

  const timeRangeOptions = [
    { value: '15m', label: '15분' },
    { value: '1h', label: '1시간' },
    { value: '6h', label: '6시간' },
    { value: '24h', label: '24시간' },
    { value: '7d', label: '7일' },
    { value: '30d', label: '30일' },
  ];

  return (
    <Card 
      ref={containerRef}
      className={cn("relative", getStatusColor(), className)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-medium">
            {title}
            {getStatusBadge()}
            {badge && (
              <Badge variant="outline" className="ml-2">
                {badge}
              </Badge>
            )}
          </CardTitle>
        </div>
        
        <div className="flex items-center gap-2">
          {timeRange && onTimeRangeChange && (
            <Select value={timeRange} onValueChange={onTimeRangeChange}>
              <SelectTrigger className="h-8 w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeRangeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>차트 옵션</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {onFullscreen && (
                <DropdownMenuItem onClick={onFullscreen}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  전체화면
                </DropdownMenuItem>
              )}
              {onExport && (
                <DropdownMenuItem onClick={onExport}>
                  <Download className="mr-2 h-4 w-4" />
                  내보내기
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                설정
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      {description && (
        <CardDescription className="px-6 pb-2">
          {description}
        </CardDescription>
      )}
      
      <CardContent className="p-0">
        {tabs ? (
          <Tabs defaultValue={tabs[0].value} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map(tab => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <div className={cn("p-6", height)}>
                  {loading ? (
                    <ChartSkeleton />
                  ) : error ? (
                    <ChartError error={error} />
                  ) : (
                    tab.content
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className={cn("p-6", height)}>
            {loading ? (
              <ChartSkeleton />
            ) : error ? (
              <ChartError error={error} />
            ) : (
              children
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ChartSkeleton: React.FC = () => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-2">
      <Activity className="h-8 w-8 animate-pulse text-muted-foreground" />
      <p className="text-sm text-muted-foreground">데이터 로딩 중...</p>
    </div>
  </div>
);

const ChartError: React.FC<{ error: string }> = ({ error }) => (
  <div className="flex h-full w-full items-center justify-center">
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <Activity className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-medium">차트 로드 실패</p>
      <p className="text-xs text-muted-foreground">{error}</p>
    </div>
  </div>
);