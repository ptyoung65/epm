import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const WASMonitoring: React.FC = () => {
  return (
    <PagePlaceholder
      title="WAS 모니터링"
      subtitle="Tomcat, WebLogic, WebSphere 성능 모니터링"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: 'APM 모니터링', href: '/apm' },
        { label: 'WAS 모니터링' }
      ]}
    />
  )
}

export default WASMonitoring