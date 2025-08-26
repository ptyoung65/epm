import React from 'react'
import { PageLayout } from '@/components/layout/Layout'

const APMOverview: React.FC = () => {
  return (
    <PageLayout
      title="APM 개요"
      subtitle="애플리케이션 성능 모니터링 전체 현황"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링' }
      ]}
    >
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
        <p className="text-muted-foreground">APM 개요 페이지 (구현 예정)</p>
      </div>
    </PageLayout>
  )
}

export default APMOverview