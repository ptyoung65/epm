import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const MetricsAnalytics: React.FC = () => {
  return (
    <PagePlaceholder
      title="실시간 메트릭"
      subtitle="실시간 성능 지표 및 시스템 메트릭 분석"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '성능 분석', href: '/analytics' },
        { label: '실시간 메트릭' }
      ]}
    />
  )
}

export default MetricsAnalytics