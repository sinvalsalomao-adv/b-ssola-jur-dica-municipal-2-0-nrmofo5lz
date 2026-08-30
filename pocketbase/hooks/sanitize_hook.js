// Server-side input sanitization hook for all collections create & update
// Sanitizes text fields, stripping dangerous HTML tags and escaping entities while preserving valid Portuguese unicode

onRecordCreateRequest((e) => {
  const cleanText = (val) => {
    if (val === null || val === undefined) return val
    if (typeof val !== 'string') return val

    let str = val

    // Remove null bytes and control chars (except newline and tab)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Remove script, style, iframe tags and contents
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

    // Strip other HTML tags
    str = str.replace(/<\/?[^>]+(>|$)/g, '')

    // Escape HTML entities
    str = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    return str.trim()
  }

  const body = e.requestInfo().body
  if (body && typeof body === 'object') {
    const skipFields = [
      'password',
      'passwordConfirm',
      'token',
      'url_video',
      'video_url',
      'urlVideo',
      'videoUrl',
      'avatar',
      'file',
      'arquivo',
      'logo',
      'brasao',
    ]

    for (const key in body) {
      if (skipFields.indexOf(key) !== -1) continue
      const val = body[key]
      if (typeof val === 'string') {
        body[key] = cleanText(val)
      } else if (Array.isArray(val)) {
        body[key] = val.map((item) => (typeof item === 'string' ? cleanText(item) : item))
      }
    }
  }

  return e.next()
})

onRecordUpdateRequest((e) => {
  const cleanText = (val) => {
    if (val === null || val === undefined) return val
    if (typeof val !== 'string') return val

    let str = val

    // Remove null bytes and control chars (except newline and tab)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Remove script, style, iframe tags and contents
    str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    str = str.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    str = str.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

    // Strip other HTML tags
    str = str.replace(/<\/?[^>]+(>|$)/g, '')

    // Escape HTML entities
    str = str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

    return str.trim()
  }

  const body = e.requestInfo().body
  if (body && typeof body === 'object') {
    const skipFields = [
      'password',
      'passwordConfirm',
      'token',
      'url_video',
      'video_url',
      'urlVideo',
      'videoUrl',
      'avatar',
      'file',
      'arquivo',
      'logo',
      'brasao',
    ]

    for (const key in body) {
      if (skipFields.indexOf(key) !== -1) continue
      const val = body[key]
      if (typeof val === 'string') {
        body[key] = cleanText(val)
      } else if (Array.isArray(val)) {
        body[key] = val.map((item) => (typeof item === 'string' ? cleanText(item) : item))
      }
    }
  }

  return e.next()
})
