import React from 'react';
import { cn } from '../../lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'spinner' | 'dots' | 'pulse' | 'bars';
  className?: string;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16'
};

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg'
};

// 스피너 변형
const SpinnerVariant: React.FC<{ size: string }> = ({ size }) => (
  <div className={cn(
    size,
    "animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
  )} />
);

// 점 변형
const DotsVariant: React.FC<{ size: string }> = ({ size }) => {
  const dotSize = size === sizeClasses.sm ? 'w-1 h-1' : 
                  size === sizeClasses.md ? 'w-2 h-2' :
                  size === sizeClasses.lg ? 'w-3 h-3' : 'w-4 h-4';
  
  return (
    <div className="flex space-x-1">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={cn(
            dotSize,
            "bg-blue-600 rounded-full animate-bounce"
          )}
          style={{
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
};

// 펄스 변형
const PulseVariant: React.FC<{ size: string }> = ({ size }) => (
  <div className={cn(
    size,
    "bg-blue-600 rounded-full animate-pulse"
  )} />
);

// 바 변형
const BarsVariant: React.FC<{ size: string }> = ({ size }) => {
  const barHeight = size === sizeClasses.sm ? 'h-3' : 
                    size === sizeClasses.md ? 'h-6' :
                    size === sizeClasses.lg ? 'h-9' : 'h-12';
  
  return (
    <div className="flex items-end space-x-1">
      {[0, 1, 2, 3].map(i => (
        <div
          key={i}
          className={cn(
            "w-1 bg-blue-600 animate-pulse",
            barHeight
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: '1.2s'
          }}
        />
      ))}
    </div>
  );
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'spinner',
  className,
  text,
  fullScreen = false,
  overlay = false
}) => {
  const sizeClass = sizeClasses[size];
  const textSizeClass = textSizeClasses[size];

  const renderVariant = () => {
    switch (variant) {
      case 'dots':
        return <DotsVariant size={sizeClass} />;
      case 'pulse':
        return <PulseVariant size={sizeClass} />;
      case 'bars':
        return <BarsVariant size={sizeClass} />;
      default:
        return <SpinnerVariant size={sizeClass} />;
    }
  };

  const content = (
    <div className={cn(
      "flex flex-col items-center justify-center gap-3",
      className
    )}>
      {renderVariant()}
      {text && (
        <p className={cn(
          "text-gray-600 font-medium",
          textSizeClass
        )}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        overlay ? "bg-black/50" : "bg-white"
      )}>
        {content}
      </div>
    );
  }

  return content;
};

// 스켈레톤 로더 컴포넌트
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'circular' | 'text';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  variant = 'rectangular',
  animation = 'pulse'
}) => {
  const baseClasses = "bg-gray-200";
  
  const variantClasses = {
    rectangular: "rounded",
    circular: "rounded-full",
    text: "rounded h-4"
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%]",
    none: ""
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={style}
    />
  );
};

// 카드 스켈레톤 컴포넌트
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("p-4 space-y-4", className)}>
    <Skeleton height={24} width="60%" />
    <Skeleton height={16} width="40%" />
    <div className="space-y-2">
      <Skeleton height={12} width="100%" />
      <Skeleton height={12} width="80%" />
      <Skeleton height={12} width="90%" />
    </div>
  </div>
);

// 테이블 스켈레톤 컴포넌트
export const TableSkeleton: React.FC<{ 
  rows?: number;
  columns?: number;
  className?: string;
}> = ({ 
  rows = 5, 
  columns = 4,
  className 
}) => (
  <div className={cn("space-y-3", className)}>
    {/* 헤더 */}
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: columns }, (_, i) => (
        <Skeleton key={i} height={20} />
      ))}
    </div>
    
    {/* 행들 */}
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, colIndex) => (
          <Skeleton key={colIndex} height={16} />
        ))}
      </div>
    ))}
  </div>
);

// 차트 스켈레톤 컴포넌트
export const ChartSkeleton: React.FC<{ 
  height?: number;
  className?: string;
}> = ({ 
  height = 300,
  className 
}) => (
  <div className={cn("space-y-4", className)}>
    <div className="flex justify-between items-center">
      <Skeleton height={24} width={200} />
      <Skeleton height={16} width={80} />
    </div>
    <Skeleton height={height} className="rounded-lg" />
    <div className="flex justify-center space-x-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center space-x-2">
          <Skeleton width={12} height={12} variant="circular" />
          <Skeleton height={12} width={60} />
        </div>
      ))}
    </div>
  </div>
);

export default LoadingSpinner;