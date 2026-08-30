// Hook to mask sensitive credentials in tenant_settings and platform_settings
// Never exposes smtp_config.password or ai_api_key in client responses.
// Preserves secrets on update if masked value is submitted.

onRecordEnrich((e) => {
  const record = e.record
  if (!record) return e.next()

  // 1. Mascarar senha de SMTP em tenant_settings
  try {
    const rawSmtp = record.get('smtp_config')
    if (rawSmtp) {
      let parsed = rawSmtp
      if (typeof rawSmtp === 'string') {
        try {
          parsed = JSON.parse(rawSmtp)
        } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.password) {
          parsed.password = '••••••••'
          record.set('smtp_config', parsed)
        }
      }
    }
  } catch (_) {}

  // 2. Mascarar ai_api_key em tenant_settings
  try {
    const rawAiKey = record.get('ai_api_key')
    if (rawAiKey && typeof rawAiKey === 'string' && rawAiKey.trim() !== '') {
      record.set('ai_api_key', '••••••••')
    }
  } catch (_) {}

  return e.next()
}, 'tenant_settings')

onRecordEnrich((e) => {
  const record = e.record
  if (!record) return e.next()

  // 1. Mascarar senha de SMTP em platform_settings
  try {
    const rawSmtp = record.get('smtp_config')
    if (rawSmtp) {
      let parsed = rawSmtp
      if (typeof rawSmtp === 'string') {
        try {
          parsed = JSON.parse(rawSmtp)
        } catch (_) {}
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.password) {
          parsed.password = '••••••••'
          record.set('smtp_config', parsed)
        }
      }
    }
  } catch (_) {}

  // 2. Mascarar ai_api_key em platform_settings
  try {
    const rawAiKey = record.get('ai_api_key')
    if (rawAiKey && typeof rawAiKey === 'string' && rawAiKey.trim() !== '') {
      record.set('ai_api_key', '••••••••')
    }
  } catch (_) {}

  return e.next()
}, 'platform_settings')

// Preservar segredos existentes em caso de update com valor mascarado
onRecordUpdateRequest((e) => {
  const record = e.record
  if (!record) return e.next()

  const body = e.requestInfo().body
  if (!body || typeof body !== 'object') return e.next()

  // Preservar ai_api_key se enviada a máscara ou valor vazio
  if (body.ai_api_key !== undefined) {
    const val = String(body.ai_api_key).trim()
    if (val === '••••••••' || val === '[REDACTED]' || val === '<redacted>' || val === '********') {
      const origKey = record.getString('ai_api_key') || ''
      record.set('ai_api_key', origKey)
    }
  }

  // Preservar smtp_config.password se enviado mascarado
  if (body.smtp_config !== undefined) {
    try {
      let newSmtp = body.smtp_config
      if (typeof newSmtp === 'string') {
        try {
          newSmtp = JSON.parse(newSmtp)
        } catch (_) {}
      }
      if (newSmtp && typeof newSmtp === 'object') {
        const pwd = String(newSmtp.password || '').trim()
        if (
          pwd === '••••••••' ||
          pwd === '[REDACTED]' ||
          pwd === '<redacted>' ||
          pwd === '********'
        ) {
          let origSmtp = record.get('smtp_config')
          if (typeof origSmtp === 'string') {
            try {
              origSmtp = JSON.parse(origSmtp)
            } catch (_) {}
          }
          if (origSmtp && typeof origSmtp === 'object') {
            newSmtp.password = origSmtp.password || ''
            record.set('smtp_config', newSmtp)
          }
        }
      }
    } catch (_) {}
  }

  return e.next()
}, 'tenant_settings')

onRecordUpdateRequest((e) => {
  const record = e.record
  if (!record) return e.next()

  const body = e.requestInfo().body
  if (!body || typeof body !== 'object') return e.next()

  // Preservar ai_api_key se enviada a máscara ou valor vazio
  if (body.ai_api_key !== undefined) {
    const val = String(body.ai_api_key).trim()
    if (val === '••••••••' || val === '[REDACTED]' || val === '<redacted>' || val === '********') {
      const origKey = record.getString('ai_api_key') || ''
      record.set('ai_api_key', origKey)
    }
  }

  // Preservar smtp_config.password se enviado mascarado
  if (body.smtp_config !== undefined) {
    try {
      let newSmtp = body.smtp_config
      if (typeof newSmtp === 'string') {
        try {
          newSmtp = JSON.parse(newSmtp)
        } catch (_) {}
      }
      if (newSmtp && typeof newSmtp === 'object') {
        const pwd = String(newSmtp.password || '').trim()
        if (
          pwd === '••••••••' ||
          pwd === '[REDACTED]' ||
          pwd === '<redacted>' ||
          pwd === '********'
        ) {
          let origSmtp = record.get('smtp_config')
          if (typeof origSmtp === 'string') {
            try {
              origSmtp = JSON.parse(origSmtp)
            } catch (_) {}
          }
          if (origSmtp && typeof origSmtp === 'object') {
            newSmtp.password = origSmtp.password || ''
            record.set('smtp_config', newSmtp)
          }
        }
      }
    } catch (_) {}
  }

  return e.next()
}, 'platform_settings')
