import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const AlertManagement: React.FC = () => {
  return (
    <PagePlaceholder
      title="알림 관리"
      subtitle="실시간 알림 및 경보 규칙 관리"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링', href: '/apm' },
        { label: '알림 관리' }
      ]}
    />
  )
}

export default AlertManagement