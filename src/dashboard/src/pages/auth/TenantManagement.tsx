import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const TenantManagement: React.FC = () => {
  return (
    <PagePlaceholder
      title="테넌트 관리"
      subtitle="멀티테넌트 환경 및 리소스 관리"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '인증 및 사용자', href: '/auth' },
        { label: '테넌트 관리' }
      ]}
    />
  )
}

export default TenantManagement