import { ClientResponseError } from 'pocketbase'
import {
  sanitizeString,
  sanitizeHttpError,
  summarizeBodyStructure,
  type SanitizedHttpErrorInfo,
} from '@/lib/errorSanitizer'

export type FieldErrors = Record<string, string>

export interface SafeDiagnosticInfo {
  method?: string
  endpoint?: string
  status?: number
  requestId?: string
  message: string
  fieldErrors?: FieldErrors
  bodyStructureSummary?: unknown
}

/**
 * Extrai erros de campos específicos de forma sanitizada.
 * Valores e mensagens de erro são sanitizados para evitar injeção de tokens/segredos.
 */
export function extractFieldErrors(error: unknown): FieldErrors {
  if (!error) return {}
  if (error instanceof ClientResponseError) {
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
        errors[field] = sanitizeString((detail as { message: string }).message)
      } else if (typeof detail === 'string') {
        errors[field] = sanitizeString(detail)
      }
    }
    return errors
  }

  // Fallback para objetos de erro genéricos
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const sanitized = sanitizeHttpError(error)
    return sanitized.fieldErrors || {}
  }

  return {}
}

/**
 * Retorna uma mensagem de erro segura para o usuário ou interface,
 * garantindo que nenhum token, cabeçalho sensível ou credencial seja exposto.
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado.'

  if (error instanceof ClientResponseError) {
    const msgs = Object.values(extractFieldErrors(error))
    if (msgs.length > 0) {
      return msgs.join(' ')
    }
    return sanitizeString(error.message || 'Ocorreu um erro na operação.')
  }

  const httpInfo = sanitizeHttpError(error)
  if (httpInfo.fieldErrors && Object.keys(httpInfo.fieldErrors).length > 0) {
    return Object.values(httpInfo.fieldErrors).join(' ')
  }

  if (error instanceof Error) {
    return sanitizeString(error.message || 'Ocorreu um erro inesperado.')
  }

  if (typeof error === 'string') {
    return sanitizeString(error)
  }

  return sanitizeString(httpInfo.message || 'Ocorreu um erro inesperado.')
}

/**
 * Gera informações de diagnóstico de erro seguras:
 * mantém método HTTP, endpoint sem query sensível, status code, request ID
 * e resumo estrutural do body (sem conteúdo sensível/jurídico).
 */
export function getSafeDiagnosticInfo(error: unknown): SafeDiagnosticInfo {
  const sanitized = sanitizeHttpError(error)
  return {
    method: sanitized.method,
    endpoint: sanitized.endpoint,
    status: sanitized.status,
    requestId: sanitized.requestId,
    message: sanitized.message,
    fieldErrors: sanitized.fieldErrors,
    bodyStructureSummary: sanitized.bodySummary,
  }
}
