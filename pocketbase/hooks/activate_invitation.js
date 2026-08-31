// Dedicated Transactional Endpoint for Titular / Admin to Accept Municipal Invitations
// Route: POST /backend/v1/invitations/accept
// Requires Auth: Authenticated Titular (auth user email/id must strictly match invitation recipient)
// Behavior:
// 1. Validates invitation existence, status ('pending'), and expiration (expires_at).
// 2. Cryptographic token check (if token is provided, matches SHA-256 hash).
// 3. Titular Identity Check: Authenticated user ID or verified email MUST match the invitation's recipient.
//    A token alone cannot link another account.
// 4. Atomic transaction:
//    - Sets invitation status to 'accepted', used_at = now.
//    - Creates or updates exactly ONE user_memberships record to status 'ativo' in the target tenant.
//    - Preserves all existing memberships in other tenants.
//    - Returns safe sanitized response.

routerAdd(
  'POST',
  '/backend/v1/invitations/accept',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária para aceitar convite.' })
    }

    const authId = auth.id
    const authEmail = auth.getString('email').trim().toLowerCase()
    const body = e.requestInfo().body || {}
    const invitationId = String(body.invitationId || body.id || '').trim()
    const rawToken = String(body.token || '').trim()

    if (!invitationId && !rawToken) {
      return e.badRequestError('Identificador do convite ou token é obrigatório.')
    }

    let inv = null
    if (invitationId) {
      try {
        inv = $app.findFirstRecordByData('invitations', 'id', invitationId)
      } catch (_) {
        return e.json(404, { code: 404, message: 'Convite não encontrado ou inválido.' })
      }
    } else if (rawToken) {
      const tokenHash = $security.sha256(rawToken)
      try {
        inv = $app.findFirstRecordByData('invitations', 'token_hash', tokenHash)
      } catch (_) {
        return e.json(404, { code: 404, message: 'Convite não encontrado ou inválido.' })
      }
    }

    if (!inv) {
      return e.json(404, { code: 404, message: 'Convite não encontrado ou inválido.' })
    }

    // 1. Validar status
    const currentStatus = inv.getString('status')
    if (currentStatus !== 'pending') {
      return e.json(400, {
        code: 400,
        message: 'Este convite já foi processado, cancelado ou expirado.',
      })
    }

    // 2. Validar expiração
    const expiresAtStr = inv.getString('expires_at')
    if (expiresAtStr) {
      const expDate = new Date(expiresAtStr).getTime()
      if (Date.now() > expDate) {
        inv.set('status', 'expired')
        try {
          $app.save(inv)
        } catch (_) {}
        return e.json(400, {
          code: 400,
          message: 'Este convite expirou. Solicite um novo convite ao Administrador.',
        })
      }
    }

    // 3. Validar token se fornecido
    if (rawToken && inv.getString('token_hash')) {
      const expectedHash = inv.getString('token_hash')
      const providedHash = $security.sha256(rawToken)
      if (expectedHash !== providedHash) {
        return e.json(400, { code: 400, message: 'Token de convite inválido.' })
      }
    }

    // 4. Verificação Estrita de Identidade do Titular:
    // O usuário autenticado DEVE corresponder inequivocamente ao destinatário do convite
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
        // A. Marcar convite como aceito
        inv.set('status', 'accepted')
        inv.set('used_at', nowIso)
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
      return e.json(500, {
        code: 500,
        message: 'Erro ao processar aceite do convite.',
      })
    }
  },
  $apis.requireAuth(),
)
