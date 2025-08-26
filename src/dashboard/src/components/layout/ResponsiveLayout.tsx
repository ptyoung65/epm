import React, { useState, useEffect, ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { 
  Menu,
  X,
  Home,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Settings,
  User,
  Bell,
  Search,
  ChevronLeft,
  Monitor,
  Tablet,
  Smartphone
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ResponsiveLayoutProps {
  children: ReactNode;
  title?: string;
  showNavigation?: boolean;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  active?: boolean;
}

// 네비게이션 아이템들
const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: <Home className="w-5 h-5" />,
    href: '/',
    active: true
  },
  {
    id: 'executive',
    label: '임원 대시보드',
    icon: <TrendingUp className="w-5 h-5" />,
    href: '/executive',
  },
  {
    id: 'kpi',
    label: 'KPI 관리',
    icon: <BarChart3 className="w-5 h-5" />,
    href: '/kpi',
  },
  {
    id: 'alerts',
    label: '알림 관리',
    icon: <AlertTriangle className="w-5 h-5" />,
    href: '/alerts',
    badge: 3
  },
  {
    id: 'settings',
    label: '설정',
    icon: <Settings className="w-5 h-5" />,
    href: '/settings',
  }
];

// 반응형 감지 훅
const useResponsive = () => {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });
      
      if (width < 768) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
    };

    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    
    return () => window.removeEventListener('resize', updateScreenSize);
  }, []);

  return { deviceType, screenSize };
};

// 모바일 네비게이션 컴포넌트
const MobileNavigation: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  items: NavigationItem[];
}> = ({ isOpen, onClose, items }) => {
  return (
    <>
      {/* 오버레이 */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* 사이드 메뉴 */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 lg:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">AIRIS EPM</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    item.active 
                      ? "bg-blue-100 text-blue-700"
                      : "hover:bg-gray-100 text-gray-700"
                  )}
                  onClick={onClose}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.badge && (
                    <Badge variant="destructive" className="ml-auto">
                      {item.badge}
                    </Badge>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
};

// 태블릿 네비게이션 (하단 탭바)
const TabletNavigation: React.FC<{
  items: NavigationItem[];
}> = ({ items }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg md:hidden">
      <nav className="flex">
        {items.slice(0, 5).map((item) => (
          <a
            key={item.id}
            href={item.href}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 px-1 relative transition-colors",
              item.active 
                ? "text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {item.icon}
            <span className="text-xs font-medium truncate">{item.label}</span>
            {item.badge && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 w-5 h-5 p-0 text-xs flex items-center justify-center"
              >
                {item.badge}
              </Badge>
            )}
          </a>
        ))}
      </nav>
    </div>
  );
};

// 데스크톱 사이드바
const DesktopSidebar: React.FC<{
  items: NavigationItem[];
  collapsed: boolean;
}> = ({ items, collapsed }) => {
  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-30 bg-white border-r shadow-sm transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex items-center justify-center h-16 border-b">
        {!collapsed && <h1 className="text-xl font-bold text-gray-800">AIRIS EPM</h1>}
        {collapsed && <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">A</span>
        </div>}
      </div>
      
      <nav className="p-4">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                  item.active 
                    ? "bg-blue-100 text-blue-700"
                    : "hover:bg-gray-100 text-gray-700"
                )}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="font-medium">{item.label}</span>
                    {item.badge && (
                      <Badge variant="destructive" className="ml-auto">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <Badge 
                    variant="destructive" 
                    className="absolute left-8 w-5 h-5 p-0 text-xs flex items-center justify-center"
                  >
                    {item.badge}
                  </Badge>
                )}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

// 상단 헤더 컴포넌트
const Header: React.FC<{
  title?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  onMenuClick?: () => void;
  onSidebarToggle?: () => void;
  sidebarCollapsed?: boolean;
}> = ({ title, deviceType, onMenuClick, onSidebarToggle, sidebarCollapsed }) => {
  return (
    <header className={cn(
      "bg-white border-b shadow-sm z-20",
      deviceType === 'desktop' ? (sidebarCollapsed ? "ml-16" : "ml-64") : "",
      deviceType === 'tablet' ? "pb-16" : ""
    )}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          {deviceType === 'mobile' && (
            <Button variant="ghost" size="sm" onClick={onMenuClick}>
              <Menu className="w-5 h-5" />
            </Button>
          )}
          
          {deviceType === 'desktop' && (
            <Button variant="ghost" size="sm" onClick={onSidebarToggle}>
              <ChevronLeft className={cn(
                "w-5 h-5 transition-transform",
                sidebarCollapsed ? "rotate-180" : ""
              )} />
            </Button>
          )}
          
          <div>
            {title && <h1 className="text-xl font-semibold text-gray-800">{title}</h1>}
            {deviceType !== 'mobile' && (
              <p className="text-sm text-gray-500">실시간 모니터링 대시보드</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 디바이스 타입 표시 */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {deviceType === 'mobile' && <Smartphone className="w-4 h-4" />}
            {deviceType === 'tablet' && <Tablet className="w-4 h-4" />}
            {deviceType === 'desktop' && <Monitor className="w-4 h-4" />}
            {deviceType}
          </div>

          {/* 검색 (데스크톱/태블릿만) */}
          {deviceType !== 'mobile' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="검색..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          )}

          {/* 알림 버튼 */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <Badge variant="destructive" className="absolute -top-1 -right-1 w-5 h-5 p-0 text-xs flex items-center justify-center">
              3
            </Badge>
          </Button>

          {/* 사용자 메뉴 */}
          <Button variant="ghost" size="sm">
            <User className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

// 메인 반응형 레이아웃 컴포넌트
export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  title = "대시보드",
  showNavigation = true
}) => {
  const { deviceType, screenSize } = useResponsive();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 화면 크기 변경시 모바일 메뉴 자동 닫기
  useEffect(() => {
    if (deviceType !== 'mobile') {
      setMobileMenuOpen(false);
    }
  }, [deviceType]);

  // ESC 키로 모바일 메뉴 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  if (!showNavigation) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title={title} deviceType={deviceType} />
        <main className={cn(
          "transition-all duration-300",
          deviceType === 'tablet' ? "pb-16" : ""
        )}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 네비게이션 컴포넌트들 */}
      {deviceType === 'mobile' && (
        <MobileNavigation
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          items={navigationItems}
        />
      )}

      {deviceType === 'tablet' && (
        <TabletNavigation items={navigationItems} />
      )}

      {deviceType === 'desktop' && (
        <DesktopSidebar 
          items={navigationItems} 
          collapsed={sidebarCollapsed}
        />
      )}

      {/* 헤더 */}
      <Header
        title={title}
        deviceType={deviceType}
        onMenuClick={() => setMobileMenuOpen(true)}
        onSidebarToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />

      {/* 메인 콘텐츠 */}
      <main className={cn(
        "transition-all duration-300 p-4",
        deviceType === 'desktop' ? (sidebarCollapsed ? "ml-16" : "ml-64") : "",
        deviceType === 'tablet' ? "pb-20" : ""
      )}>
        <div className="max-w-full">
          {children}
        </div>
      </main>

      {/* 개발자 디버그 정보 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white text-xs p-2 rounded z-50">
          <div>Device: {deviceType}</div>
          <div>Screen: {screenSize.width} x {screenSize.height}</div>
        </div>
      )}
    </div>
  );
};

// 반응형 그리드 컴포넌트
export const ResponsiveGrid: React.FC<{
  children: ReactNode;
  className?: string;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
}> = ({ children, className, cols = { mobile: 1, tablet: 2, desktop: 3 }, gap = 4 }) => {
  const { deviceType } = useResponsive();
  
  const currentCols = cols[deviceType] || cols.desktop || 3;
  const gapClass = `gap-${gap}`;
  
  return (
    <div className={cn(
      "grid",
      `grid-cols-${currentCols}`,
      gapClass,
      className
    )}>
      {children}
    </div>
  );
};

// 반응형 카드 컴포넌트
export const ResponsiveCard: React.FC<{
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}> = ({ children, className, padding = 'md' }) => {
  const { deviceType } = useResponsive();
  
  const paddingClasses = {
    sm: deviceType === 'mobile' ? 'p-3' : 'p-4',
    md: deviceType === 'mobile' ? 'p-4' : 'p-6',
    lg: deviceType === 'mobile' ? 'p-6' : 'p-8'
  };

  return (
    <div className={cn(
      "bg-white rounded-lg shadow-sm border",
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  );
};

export default ResponsiveLayout;