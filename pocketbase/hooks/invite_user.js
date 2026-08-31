// Dedicated Transactional Endpoint for Creating Municipal Invitations
// Route: POST /backend/v1/invitations/create
// Requires Auth: Local Admin (active in target tenant) or Superadmin

routerAdd(
  'POST',
  '/backend/v1/invitations/create',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}

    const rawName = String(body.name || '').trim()
    const rawEmail = String(body.email || '')
      .trim()
      .toLowerCase()
    const requestedRole = String(body.role || 'servidor').trim()
    const requestedTenant = String(body.tenant || '').trim()

    // Validações
    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.badRequestError('ID de município inválido.')
    }
    if (!rawName) return e.badRequestError('Nome é obrigatório.')
    if (!rawEmail || !rawEmail.includes('@') || rawEmail.length > 255) {
      return e.badRequestError('Email válido é obrigatório.')
    }

    const emailParts = rawEmail.split('@')
    if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
      return e.badRequestError('Email válido é obrigatório.')
    }
    const normalizedEmail =
      emailParts[0].trim().toLowerCase() + '@' + emailParts[1].trim().toLowerCase()

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
      if (!effectiveTenantId) {
        return e.badRequestError('Tenant é obrigatório.')
      }
    } else {
      let checkTenant = requestedTenant || auth.getString('tenant')
      if (!checkTenant) {
        return e.badRequestError('Tenant é obrigatório.')
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = checkTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const checkFilter =
        "user = '" +
        escapedAuthId +
        "' && tenant = '" +
        escapedTenant +
        "' && role = 'admin' && status = 'ativo'"

      try {
        const adminMems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0)
        if (adminMems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Apenas Administradores ativos podem convidar usuários para este município.',
          })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    const allowedRoles = ['servidor', 'gestor', 'secretario', 'procurador', 'admin']
    if (allowedRoles.indexOf(requestedRole) === -1) {
      return e.badRequestError('Papel inválido especificado.')
    }

    // Rate limiting por tenant + destinatário
    const rateHash = $security.sha256(effectiveTenantId + ':' + normalizedEmail)
    const cache = $app.store()
    const rateLimitKey = 'rl_inv_' + rateHash
    let sendCount = 0
    if (cache.has(rateLimitKey)) {
      sendCount = Number(cache.get(rateLimitKey)) || 0
    }
    if (sendCount >= 5) {
      return e.json(429, {
        code: 429,
        message: 'Limite de convites excedido para este destinatário. Tente novamente mais tarde.',
      })
    }
    cache.set(rateLimitKey, sendCount + 1, 300)

    const rawToken = $security.randomString(32) + $security.randomString(32)
    const tokenHash = $security.sha256(rawToken)
    const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    const invCol = $app.findCollectionByNameOrId('invitations')
    const memCol = $app.findCollectionByNameOrId('user_memberships')

    try {
      $app.runInTransaction((txApp) => {
        let userRec = null
        try {
          userRec = txApp.findAuthRecordByEmail('_pb_users_auth_', normalizedEmail)
        } catch (_) {}

        // Se usuário existir, garante membership pendente se não ativa
        if (userRec) {
          const escapedUserId = userRec.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
          const escapedEffTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
          const memFilter = "user = '" + escapedUserId + "' && tenant = '" + escapedEffTenant + "'"
          const existingMems = txApp.findRecordsByFilter('user_memberships', memFilter, '', 1, 0)
          if (existingMems.length === 0) {
            const newMem = new Record(memCol)
            newMem.set('user', userRec.id)
            newMem.set('tenant', effectiveTenantId)
            newMem.set('role', requestedRole)
            newMem.set('status', 'pendente')
            txApp.save(newMem)
          }
        }

        // Cancelar convites pendentes anteriores para invalidar tokens antigos
        const escapedEmail = normalizedEmail.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const escapedEffTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const invFilter =
          "tenant = '" +
          escapedEffTenant +
          "' && email = '" +
          escapedEmail +
          "' && status = 'pending'"
        const existingInvs = txApp.findRecordsByFilter('invitations', invFilter, '-created', 10, 0)
        for (let i = 0; i < existingInvs.length; i++) {
          const oldInv = existingInvs[i]
          oldInv.set('status', 'cancelled')
          txApp.save(oldInv)
        }

        const inv = new Record(invCol)
        inv.set('name', rawName)
        inv.set('email', normalizedEmail)
        inv.set('role', requestedRole)
        inv.set('tenant', effectiveTenantId)
        inv.set('invited_by', auth.getString('name') || authRole)
        inv.set('status', 'pending')
        inv.set('token_hash', tokenHash)
        inv.set('expires_at', expirationDate)
        inv.set('rate_limit_hash', rateHash)
        if (userRec) {
          inv.set('user', userRec.id)
        }
        txApp.save(inv)
      })

      // Resposta genérica sem enumeração nem vazamento de segredos
      return e.json(200, {
        success: true,
        message: 'Convite enviado com sucesso. O titular deve aceitar para concluir o vínculo.',
        status: 'pendente',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao processar convite.' })
    }
  },
  $apis.requireAuth(),
)
