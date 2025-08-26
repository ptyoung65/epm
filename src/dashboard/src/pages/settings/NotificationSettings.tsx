import React from 'react'
import PagePlaceholder from '../PagePlaceholder'

const NotificationSettings: React.FC = () => {
  return (
    <PagePlaceholder
      title="알림 설정"
      subtitle="이메일, 슬랙, SMS 등 알림 채널 설정"
      breadcrumbs={[
        { label: '대시보드', href: '/' },
        { label: '시스템 설정', href: '/settings' },
        { label: '알림 설정' }
      ]}
    />
  )
}

export default NotificationSettings