import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status variants
        success: "border-transparent bg-green-100 text-green-800 hover:bg-green-200",
        warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
        error: "border-transparent bg-red-100 text-red-800 hover:bg-red-200",
        info: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200",
        // Severity variants
        low: "border-transparent bg-blue-50 text-blue-700 border-blue-200",
        medium: "border-transparent bg-yellow-50 text-yellow-700 border-yellow-200",
        high: "border-transparent bg-orange-50 text-orange-700 border-orange-200",
        critical: "border-transparent bg-red-50 text-red-700 border-red-200",
        // Role variants
        admin: "border-transparent bg-purple-50 text-purple-700 border-purple-200",
        manager: "border-transparent bg-blue-50 text-blue-700 border-blue-200",
        analyst: "border-transparent bg-green-50 text-green-700 border-green-200",
        user: "border-transparent bg-gray-50 text-gray-700 border-gray-200",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-2xs",
        lg: "px-3 py-1 text-sm",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
  removable?: boolean
  onRemove?: () => void
}

function Badge({ 
  className, 
  variant, 
  size, 
  dot = false,
  removable = false,
  onRemove,
  children,
  ...props 
}: BadgeProps) {
  return (
    <div 
      className={cn(
        badgeVariants({ variant, size }), 
        dot && "pl-1.5",
        removable && "pr-1",
        className
      )} 
      {...props}
    >
      {dot && (
        <div className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      )}
      {children}
      {removable && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          type="button"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  )
}

// Status Badge Component
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'error' | 'success' | 'warning'
  children?: React.ReactNode
  className?: string
}

function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const statusMap = {
    active: { variant: 'success' as const, text: '활성' },
    inactive: { variant: 'default' as const, text: '비활성' },
    pending: { variant: 'warning' as const, text: '대기중' },
    error: { variant: 'error' as const, text: '오류' },
    success: { variant: 'success' as const, text: '성공' },
    warning: { variant: 'warning' as const, text: '경고' },
  }

  const config = statusMap[status] || statusMap.inactive

  return (
    <Badge variant={config.variant} className={className} dot>
      {children || config.text}
    </Badge>
  )
}

// Role Badge Component
interface RoleBadgeProps {
  role: 'admin' | 'manager' | 'analyst' | 'user' | 'viewer' | 'guest'
  className?: string
}

function RoleBadge({ role, className }: RoleBadgeProps) {
  const roleMap = {
    admin: { variant: 'admin' as const, text: '관리자' },
    manager: { variant: 'manager' as const, text: '매니저' },
    analyst: { variant: 'analyst' as const, text: '분석가' },
    user: { variant: 'user' as const, text: '사용자' },
    viewer: { variant: 'user' as const, text: '조회자' },
    guest: { variant: 'user' as const, text: '게스트' },
  }

  const config = roleMap[role] || roleMap.user

  return (
    <Badge variant={config.variant} className={className}>
      {config.text}
    </Badge>
  )
}

// Severity Badge Component
interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high' | 'critical'
  className?: string
}

function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const severityMap = {
    low: { variant: 'low' as const, text: '낮음' },
    medium: { variant: 'medium' as const, text: '보통' },
    high: { variant: 'high' as const, text: '높음' },
    critical: { variant: 'critical' as const, text: '심각' },
  }

  const config = severityMap[severity] || severityMap.low

  return (
    <Badge variant={config.variant} className={className}>
      {config.text}
    </Badge>
  )
}

export { Badge, badgeVariants, StatusBadge, RoleBadge, SeverityBadge }