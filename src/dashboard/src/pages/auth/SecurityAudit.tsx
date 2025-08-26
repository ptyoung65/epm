import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const SecurityAudit: React.FC = () => {
  return (
    <PagePlaceholder
      title="보안 감사"
      subtitle="보안 이벤트 및 감사 로그 모니터링"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '인증 및 사용자', href: '/auth' },
        { label: '보안 감사' }
      ]}
    />
  )
}

export default SecurityAudit