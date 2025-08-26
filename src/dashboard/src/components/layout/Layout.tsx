import React from 'react'
import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from './Header'
import Sidebar from './Sidebar'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children?: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light'
    }
    return 'light'
  })

  React.useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <motion.aside
          initial={{ x: -280 }}
          animate={{ x: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "fixed left-0 top-0 z-30 h-screen transition-all duration-300",
            sidebarCollapsed ? "w-16" : "w-64",
            "md:relative md:translate-x-0"
          )}
        >
          <Sidebar 
            collapsed={sidebarCollapsed} 
            onToggle={toggleSidebar}
          />
        </motion.aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header */}
          <Header 
            onMenuClick={toggleSidebar}
            onThemeToggle={toggleTheme}
            theme={theme}
          />

          {/* Main Content Area */}
          <main className="flex-1 overflow-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="container mx-auto p-6"
            >
              {children || <Outlet />}
            </motion.div>
          </main>

          {/* Footer */}
          <footer className="border-t bg-background/95 backdrop-blur">
            <div className="container mx-auto px-6 py-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center space-x-4">
                  <span>© 2024 AIRIS EPM. All rights reserved.</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>시스템 정상</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span>버전 1.0.0</span>
                  <span>|</span>
                  <span>업타임: 99.9%</span>
                  <span>|</span>
                  <span>활성 사용자: 1,247명</span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {!sidebarCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={toggleSidebar}
        />
      )}
    </div>
  )
}

// Grid Layout Component for Dashboard Pages
export const GridLayout: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => {
  return (
    <div className={cn(
      "grid gap-6",
      "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      className
    )}>
      {children}
    </div>
  )
}

// Page Layout Component with Title and Breadcrumb
export const PageLayout: React.FC<{
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  actions?: React.ReactNode
  children: React.ReactNode
}> = ({ title, subtitle, breadcrumbs, actions, children }) => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div className="space-y-2">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
              {breadcrumbs.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <span>/</span>}
                  {item.href ? (
                    <a 
                      href={item.href} 
                      className="hover:text-foreground transition-colors"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <span className="text-foreground">{item.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <div>
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        
        {actions && (
          <div className="flex items-center space-x-2">
            {actions}
          </div>
        )}
      </div>

      {/* Page Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// Section Layout for organizing content
export const Section: React.FC<{
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
}> = ({ title, description, children, className }) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-4", className)}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          )}
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      {children}
    </motion.section>
  )
}

export default Layout