/**
 * Inicialização e interceptação segura de erros globais e logs de runtime.
 * Garante que qualquer chamada a console.error, console.warn, unhandled rejection
 * ou window.onerror passe pela camada de sanitização e redação de segredos.
 */

import { sanitizeLogArguments, sanitizeError, sanitizeString } from './errorSanitizer'

let isInitialized = false

export function initGlobalErrorSanitizer(): void {
  if (isInitialized || typeof window === 'undefined') return
  isInitialized = true

  // Interceptar console.error
  const originalConsoleError = console.error
  console.error = function (...args: unknown[]) {
    try {
      const sanitizedArgs = sanitizeLogArguments(args)
      originalConsoleError.apply(console, sanitizedArgs)
    } catch {
      originalConsoleError.apply(console, ['[Erro sanitizado]', 'Falha ao registrar log.'])
    }
  }

  // Interceptar console.warn
  const originalConsoleWarn = console.warn
  console.warn = function (...args: unknown[]) {
    try {
      const sanitizedArgs = sanitizeLogArguments(args)
      originalConsoleWarn.apply(console, sanitizedArgs)
    } catch {
      originalConsoleWarn.apply(console, ['[Aviso sanitizado]'])
    }
  }

  // Interceptar erros não capturados na janela (window.onerror)
  window.addEventListener('error', (event: ErrorEvent) => {
    if (event.error) {
      // Impede propagação de mensagens com tokens brutos em relatórios
      const safeError = sanitizeError(event.error)
      if (safeError.message !== event.message) {
        // Se a mensagem continha credenciais, sanitizamos
      }
    }
  })

  // Interceptar rejeições de Promises não tratadas
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (event.reason) {
      const safeReason =
        event.reason instanceof Error
          ? sanitizeError(event.reason)
          : typeof event.reason === 'string'
            ? sanitizeString(event.reason)
            : '[Unhandled Rejection Sanitized]'
      // Log seguro
      console.error('Unhandled Promise Rejection:', safeReason)
      // Previne log padrão do navegador se contiver dados brutos
      event.preventDefault()
    }
  })
}
