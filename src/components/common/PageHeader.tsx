import React from 'react'
import { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: LucideIcon
  badge?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm transition-all ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#1c2a3e] flex items-center justify-center shrink-0 shadow-xs text-white">
            <Icon className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold text-[#1c2a3e] tracking-tight truncate">
              {title}
            </h1>
            {badge &&
              (typeof badge === 'string' ? <Badge variant="secondary">{badge}</Badge> : badge)}
          </div>
          {description && (
            <p className="text-xs md:text-sm text-gray-500 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
