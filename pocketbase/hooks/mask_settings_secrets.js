// Hook to mask sensitive credentials in tenant_settings and platform_settings
// Never exposes smtp_config.password in client responses.

onRecordEnrich((e) => {
  const record = e.record
  if (!record) return e.next()

  // Mascarar senha de SMTP em tenant_settings
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

  return e.next()
}, 'tenant_settings')

onRecordEnrich((e) => {
  const record = e.record
  if (!record) return e.next()

  // Mascarar senha de SMTP em platform_settings para segurança adicional
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

  return e.next()
}, 'platform_settings')
