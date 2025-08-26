import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const MonitoringSettings: React.FC = () => {
  return (
    <PagePlaceholder
      title="모니터링 설정"
      subtitle="메트릭 수집 간격, 임계값, 보존 기간 설정"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '시스템 설정', href: '/settings' },
        { label: '모니터링 설정' }
      ]}
    />
  )
}

export default MonitoringSettings