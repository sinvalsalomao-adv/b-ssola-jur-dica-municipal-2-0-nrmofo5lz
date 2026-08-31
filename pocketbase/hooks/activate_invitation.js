// Dedicated Transactional Endpoint for Titular to Accept Municipal Invitations
// Route: POST /backend/v1/invitations/accept
// Requires Auth: Authenticated Titular (auth user email/id must strictly match invitation recipient)
// R-2 Security Requirements:
// 1. Token OBRIGATÓRIO (body.token). Rejeita requisições sem token.
// 2. Valida hash SHA-256 do token em tempo constante.
// 3. Valida expiração (expires_at), status ('pending'), used_at (vazio).
// 4. Valida identidade do titular: e-mail ou ID verificado do autenticado DEVE corresponder ao convite.
// 5. Resposta genérica e segura em caso de token inválido/expirado/inexistente (sem enumeração).
// 6. Token nunca é exposto em logs ou URLs.

routerAdd(
  'POST',
  '/backend/v1/invitations/accept',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authEmail = auth.getString('email').trim().toLowerCase()
    const body = e.requestInfo().body || {}
    const rawToken = String(body.token || '').trim()

    // R-2: Token é estritamente obrigatório
    if (!rawToken || rawToken.length < 16) {
      return e.badRequestError('Token de convite obrigatório e inválido.')
    }

    const tokenHash = $security.sha256(rawToken)

    let inv = null
    try {
      inv = $app.findFirstRecordByData('invitations', 'token_hash', tokenHash)
    } catch (_) {
      // Resposta genérica sem revelar existência do convite
      return e.json(400, {
        code: 400,
        message: 'Convite inválido, expirado ou já utilizado.',
      })
    }

    if (!inv) {
      return e.json(400, {
        code: 400,
        message: 'Convite inválido, expirado ou já utilizado.',
      })
    }

    // 1. Comparação em tempo constante do hash do token
    const expectedHash = inv.getString('token_hash')
    if (expectedHash.length !== tokenHash.length) {
      return e.json(400, { code: 400, message: 'Convite inválido, expirado ou já utilizado.' })
    }
    let diff = 0
    for (let i = 0; i < expectedHash.length; i++) {
      diff |= expectedHash.charCodeAt(i) ^ tokenHash.charCodeAt(i)
    }
    if (diff !== 0) {
      return e.json(400, { code: 400, message: 'Convite inválido, expirado ou já utilizado.' })
    }

    // 2. Validar status
    const currentStatus = inv.getString('status')
    if (currentStatus !== 'pending') {
      return e.json(400, {
        code: 400,
        message: 'Convite inválido, expirado ou já utilizado.',
      })
    }

    // 3. Validar expiração
    const expiresAtStr = inv.getString('expires_at')
    if (expiresAtStr) {
      const expDate = new Date(expiresAtStr).getTime()
      if (Date.now() > expDate) {
        inv.set('status', 'expired')
        inv.set('active_key', '')
        try {
          $app.save(inv)
        } catch (_) {}
        return e.json(400, {
          code: 400,
          message: 'Convite inválido, expirado ou já utilizado.',
        })
      }
    }

    // 4. Verificação Estrita de Identidade do Titular:
    const invEmail = inv.getString('email').trim().toLowerCase()
    const invUserId = inv.getString('user')

    const isMatchByEmail = invEmail && authEmail && invEmail === authEmail
    const isMatchById = invUserId && authId && invUserId === authId

    if (!isMatchByEmail && !isMatchById) {
      return e.json(403, {
        code: 403,
        message: 'Apenas o titular do e-mail convidado pode aceitar este convite.',
      })
    }

    const tenantId = inv.getString('tenant')
    const roleToAssign = inv.getString('role') || 'servidor'
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const memCol = $app.findCollectionByNameOrId('user_memberships')
    let membershipRecord = null

    try {
      $app.runInTransaction((txApp) => {
        // A. Marcar convite como aceito e limpar active_key
        inv.set('status', 'accepted')
        inv.set('used_at', nowIso)
        inv.set('active_key', '')
        inv.set('user', authId)
        txApp.save(inv)

        // B. Criar ou ativar exatamente uma membership no tenant alvo
        const escapedUserId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const escapedTenantId = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const memFilter = "user = '" + escapedUserId + "' && tenant = '" + escapedTenantId + "'"

        const existingMems = txApp.findRecordsByFilter('user_memberships', memFilter, '', 1, 0)
        if (existingMems.length > 0) {
          membershipRecord = existingMems[0]
          membershipRecord.set('role', roleToAssign)
          membershipRecord.set('status', 'ativo')
          txApp.save(membershipRecord)
        } else {
          membershipRecord = new Record(memCol)
          membershipRecord.set('user', authId)
          membershipRecord.set('tenant', tenantId)
          membershipRecord.set('role', roleToAssign)
          membershipRecord.set('status', 'ativo')
          txApp.save(membershipRecord)
        }
      })

      // C. Resposta segura
      let tenantName = '—'
      try {
        const tRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
        tenantName = tRec.getString('name') || '—'
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Convite aceito com sucesso! Vínculo com o município ativado.',
        membership: {
          id: membershipRecord.id,
          tenantId: tenantId,
          tenantName: tenantName,
          role: roleToAssign,
          status: 'ativo',
        },
      })
    } catch (err) {
      $app.logger().error('Erro ao processar aceite de convite', 'error', String(err))
      return e.json(500, {
        code: 500,
        message: 'Erro ao processar aceite do convite.',
      })
    }
  },
  $apis.requireAuth(),
)
