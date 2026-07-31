import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {this.state.error?.message?.includes('removeChild') ||
              this.state.error?.message?.includes('Node')
                ? 'Falha de Sincronização de Interface'
                : 'Ocorreu um erro na aplicação'}
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {this.state.error?.message?.includes('removeChild') ||
              this.state.error?.message?.includes('Node')
                ? 'Detectada alteração de nós do navegador (ex: tradução automática ativada). Clique abaixo para recarregar.'
                : this.state.error?.message || 'Erro inesperado de renderização.'}
            </p>
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Recarregar Aplicação
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
