import { ClientResponseError } from 'pocketbase'

export type FieldErrors = Record<string, string>

export function extractFieldErrors(error: unknown): FieldErrors {
  if (!(error instanceof ClientResponseError)) return {}
  const data = error.response?.data
  if (!data || typeof data !== 'object') return {}
  const errors: FieldErrors = {}
  for (const [field, detail] of Object.entries(data)) {
    if (
      detail &&
      typeof detail === 'object' &&
      'message' in detail &&
      typeof (detail as { message: unknown }).message === 'string'
    ) {
      errors[field] = (detail as { message: string }).message
    }
  }
  return errors
}

import { sanitizeHttpError, sanitizeString } from '@/lib/errorSanitizer'

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente ou contate o suporte.'

  // Se for erro do PocketBase ou HTTP, usa o sanitizador de segurança
  if (error instanceof ClientResponseError) {
    const sanitized = sanitizeHttpError(error)
    const msgs = Object.values(extractFieldErrors(error))
    if (msgs.length > 0) {
      return sanitizeString(msgs.join(' '))
    }
    // Erros 400/403/404 comuns
    if (error.status === 400) {
      return sanitized.message || 'Dados inválidos ou incompletos. Verifique os campos informados.'
    }
    if (error.status === 403) {
      return 'Você não possui permissão para executar esta ação.'
    }
    if (error.status === 404) {
      return 'O registro solicitado não foi encontrado.'
    }
    if (error.status >= 500) {
      return 'Falha de comunicação com o servidor. Tente novamente em instantes.'
    }
    return sanitized.message || 'Ocorreu um erro ao processar a solicitação.'
  }

  if (error instanceof Error) {
    // Evita expor stack traces ou URLs internas
    const sanitizedMsg = sanitizeString(error.message)
    if (sanitizedMsg.includes('Failed to fetch') || sanitizedMsg.includes('NetworkError')) {
      return 'Falha de conexão com a rede. Verifique sua conexão e tente novamente.'
    }
    return sanitizedMsg || 'Ocorreu um erro inesperado. Tente novamente.'
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
