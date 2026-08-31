// Dedicated Endpoints for Declining and Cancelling Invitations
// Routes:
// 1. POST /backend/v1/invitations/decline -> Authenticated titular declines invitation (marks rejected/cancelled without creating active link)
// 2. POST /backend/v1/invitations/cancel  -> Tenant Admin or Superadmin cancels invitation belonging to own tenant

// 1. DECLINE INVITATION (Titular only)
routerAdd(
  'POST',
  '/backend/v1/invitations/decline',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária para recusar convite.' })
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

    if (inv.getString('status') !== 'pending') {
      return e.json(400, { code: 400, message: 'Este convite já foi processado ou finalizado.' })
    }

    const invEmail = inv.getString('email').trim().toLowerCase()
    const invUserId = inv.getString('user')

    const isMatchByEmail = invEmail && authEmail && invEmail === authEmail
    const isMatchById = invUserId && authId && invUserId === authId

    if (!isMatchByEmail && !isMatchById) {
      return e.json(403, {
        code: 403,
        message: 'Apenas o destinatário do convite pode recusá-lo.',
      })
    }

    try {
      $app.runInTransaction((txApp) => {
        inv.set('status', 'rejected')
        txApp.save(inv)

        // Se houver uma membership pendente deste usuário no tenant do convite, marcar como rejeitado
        const tenantId = inv.getString('tenant')
        const escapedUserId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const escapedTenantId = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const memFilter = "user = '" + escapedUserId + "' && tenant = '" + escapedTenantId + "'"

        const mems = txApp.findRecordsByFilter('user_memberships', memFilter, '', 1, 0)
        if (mems.length > 0 && mems[0].getString('status') === 'pendente') {
          mems[0].set('status', 'rejeitado')
          txApp.save(mems[0])
        }
      })

      return e.json(200, {
        success: true,
        message: 'Convite recusado com sucesso.',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao recusar convite.' })
    }
  },
  $apis.requireAuth(),
)

// 2. CANCEL INVITATION (Admin of target tenant or Superadmin)
routerAdd(
  'POST',
  '/backend/v1/invitations/cancel',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária para cancelar convite.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const invitationId = String(body.invitationId || body.id || '').trim()

    if (!invitationId) {
      return e.badRequestError('ID do convite é obrigatório.')
    }

    let inv = null
    try {
      inv = $app.findFirstRecordByData('invitations', 'id', invitationId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Convite não encontrado.' })
    }

    const tenantId = inv.getString('tenant')

    // Verificação de privilégios de Admin no tenant do convite
    if (authRole !== 'superadmin') {
      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenantId = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const checkFilter =
        "user = '" +
        escapedAuthId +
        "' && tenant = '" +
        escapedTenantId +
        "' && role = 'admin' && status = 'ativo'"

      try {
        const adminMems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0)
        if (adminMems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Você só pode cancelar convites do seu próprio município.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao verificar permissões de administrador.' })
      }
    }

    try {
      inv.set('status', 'cancelled')
      $app.save(inv)

      return e.json(200, {
        success: true,
        message: 'Convite cancelado com sucesso.',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao cancelar convite.' })
    }
  },
  $apis.requireAuth(),
)
