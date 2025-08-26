import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const SSOSettings: React.FC = () => {
  return (
    <PagePlaceholder
      title="SSO 설정"
      subtitle="Single Sign-On 제공자 및 인증 설정"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '인증 및 사용자', href: '/auth' },
        { label: 'SSO 설정' }
      ]}
    />
  )
}

export default SSOSettings