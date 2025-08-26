import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const UserManagement: React.FC = () => {
  return (
    <PagePlaceholder
      title="사용자 관리"
      subtitle="사용자 계정, 권한 및 로그인 상태 관리"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '인증 및 사용자', href: '/auth' },
        { label: '사용자 관리' }
      ]}
    />
  )
}

export default UserManagement