import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const CapacityPlanning: React.FC = () => {
  return (
    <PagePlaceholder
      title="용량 계획"
      subtitle="리소스 사용량 및 용량 예측 분석"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '성능 분석', href: '/analytics' },
        { label: '용량 계획' }
      ]}
    />
  )
}

export default CapacityPlanning