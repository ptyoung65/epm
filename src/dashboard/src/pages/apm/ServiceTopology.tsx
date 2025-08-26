import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const ServiceTopology: React.FC = () => {
  return (
    <PagePlaceholder
      title="서비스 토폴로지"
      subtitle="서비스 간 의존성 및 호출 관계 시각화"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링', href: '/apm' },
        { label: '서비스 토폴로지' }
      ]}
    />
  )
}

export default ServiceTopology