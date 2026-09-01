/**
 * Utilitário Central de Sanitização de Erros e Logs de Runtime.
 * Projeto: Bússola Jurídica Municipal 2.0
 *
 * Garante que nenhuma mensagem de erro, log de console, diagnóstico de interface
 * ou telemetria exponha cabeçalhos sensíveis (Authorization, Cookie, etc.),
 * tokens Bearer, JWTs, query params sensíveis, senhas, chaves de API ou conteúdo integral de requisições.
 */

export const SENSITIVE_KEYS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'apikey',
  'api_key',
  'ai_api_key',
  'password',
  'senha',
  'secret',
  'client_secret',
  'session',
] as const

const REDACTED = '[REDACTED]'

// Regex para padrões de credenciais em strings
const BEARER_REGEX = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi
// JWT: três segmentos Base64URL separados por ponto
const JWT_REGEX = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gi
// Tokens e segredos comuns em URLs/Query strings: ?token=..., &access_token=..., &apiKey=..., &password=..., &secret=...
const QUERY_SECRET_REGEX =
  /([?&](?:authorization|proxy-authorization|cookie|set-cookie|token|access_token|refresh_token|id_token|apikey|api_key|ai_api_key|password|senha|secret|client_secret|session)=)([^&? \s#"']+)/gi

// Headers/Key-values em formato chave: valor ou "chave": "valor" em strings de texto livre
const KEY_VALUE_TEXT_REGEX =
  /(["']?(?:authorization|proxy-authorization|cookie|set-cookie|token|access_token|refresh_token|id_token|apikey|api_key|ai_api_key|password|senha|secret|client_secret|session)["']?\s*[:=]\s*)(["']?)(?:(?!\2)[\S\s])*?\2/gi

/**
 * Sanitiza texto livre mascarando segredos, JWTs, Bearer tokens e parâmetros de consulta.
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') return ''

  let sanitized = input

  // 1. Mascarar JWTs
  sanitized = sanitized.replace(JWT_REGEX, REDACTED)

  // 2. Mascarar Bearer tokens
  sanitized = sanitized.replace(BEARER_REGEX, `Bearer ${REDACTED}`)

  // 3. Mascarar query strings com parâmetros sensíveis
  sanitized = sanitized.replace(QUERY_SECRET_REGEX, `$1${REDACTED}`)

  // 4. Mascarar padrões "chave: valor" para chaves sensíveis
  for (const key of SENSITIVE_KEYS) {
    const keyPattern = new RegExp(
      `(["']?\\b${escapeRegExp(key)}\\b["']?\\s*[:=]\\s*)(?:["'][^"']*["']|[^\\s,;}]+)`,
      'gi',
    )
    sanitized = sanitized.replace(keyPattern, `$1"${REDACTED}"`)
  }

  return sanitized
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '')
  return SENSITIVE_KEYS.some(
    (k) =>
      k.toLowerCase() === key.toLowerCase() || k.replace(/[-_]/g, '').toLowerCase() === normalized,
  )
}

/**
 * Resume a estrutura/schema de um corpo de requisição/objeto sem expor valores ou dados pessoais.
 * Mantém apenas nomes de campos e seus tipos primitivos.
 */
export function summarizeBodyStructure(value: unknown, depth = 0, seen = new WeakSet()): unknown {
  if (depth > 5) return '[DepthLimit]'
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const type = typeof value

  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') {
    return `<${type}>`
  }

  if (type === 'function') {
    return '<function>'
  }

  if (value instanceof Date) {
    return '<Date>'
  }

  if (value instanceof File) {
    return `<File: ${value.name ? '[file_name]' : 'unnamed'}, ${value.size} bytes>`
  }

  if (value instanceof Blob) {
    return `<Blob: ${value.size} bytes>`
  }

  if (value instanceof FormData) {
    const fields: Record<string, string> = {}
    try {
      value.forEach((val, k) => {
        fields[k] = isSensitiveKey(k) ? REDACTED : `<${typeof val}>`
      })
    } catch {
      return '<FormData>'
    }
    return { _type: 'FormData', fields }
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return [summarizeBodyStructure(value[0], depth + 1, seen), `... (${value.length} items)`]
  }

  if (type === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)

    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        result[k] = REDACTED
      } else {
        result[k] = summarizeBodyStructure(v, depth + 1, seen)
      }
    }
    return result
  }

  return `<${type}>`
}

/**
 * Sanitiza recursivamente objetos, dicionários e arrays substituindo chaves sensíveis por [REDACTED].
 */
export function sanitizeObjectData<T>(obj: T, seen = new WeakSet()): T {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T
  }

  if (typeof obj !== 'object') {
    return obj
  }

  if (obj instanceof Error) {
    return sanitizeError(obj) as unknown as T
  }

  if (obj instanceof Date || obj instanceof File || obj instanceof Blob) {
    return obj
  }

  if (seen.has(obj as object)) {
    return '[Circular]' as unknown as T
  }
  seen.add(obj as object)

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObjectData(item, seen)) as unknown as T
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED
    } else if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val)
    } else if (val && typeof val === 'object') {
      sanitized[key] = sanitizeObjectData(val, seen)
    } else {
      sanitized[key] = val
    }
  }

  return sanitized as T
}

/**
 * Sanitiza uma URL removendo credenciais e parâmetros sensíveis de consulta.
 */
export function sanitizeUrl(urlStr: string): string {
  if (!urlStr || typeof urlStr !== 'string') return ''
  try {
    const isAbsolute = urlStr.startsWith('http://') || urlStr.startsWith('https://')
    const urlObj = new URL(urlStr, isAbsolute ? undefined : 'https://dummy-base.local')

    // Mascarar user/pass na URL (ex: https://user:pass@host)
    if (urlObj.username) urlObj.username = REDACTED
    if (urlObj.password) urlObj.password = REDACTED

    const keysToRedact: string[] = []
    urlObj.searchParams.forEach((_, key) => {
      if (isSensitiveKey(key)) {
        keysToRedact.push(key)
      }
    })

    keysToRedact.forEach((k) => {
      urlObj.searchParams.set(k, REDACTED)
    })

    let clean = isAbsolute ? urlObj.toString() : `${urlObj.pathname}${urlObj.search}${urlObj.hash}`
    return sanitizeString(clean)
  } catch {
    return sanitizeString(urlStr)
  }
}

export interface SanitizedHttpErrorInfo {
  method?: string
  endpoint?: string
  status?: number
  requestId?: string
  message: string
  fieldErrors?: Record<string, string>
  bodySummary?: unknown
}

/**
 * Sanitiza uma resposta de erro HTTP ou objeto de erro qualquer,
 * garantindo apenas as informações seguras permitidas.
 */
export function sanitizeHttpError(error: unknown): SanitizedHttpErrorInfo {
  if (!error) {
    return { message: 'Ocorreu um erro desconhecido.' }
  }

  const info: SanitizedHttpErrorInfo = {
    message: 'Ocorreu um erro na requisição.',
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as Record<string, any>

    // Extração de status HTTP
    if (typeof errObj.status === 'number') {
      info.status = errObj.status
    } else if (typeof errObj.statusCode === 'number') {
      info.status = errObj.statusCode
    }

    // Extração de método HTTP
    if (typeof errObj.method === 'string') {
      info.method = errObj.method.toUpperCase()
    } else if (
      errObj.response?.config?.method &&
      typeof errObj.response.config.method === 'string'
    ) {
      info.method = errObj.response.config.method.toUpperCase()
    }

    // Extração de URL / Endpoint sanitizado
    const rawUrl = errObj.url || errObj.response?.url || errObj.config?.url || errObj.request?.url
    if (typeof rawUrl === 'string') {
      info.endpoint = sanitizeUrl(rawUrl)
    }

    // Identificador de requisição (requestId / correlationId / x-request-id)
    const reqId =
      errObj.requestId ||
      errObj.response?.headers?.['x-request-id'] ||
      errObj.response?.headers?.get?.('x-request-id') ||
      errObj.request_id
    if (typeof reqId === 'string' || typeof reqId === 'number') {
      info.requestId = sanitizeString(String(reqId))
    }

    // Mensagem
    let rawMessage = ''
    if (typeof errObj.message === 'string' && errObj.message) {
      rawMessage = errObj.message
    } else if (typeof errObj.response?.message === 'string') {
      rawMessage = errObj.response.message
    }

    // Tratamento de detalhes de campos (PocketBase response.data ou response.data.data)
    const responseData = errObj.response?.data || errObj.data
    if (responseData && typeof responseData === 'object') {
      const fieldErrors: Record<string, string> = {}
      for (const [f, detail] of Object.entries(responseData)) {
        if (
          detail &&
          typeof detail === 'object' &&
          'message' in detail &&
          typeof (detail as { message: unknown }).message === 'string'
        ) {
          fieldErrors[f] = sanitizeString((detail as { message: string }).message)
        } else if (typeof detail === 'string') {
          fieldErrors[f] = sanitizeString(detail)
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        info.fieldErrors = fieldErrors
        const fieldMsg = Object.values(fieldErrors).join(' ')
        if (fieldMsg) {
          rawMessage = fieldMsg
        }
      }
    }

    info.message = sanitizeString(rawMessage || 'Ocorreu um erro na requisição.')

    // Resumo estrutural do corpo (apenas nomes de campos e tipos, sem valores)
    const reqBody = errObj.request?.body || errObj.config?.data || errObj.body
    if (reqBody !== undefined) {
      info.bodySummary = summarizeBodyStructure(reqBody)
    }
  } else if (typeof error === 'string') {
    info.message = sanitizeString(error)
  }

  return info
}

/**
 * Sanitiza instâncias de Error padrão ou customizadas
 */
export function sanitizeError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error(sanitizeString(String(error)))
  }

  const cleanMessage = sanitizeString(error.message)
  const sanitized = new Error(cleanMessage)
  sanitized.name = sanitizeString(error.name)

  if (error.stack) {
    sanitized.stack = sanitizeString(error.stack)
  }

  return sanitized
}

/**
 * Sanitiza argumentos de logs para console, evitando vazamento de credenciais.
 */
export function sanitizeLogArguments(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (typeof arg === 'string') {
      return sanitizeString(arg)
    }
    if (arg instanceof Error) {
      return sanitizeError(arg)
    }
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObjectData(arg)
    }
    return arg
  })
}
