import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// AIRIS EPM Enhanced Card Components
const MetricCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string
    value: string | number
    change?: {
      value: string | number
      type: 'increase' | 'decrease' | 'neutral'
    }
    icon?: React.ReactNode
    trend?: Array<{ value: number; label?: string }>
    className?: string
  }
>(({ title, value, change, icon, trend, className, ...props }, ref) => (
  <Card ref={ref} className={cn("p-6", className)} {...props}>
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <p className="text-sm font-medium leading-none text-muted-foreground">
          {title}
        </p>
        <p className="text-3xl font-bold">{value}</p>
        {change && (
          <div className="flex items-center space-x-1 text-sm">
            <span
              className={cn(
                "inline-flex items-center font-medium",
                change.type === 'increase' && "text-green-600",
                change.type === 'decrease' && "text-red-600",
                change.type === 'neutral' && "text-gray-600"
              )}
            >
              {change.type === 'increase' && '↑'}
              {change.type === 'decrease' && '↓'}
              {change.type === 'neutral' && '→'}
              {change.value}
            </span>
          </div>
        )}
      </div>
      {icon && (
        <div className="text-muted-foreground">
          {icon}
        </div>
      )}
    </div>
    {trend && trend.length > 0 && (
      <div className="mt-4">
        {/* Simple trend visualization - can be replaced with actual chart */}
        <div className="flex items-end space-x-1 h-8">
          {trend.map((point, index) => (
            <div
              key={index}
              className="bg-primary/20 rounded-sm flex-1"
              style={{ height: `${(point.value / Math.max(...trend.map(t => t.value))) * 100}%` }}
            />
          ))}
        </div>
      </div>
    )}
  </Card>
))
MetricCard.displayName = "MetricCard"

const StatusCard = React.forwardRef<
  HTMLDivElement,
  {
    title: string
    status: 'success' | 'warning' | 'error' | 'info'
    description?: string
    actions?: React.ReactNode
    className?: string
  }
>(({ title, status, description, actions, className, ...props }, ref) => {
  const statusStyles = {
    success: "border-green-200 bg-green-50",
    warning: "border-yellow-200 bg-yellow-50",
    error: "border-red-200 bg-red-50",
    info: "border-blue-200 bg-blue-50",
  }

  const statusIcons = {
    success: "✅",
    warning: "⚠️",
    error: "❌",
    info: "ℹ️",
  }

  return (
    <Card 
      ref={ref} 
      className={cn("border-l-4", statusStyles[status], className)} 
      {...props}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <span className="text-lg">{statusIcons[status]}</span>
            <div>
              <h4 className="font-medium">{title}</h4>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && <div className="ml-4">{actions}</div>}
        </div>
      </CardContent>
    </Card>
  )
})
StatusCard.displayName = "StatusCard"

export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  MetricCard,
  StatusCard
}