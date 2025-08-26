import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const PerformanceReports: React.FC = () => {
  return (
    <PagePlaceholder
      title="성능 보고서"
      subtitle="상세한 성능 분석 보고서 및 대시보드"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '성능 분석', href: '/analytics' },
        { label: '성능 보고서' }
      ]}
    />
  )
}

export default PerformanceReports