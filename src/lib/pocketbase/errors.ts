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

export function getSafeDiagnosticInfo(error: unknown) {
  if (error instanceof ClientResponseError) {
    return {
      status: error.status,
      method: (error.response as any)?.config?.method || 'GET',
      endpoint: error.url,
      requestId: (error.response as any)?.headers?.['x-request-id'] || '',
      bodyStructureSummary: (error.response as any)?.data || {},
    }
  }
  const errObj = (error || {}) as Record<string, any>
  return {
    status: errObj.status || 500,
    method: errObj.method || 'GET',
    endpoint: errObj.url || '',
    requestId: errObj.requestId || '',
    bodyStructureSummary: errObj.request?.body || {},
  }
}
