import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const GeneralSettings: React.FC = () => {
  return (
    <PagePlaceholder
      title="일반 설정"
      subtitle="시스템 기본 설정 및 환경 구성"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '시스템 설정', href: '/settings' },
        { label: '일반 설정' }
      ]}
    />
  )
}

export default GeneralSettings