import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const RoleManagement: React.FC = () => {
  return (
    <PagePlaceholder
      title="역할 및 권한 관리"
      subtitle="RBAC 역할 및 권한 시스템 관리"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '인증 및 사용자', href: '/auth' },
        { label: '역할 및 권한' }
      ]}
    />
  )
}

export default RoleManagement