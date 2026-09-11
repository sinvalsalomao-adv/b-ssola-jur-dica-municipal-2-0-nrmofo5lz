import React from 'react'
import { Inbox, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export interface StateDisplayProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    variant?: 'default' | 'outline' | 'secondary' | 'destructive'
    icon?: React.ReactNode
  }
  className?: string
}

export const EmptyState: React.FC<StateDisplayProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <Card className={`bg-white border-0 shadow-subtle text-center py-12 px-4 ${className}`}>
      <CardContent className="space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          {icon || <Inbox className="w-6 h-6 text-slate-400" aria-hidden="true" />}
        </div>
        <h3 className="text-base font-semibold text-[#1c2a3e]">{title}</h3>
        {description && <p className="text-xs text-gray-500 leading-relaxed">{description}</p>}
        {action && (
          <div className="pt-2">
            <Button
              variant={action.variant || 'outline'}
              size="sm"
              onClick={action.onClick}
              className="text-xs gap-1.5"
            >
              {action.icon}
              {action.label}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Não foi possível carregar os dados',
  message = 'Ocorreu um erro na requisição. Tente novamente em instantes ou contate o suporte.',
  onRetry,
  className = '',
}) => {
  return (
    <Card
      className={`bg-white border border-red-100 shadow-sm text-center py-10 px-4 ${className}`}
    >
      <CardContent className="space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-500">
          <AlertCircle className="w-6 h-6 text-red-500" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-600 leading-relaxed">{message}</p>
        {onRetry && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="text-xs gap-1.5 border-gray-300 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  submitting?: boolean
  submittingText?: string
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
}

import { Loader2 } from 'lucide-react'

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  submitting = false,
  submittingText,
  icon,
  children,
  disabled,
  className = '',
  variant = 'default',
  ...props
}) => {
  return (
    <Button
      type="submit"
      variant={variant}
      disabled={disabled || submitting}
      className={`relative gap-1.5 transition-all select-none ${
        variant === 'default' ? 'bg-[#3b82f6] hover:bg-[#2563eb] text-white' : ''
      } ${className}`}
      {...props}
    >
      {submitting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
          <span>{submittingText || 'Salvando...'}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Button>
  )
}
