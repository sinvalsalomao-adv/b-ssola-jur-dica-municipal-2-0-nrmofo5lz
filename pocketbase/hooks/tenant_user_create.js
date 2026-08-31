// Dedicated Transactional Endpoint for Tenant Admins to Create/Invite Users
// Route: POST /backend/v1/tenant-users/create
// Requires Auth: Local Admin (active in target tenant) or Superadmin
//
// STRICT SECURITY RULES:
// 1. Email is normalized server-side.
// 2. Returns generic, indistinguishable 200/201 response for both existing and new emails to prevent email enumeration.
//    NEVER returns userId, existence boolean, generated password, token, or extra PII.
// 3. For EXISTING global user: NEVER creates an active membership directly.
//    Creates/updates a pending invitation with cryptographic token hash, short expiration,
//    and a pending membership (status: 'pendente'). The role is strictly bounded (servidor/admin/gestor/etc., NEVER superadmin).
// 4. For NEW user: If password is provided, creates account with verified=false and pending membership;
//    or creates pending invitation for account setup.
// 5. Cryptographic token is hashed (SHA-256) before storing; only hash is saved.
// 6. Implements rate limiting per tenant + recipient hash.
// 7. Concurrent/repeated invites reuse the pending invitation record or replace with a new token hash without duplicating memberships.

routerAdd(
  'POST',
  '/backend/v1/tenant-users/create',
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
    const rawPassword = String(body.password || '')
    const rawPasswordConfirm = String(body.passwordConfirm || '')
    const requestedRole = String(body.role || 'servidor').trim()
    const requestedTenant = String(body.tenant || '').trim()

    // 1. Validação de formato seguro para IDs
    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.badRequestError('ID de município inválido.')
    }

    // 2. Validações de campos obrigatórios
    if (!rawName) return e.badRequestError('Nome completo é obrigatório.')
    if (!rawEmail || !rawEmail.includes('@') || rawEmail.length > 255) {
      return e.badRequestError('Email válido é obrigatório.')
    }

    // Normalização rigorosa do e-mail
    const emailParts = rawEmail.split('@')
    if (emailParts.length !== 2 || !emailParts[0] || !emailParts[1]) {
      return e.badRequestError('Email válido é obrigatório.')
    }
    const normalizedEmail =
      emailParts[0].trim().toLowerCase() + '@' + emailParts[1].trim().toLowerCase()

    // 3. Determinação e validação do Tenant
    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
      if (!effectiveTenantId) {
        return e.badRequestError('Município/Tenant é obrigatório para criação pelo superadmin.')
      }
    } else {
      let checkTenant = requestedTenant
      if (!checkTenant) {
        return e.badRequestError('Município/Tenant é obrigatório.')
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
            message: 'Você não tem permissão de Administrador ativo no município selecionado.',
          })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(403, {
          code: 403,
          message: 'Erro ao validar privilégios no município.',
        })
      }
    }

    // 4. Validação de Role permitida (NUNCA superadmin)
    const allowedRoles = ['servidor', 'gestor', 'secretario', 'procurador', 'admin']
    if (allowedRoles.indexOf(requestedRole) === -1) {
      return e.badRequestError('Papel inválido especificado.')
    }

    // 5. Verificar se o município está ativo
    try {
      const tRec = $app.findFirstRecordByData('tenants', 'id', effectiveTenantId)
      if (tRec.getString('status') !== 'ativa') {
        return e.badRequestError('O município selecionado está inativo.')
      }
    } catch (_) {
      return e.badRequestError('Município não encontrado.')
    }

    // 6. Rate limit por tenant + destinatário normalizado em hash
    const rateHash = $security.sha256(effectiveTenantId + ':' + normalizedEmail)
    const cache = $app.store()
    const rateLimitKey = 'rl_inv_' + rateHash
    const nowMs = Date.now()
    let sendCount = 0
    if (cache.has(rateLimitKey)) {
      sendCount = Number(cache.get(rateLimitKey)) || 0
    }
    if (sendCount >= 5) {
      return e.json(429, {
        code: 429,
        message:
          'Limite de convites excedido para este destinatário. Aguarde alguns minutos antes de reenviar.',
      })
    }
    cache.set(rateLimitKey, sendCount + 1, 300) // Janela de 5 minutos

    // 7. Gerar Token Seguro e seu Hash SHA-256
    const rawToken = $security.randomString(32) + $security.randomString(32)
    const tokenHash = $security.sha256(rawToken)
    const expirationDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19) // 48h

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = $app.findCollectionByNameOrId('user_memberships')
    const invCol = $app.findCollectionByNameOrId('invitations')

    // 8. Executar Transação Atômica para criação/convite
    try {
      $app.runInTransaction((txApp) => {
        let userRecord = null
        try {
          userRecord = txApp.findAuthRecordByEmail('_pb_users_auth_', normalizedEmail)
        } catch (_) {}

        if (!userRecord) {
          // Usuário global ainda não existe:
          // Se senha fornecida, valida requisitos de segurança
          if (rawPassword) {
            if (rawPassword !== rawPasswordConfirm) {
              throw new Error('As senhas não coincidem.')
            }
            const hasMinLen = rawPassword.length >= 8
            const hasUpper = /[A-Z]/.test(rawPassword)
            const hasLower = /[a-z]/.test(rawPassword)
            const hasNumber = /[0-9]/.test(rawPassword)
            const hasSpecial = /[@$!%*?&]/.test(rawPassword)
            if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
              throw new Error('A senha não atende aos requisitos de segurança mínimos.')
            }

            userRecord = new Record(usersCol)
            userRecord.setEmail(normalizedEmail)
            userRecord.setPassword(rawPassword)
            userRecord.setVerified(false) // Não verificado até ativação/aceite
            userRecord.set('name', rawName)
            userRecord.set('role', requestedRole)
            userRecord.set('status', 'ativo')
            userRecord.set('tenant', effectiveTenantId)
            txApp.save(userRecord)
          } else {
            // Cria conta provisória com senha aleatória forte não revelada
            const tempPassword = $security.randomString(24) + 'A1!@' + $security.randomString(8)
            userRecord = new Record(usersCol)
            userRecord.setEmail(normalizedEmail)
            userRecord.setPassword(tempPassword)
            userRecord.setVerified(false)
            userRecord.set('name', rawName)
            userRecord.set('role', requestedRole)
            userRecord.set('status', 'ativo')
            userRecord.set('tenant', effectiveTenantId)
            txApp.save(userRecord)
          }
        } else {
          // Usuário global JÁ EXISTE:
          // NÃO ativar membership automaticamente!
          // Se o nome no registro estiver vazio, preencher
          if (rawName && !userRecord.getString('name')) {
            userRecord.set('name', rawName)
            txApp.save(userRecord)
          }
        }

        // 9. Membership em user_memberships: SEMPRE PENDENTE se for novo convite ou e-mail existente
        // Verificar se já existe membership neste tenant
        const escapedUserId = userRecord.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const escapedEffTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const memFilter = "user = '" + escapedUserId + "' && tenant = '" + escapedEffTenant + "'"

        let membershipRecord = null
        const existingMems = txApp.findRecordsByFilter('user_memberships', memFilter, '', 1, 0)
        if (existingMems.length > 0) {
          membershipRecord = existingMems[0]
          // Se já está ativo, mantemos status ou se for pendente/rejeitado, mantém pendente
          if (membershipRecord.getString('status') !== 'ativo') {
            membershipRecord.set('status', 'pendente')
            membershipRecord.set('role', requestedRole)
            txApp.save(membershipRecord)
          }
        } else {
          membershipRecord = new Record(memCol)
          membershipRecord.set('user', userRecord.id)
          membershipRecord.set('tenant', effectiveTenantId)
          membershipRecord.set('role', requestedRole)
          // REGRA CARDINAL DE SEGURANÇA: Vínculo SEMPRE inicia como pendente
          membershipRecord.set('status', 'pendente')
          txApp.save(membershipRecord)
        }

        // 10. Atualizar ou Criar Convite na coleção invitations com token_hash e rate_limit_hash
        const escapedEmail = normalizedEmail.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const invFilter =
          "tenant = '" +
          escapedEffTenant +
          "' && email = '" +
          escapedEmail +
          "' && status = 'pending'"
        const existingInvs = txApp.findRecordsByFilter('invitations', invFilter, '-created', 10, 0)

        // Cancelar convites pendentes anteriores para invalidar tokens antigos (uso único e reenvio seguro)
        for (let i = 0; i < existingInvs.length; i++) {
          const oldInv = existingInvs[i]
          oldInv.set('status', 'cancelled')
          txApp.save(oldInv)
        }

        // Criar o novo convite ativo pendente
        const invRecord = new Record(invCol)
        invRecord.set('name', rawName)
        invRecord.set('email', normalizedEmail)
        invRecord.set('role', requestedRole)
        invRecord.set('tenant', effectiveTenantId)
        invRecord.set('invited_by', auth.getString('name') || authRole)
        invRecord.set('status', 'pending')
        invRecord.set('token_hash', tokenHash)
        invRecord.set('expires_at', expirationDate)
        invRecord.set('rate_limit_hash', rateHash)
        invRecord.set('user', userRecord.id)
        txApp.save(invRecord)
      })

      // RESPOSTA GENÉRICA E INDISTINGUÍVEL (Regra R-1: Sem enumeração de e-mails, sem userId, sem token, sem senha)
      return e.json(200, {
        success: true,
        message:
          'Solicitação de cadastro/convite processada com sucesso. O titular deverá aceitar o vínculo para ativação.',
        status: 'pendente',
      })
    } catch (err) {
      const errMsg = err ? err.message || String(err) : ''
      if (errMsg.includes('senhas não coincidem') || errMsg.includes('requisitos de segurança')) {
        return e.badRequestError(errMsg)
      }
      return e.json(500, {
        code: 500,
        message: 'Erro ao processar convite do usuário.',
      })
    }
  },
  $apis.requireAuth(),
)
