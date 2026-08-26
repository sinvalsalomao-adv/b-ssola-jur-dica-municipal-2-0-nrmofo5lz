/**
 * Utilitário de sanitização de inputs do sistema Bússola Jurídica Municipal 2.0.
 *
 * - Remove tags HTML perigosas (<script>, <iframe>, <img>, <object>, <embed>, <svg>, <style>, <link>, <form>, etc.)
 * - Escapa caracteres especiais HTML (<, >, &, ", ')
 * - Remove caracteres de controle ASCII invisíveis e nulos
 * - Faz trim de espaços nas extremidades
 * - Preserva acentos, caracteres em português (á, é, í, ó, ú, ç, ã, õ, â, ê, etc.), pontuação legítima e emojis
 */

export function sanitizeInput(value: string | undefined | null): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') return String(value)

  let str = value

  // 1. Remover caracteres nulos e de controle perigosos (mantendo \n, \r, \t para campos multilinha)
  // eslint-disable-next-line no-control-regex
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // 2. Remover tags HTML recursivamente / strip tags
  // Primeiro remove scripts, styles e iframes com seu conteúdo
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

  // Remove qualquer outra tag HTML restante <...>
  str = str.replace(/<\/?[^>]+(>|$)/g, '')

  // 3. Escapar caracteres HTML remanescentes para entidades seguras
  str = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  // 4. Trim de espaços nas extremidades
  return str.trim()
}

/**
 * Sanitiza valores de um objeto simples recursivamente ou em primeiro nível
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  excludeKeys: string[] = [
    'password',
    'passwordConfirm',
    'token',
    'url',
    'videoUrl',
    'urlVideo',
    'url_video',
    'video_url',
    'logo',
    'brasao',
  ],
): T {
  const result: any = Array.isArray(obj) ? [] : {}

  for (const [key, val] of Object.entries(obj)) {
    if (excludeKeys.includes(key)) {
      result[key] = val
    } else if (typeof val === 'string') {
      result[key] = sanitizeInput(val)
    } else if (val && typeof val === 'object' && !(val instanceof File) && !(val instanceof Date)) {
      result[key] = sanitizeObject(val, excludeKeys)
    } else {
      result[key] = val
    }
  }

  return result
}
