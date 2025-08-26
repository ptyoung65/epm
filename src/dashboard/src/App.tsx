import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from 'react-query'
import Layout from './components/layout/Layout'

// Pages
import Dashboard from './pages/Dashboard'
import APMOverview from './pages/apm/Overview'
import J2EEMonitoring from './pages/apm/J2EEMonitoring'
import WASMonitoring from './pages/apm/WASMonitoring'
import ExceptionTracking from './pages/apm/ExceptionTracking'
import ServiceTopology from './pages/apm/ServiceTopology'
import AlertManagement from './pages/apm/AlertManagement'

import UserManagement from './pages/auth/UserManagement'
import RoleManagement from './pages/auth/RoleManagement'
import SSOSettings from './pages/auth/SSOSettings'
import SecurityAudit from './pages/auth/SecurityAudit'
import TenantManagement from './pages/auth/TenantManagement'

import BusinessMetrics from './pages/analytics/BusinessMetrics'
import MetricsAnalytics from './pages/analytics/MetricsAnalytics'
import PerformanceReports from './pages/analytics/PerformanceReports'
import CapacityPlanning from './pages/analytics/CapacityPlanning'

import GeneralSettings from './pages/settings/GeneralSettings'
import NotificationSettings from './pages/settings/NotificationSettings'
import MonitoringSettings from './pages/settings/MonitoringSettings'

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Layout>
          <Routes>
            {/* Dashboard */}
            <Route path="/" element={<Dashboard />} />

            {/* APM Routes */}
            <Route path="/apm" element={<APMOverview />} />
            <Route path="/apm/j2ee" element={<J2EEMonitoring />} />
            <Route path="/apm/was" element={<WASMonitoring />} />
            <Route path="/apm/exceptions" element={<ExceptionTracking />} />
            <Route path="/apm/topology" element={<ServiceTopology />} />
            <Route path="/apm/alerts" element={<AlertManagement />} />

            {/* Authentication & User Management Routes */}
            <Route path="/auth/users" element={<UserManagement />} />
            <Route path="/auth/roles" element={<RoleManagement />} />
            <Route path="/auth/sso" element={<SSOSettings />} />
            <Route path="/auth/audit" element={<SecurityAudit />} />
            <Route path="/auth/tenants" element={<TenantManagement />} />

            {/* Analytics Routes */}
            <Route path="/analytics" element={<BusinessMetrics />} />
            <Route path="/analytics/business" element={<BusinessMetrics />} />
            <Route path="/analytics/metrics" element={<MetricsAnalytics />} />
            <Route path="/analytics/reports" element={<PerformanceReports />} />
            <Route path="/analytics/capacity" element={<CapacityPlanning />} />

            {/* Settings Routes */}
            <Route path="/settings/general" element={<GeneralSettings />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/settings/monitoring" element={<MonitoringSettings />} />

            {/* 404 Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </Router>
    </QueryClientProvider>
  )
}

// 404 Page Component
const NotFound: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="text-6xl font-bold text-muted-foreground">404</div>
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-muted-foreground text-center max-w-md">
        요청하신 페이지를 찾을 수 없습니다. URL을 확인해주시거나 홈페이지로 이동해주세요.
      </p>
      <div className="flex space-x-4">
        <button 
          onClick={() => window.history.back()} 
          className="px-4 py-2 border rounded-md hover:bg-accent transition-colors"
        >
          이전 페이지
        </button>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          홈페이지로
        </button>
      </div>
    </div>
  )
}

export default App