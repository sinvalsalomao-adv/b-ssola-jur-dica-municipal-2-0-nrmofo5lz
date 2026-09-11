import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, X, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sanitizeError, sanitizeString } from '@/lib/errorSanitizer'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  isDomMismatch: boolean
  recoveryCount: number
  showSoftWarning: boolean
  resetKey: number
}

function isDomReconciliationError(error: Error | null): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  const name = (error.name || '').toLowerCase()
  return (
    name.includes('notfounderror') ||
    msg.includes('removechild') ||
    msg.includes('insertbefore') ||
    msg.includes('not a child of this node') ||
    msg.includes('the node before which the new node is to be inserted') ||
    (msg.includes('node') && (msg.includes('child') || msg.includes('hierarchy')))
  )
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeout: ReturnType<typeof setTimeout> | null = null

  public state: State = {
    hasError: false,
    error: null,
    isDomMismatch: false,
    recoveryCount: 0,
    showSoftWarning: false,
    resetKey: 0,
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const isMismatch = isDomReconciliationError(error)
    return {
      hasError: true,
      error: sanitizeError(error),
      isDomMismatch: isMismatch,
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const safeError = sanitizeError(error)
    const safeComponentStack = errorInfo?.componentStack
      ? sanitizeString(errorInfo.componentStack)
      : undefined
    console.warn('Uncaught Error Boundary error:', safeError, {
      componentStack: safeComponentStack,
    })

    // Se for erro de reconciliação causado por tradutor externo ou mutação de nós,
    // tenta autorrecuperação imediata com soft-reset (até 2 vezes consecutivas)
    if (this.state.isDomMismatch && this.state.recoveryCount < 2) {
      if (this.resetTimeout) clearTimeout(this.resetTimeout)
      this.resetTimeout = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          error: null,
          recoveryCount: prev.recoveryCount + 1,
          showSoftWarning: true,
          resetKey: prev.resetKey + 1,
        }))
      }, 50)
    }
  }

  public componentWillUnmount() {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout)
    }
  }

  private handleSoftReload = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      recoveryCount: 0,
      showSoftWarning: false,
      resetKey: prev.resetKey + 1,
    }))
  }

  private handleHardReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  private dismissWarning = () => {
    this.setState({ showSoftWarning: false })
  }

  public render() {
    // Para erros que NÃO sejam falso-positivo de DOM OU quando o limite de autorrecuperação esgotou:
    if (this.state.hasError && (!this.state.isDomMismatch || this.state.recoveryCount >= 2)) {
      const safeMessage = this.state.error?.message
        ? sanitizeString(this.state.error.message)
        : 'Erro inesperado de renderização.'

      return (
        <div
          className="min-h-screen flex items-center justify-center bg-slate-50 p-6 notranslate"
          translate="no"
        >
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {this.state.isDomMismatch
                ? 'Falha de Sincronização de Interface'
                : 'Ocorreu um erro na aplicação'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {this.state.isDomMismatch
                ? 'Detectada intervenção de extensões do navegador (como tradução automática). Recomendamos desativar a tradução para esta página e recarregar.'
                : safeMessage}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                onClick={this.handleHardReload}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Aplicação
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div key={this.state.resetKey} className="contents notranslate" translate="no">
        {this.state.showSoftWarning && (
          <div
            role="status"
            aria-live="polite"
            className="sticky top-0 z-50 bg-amber-500 text-white px-4 py-2 text-xs flex items-center justify-between shadow-md notranslate"
            translate="no"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                A sincronização de interface foi restaurada. Se notar inconsistências visuais,
                desative a tradução automática do navegador neste site.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={this.handleSoftReload}
                className="h-7 text-xs text-white hover:bg-amber-600 px-2 gap-1 font-medium"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Recarregar
              </Button>
              <button
                type="button"
                onClick={this.dismissWarning}
                className="text-white/80 hover:text-white p-1 rounded transition-colors"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {this.props.children}
      </div>
    )
  }
}
