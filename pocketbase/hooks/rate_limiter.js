// Rate limiting middleware for authentication and sensitive record creation
routerUse((e) => {
  const req = e.requestInfo()
  const path = req.url ? req.url.path : ''
  const method = req.method ? req.method.toUpperCase() : 'GET'
  const ip = req.remoteIP || 'unknown_ip'

  const now = Date.now()
  const cache = $app.store()

  // 1. Rate limiting on authentication (/api/collections/users/auth-with-password)
  // Max 5 attempts per IP in 15 minutes (900 seconds). After 5 failures, block for 15 minutes.
  if (path.includes('/auth-with-password') && method === 'POST') {
    const key = 'rate_auth_' + ip
    const blockKey = 'rate_auth_blocked_' + ip

    // Check if IP is currently blocked
    const isBlocked = cache.has(blockKey)
    if (isBlocked) {
      return e.json(429, {
        code: 429,
        message:
          'Muitas tentativas de login. Por favor, aguarde 15 minutos antes de tentar novamente.',
      })
    }

    let attempts = 0
    if (cache.has(key)) {
      attempts = Number(cache.get(key)) || 0
    }

    if (attempts >= 5) {
      cache.set(blockKey, now, 900) // Block for 15 minutes
      cache.remove(key)
      return e.json(429, {
        code: 429,
        message:
          'Muitas tentativas de login. Por favor, aguarde 15 minutos antes de tentar novamente.',
      })
    }

    // Pass through to next handler and monitor result
    try {
      e.next()
    } catch (err) {
      // Incrementar tentativas em caso de erro/falha
      const newCount = attempts + 1
      cache.set(key, newCount, 900)
      if (newCount >= 5) {
        cache.set(blockKey, now, 900)
        cache.remove(key)
      }
      throw err
    }

    // Check response status if accessible
    const status = e.response ? e.response.status : 200
    if (status >= 400) {
      const newCount = attempts + 1
      cache.set(key, newCount, 900)
      if (newCount >= 5) {
        cache.set(blockKey, now, 900)
        cache.remove(key)
      }
    } else {
      // Login bem sucedido: resetar tentativas
      cache.remove(key)
      cache.remove(blockKey)
    }
    return
  }

  // 2. Rate limiting on creation of sensitive records (DFDs, projects, notifications)
  // Max 30 requests per minute per authenticated user
  const isSensitiveCreate =
    method === 'POST' &&
    (path.includes('/api/collections/dfds/records') ||
      path.includes('/api/collections/projects/records') ||
      path.includes('/api/collections/notifications/records'))

  if (isSensitiveCreate) {
    const userId = e.auth ? e.auth.id : ip
    const key = 'rate_create_' + userId

    let count = 0
    if (cache.has(key)) {
      count = Number(cache.get(key)) || 0
    }

    if (count >= 30) {
      return e.json(429, {
        code: 429,
        message: 'Limite de criação de registros excedido. Máximo de 30 requisições por minuto.',
      })
    }

    cache.set(key, count + 1, 60) // 1 minute window
  }

  return e.next()
})
