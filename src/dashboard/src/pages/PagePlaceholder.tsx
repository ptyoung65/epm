import React from 'react'
import { PageLayout } from '@/components/layout/Layout'

interface PagePlaceholderProps {
  title: string
  subtitle?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
}

const PagePlaceholder: React.FC<PagePlaceholderProps> = ({ 
  title, 
  subtitle, 
  breadcrumbs 
}) => {
  return (
    <PageLayout
      title={title}
      subtitle={subtitle}
      breadcrumbs={breadcrumbs}
    >
      <div className="flex flex-col items-center justify-center h-96 bg-muted rounded-lg space-y-4">
        <div className="text-4xl">🚧</div>
        <h3 className="text-lg font-medium">개발 중인 페이지</h3>
        <p className="text-muted-foreground text-center max-w-md">
          {title} 페이지는 현재 개발 중입니다. 곧 멋진 기능들을 만나보실 수 있습니다.
        </p>
      </div>
    </PageLayout>
  )
}

export default PagePlaceholder