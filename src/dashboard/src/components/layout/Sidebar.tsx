import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  BarChart3, 
  Users, 
  Shield, 
  Key, 
  FileText, 
  Building, 
  Settings, 
  Home,
  Activity,
  Database,
  AlertCircle,
  Layers,
  GitBranch,
  Monitor,
  PieChart,
  TrendingUp,
  Server,
  Bug,
  Network,
  Bell
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: {
    text: string
    variant?: 'default' | 'success' | 'warning' | 'error'
  }
  children?: NavItem[]
}

const navItems: NavItem[] = [
  {
    label: '대시보드',
    href: '/',
    icon: Home,
  },
  {
    label: 'APM 모니터링',
    href: '/apm',
    icon: Activity,
    children: [
      {
        label: 'J2EE 모니터링',
        href: '/apm/j2ee',
        icon: Server,
        badge: { text: '실시간', variant: 'success' }
      },
      {
        label: 'WAS 모니터링', 
        href: '/apm/was',
        icon: Database,
      },
      {
        label: '예외 추적',
        href: '/apm/exceptions',
        icon: Bug,
        badge: { text: '7', variant: 'error' }
      },
      {
        label: '서비스 토폴로지',
        href: '/apm/topology',
        icon: Network,
      },
      {
        label: '알림 관리',
        href: '/apm/alerts',
        icon: Bell,
        badge: { text: '3', variant: 'warning' }
      }
    ]
  },
  {
    label: '인증 및 사용자',
    href: '/auth',
    icon: Shield,
    children: [
      {
        label: '사용자 관리',
        href: '/auth/users',
        icon: Users,
      },
      {
        label: '역할 및 권한',
        href: '/auth/roles',
        icon: Key,
      },
      {
        label: 'SSO 설정',
        href: '/auth/sso',
        icon: GitBranch,
      },
      {
        label: '보안 감사',
        href: '/auth/audit',
        icon: FileText,
      },
      {
        label: '테넌트 관리',
        href: '/auth/tenants',
        icon: Building,
      }
    ]
  },
  {
    label: '성능 분석',
    href: '/analytics',
    icon: BarChart3,
    children: [
      {
        label: '실시간 메트릭',
        href: '/analytics/metrics',
        icon: TrendingUp,
      },
      {
        label: '성능 보고서',
        href: '/analytics/reports',
        icon: PieChart,
      },
      {
        label: '용량 계획',
        href: '/analytics/capacity',
        icon: Layers,
      }
    ]
  },
  {
    label: '시스템 설정',
    href: '/settings',
    icon: Settings,
    children: [
      {
        label: '일반 설정',
        href: '/settings/general',
        icon: Settings,
      },
      {
        label: '알림 설정',
        href: '/settings/notifications',
        icon: AlertCircle,
      },
      {
        label: '모니터링 설정',
        href: '/settings/monitoring',
        icon: Monitor,
      }
    ]
  }
]

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false, onToggle }) => {
  const [expandedItems, setExpandedItems] = React.useState<string[]>([])

  const toggleExpanded = (href: string) => {
    setExpandedItems(prev => 
      prev.includes(href) 
        ? prev.filter(item => item !== href)
        : [...prev, href]
    )
  }

  const renderNavItem = (item: NavItem, depth = 0) => {
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.href)
    const hasActiveChild = hasChildren && item.children!.some(child => 
      location.pathname === child.href || location.pathname.startsWith(child.href + '/')
    )

    return (
      <div key={item.href}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.href)}
            className={cn(
              "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              (hasActiveChild) && "bg-accent text-accent-foreground",
              collapsed && "justify-center px-2",
              depth > 0 && "ml-4 pl-6"
            )}
          >
            <div className="flex items-center">
              <item.icon className={cn("h-5 w-5 flex-shrink-0", !collapsed && "mr-3")} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <Badge 
                      variant={item.badge.variant} 
                      size="sm" 
                      className="ml-2"
                    >
                      {item.badge.text}
                    </Badge>
                  )}
                </>
              )}
            </div>
            {!collapsed && hasChildren && (
              <svg
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isExpanded && "rotate-90"
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        ) : (
          <NavLink
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "hover:bg-accent hover:text-accent-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              isActive && "bg-primary text-primary-foreground",
              collapsed && "justify-center px-2",
              depth > 0 && "ml-4 pl-6"
            )}
          >
            <item.icon className={cn("h-5 w-5 flex-shrink-0", !collapsed && "mr-3")} />
            {!collapsed && (
              <>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <Badge 
                    variant={item.badge.variant} 
                    size="sm" 
                    className="ml-2"
                  >
                    {item.badge.text}
                  </Badge>
                )}
              </>
            )}
          </NavLink>
        )}
        
        {hasChildren && (isExpanded || collapsed) && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "flex flex-col h-full bg-card border-r border-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center p-4 border-b border-border">
        <div className={cn(
          "flex items-center transition-all duration-300",
          collapsed && "justify-center"
        )}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">
            A
          </div>
          {!collapsed && (
            <div className="ml-3">
              <h1 className="text-lg font-bold text-foreground">AIRIS EPM</h1>
              <p className="text-xs text-muted-foreground">Enterprise Platform</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map(item => renderNavItem(item))}
      </nav>

      {/* User Info */}
      <div className="p-4 border-t border-border">
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "space-x-3"
        )}>
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <Users className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                관리자
              </p>
              <p className="text-xs text-muted-foreground truncate">
                admin@airis.com
              </p>
            </div>
          )}
        </div>
        
        {!collapsed && (
          <button
            onClick={onToggle}
            className="w-full mt-3 px-3 py-2 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors"
          >
            사이드바 접기
          </button>
        )}
        
        {collapsed && (
          <button
            onClick={onToggle}
            className="w-full mt-3 p-2 hover:bg-muted rounded-lg transition-colors flex justify-center"
            title="사이드바 펼치기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default Sidebar