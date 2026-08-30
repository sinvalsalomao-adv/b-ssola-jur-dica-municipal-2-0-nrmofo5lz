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

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ClientResponseError)) {
    return error instanceof Error ? error.message : 'An unexpected error occurred.'
  }
  const msgs = Object.values(extractFieldErrors(error))
  return msgs.length > 0 ? msgs.join(' ') : error.message || 'An unexpected error occurred.'
}

export function getSafeDiagnosticInfo(error: unknown): {
  status?: number
  method?: string
  endpoint?: string
  requestId?: string
  message: string
  fieldErrors?: Record<string, string>
  bodyStructureSummary?: unknown
} {
  const err = error as any
  return {
    status: err?.status,
    method: err?.method,
    endpoint: err?.url,
    requestId: err?.requestId,
    message: getErrorMessage(error),
    fieldErrors: extractFieldErrors(error),
    bodyStructureSummary: err?.request?.body
      ? { email: '<string>', password: '[REDACTED]', secret_key: '[REDACTED]' }
      : undefined,
  }
}
