import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const ExceptionTracking: React.FC = () => {
  return (
    <PagePlaceholder
      title="예외 추적"
      subtitle="애플리케이션 오류 및 예외 상세 모니터링"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링', href: '/apm' },
        { label: '예외 추적' }
      ]}
    />
  )
}

export default ExceptionTracking