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

    // 1. Validações básicas
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

    // 2. Determinação e autorização de Tenant
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

      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: checkTenant }

      try {
        const adminMems = $app.findRecordsByFilter(
          'user_memberships',
          checkFilter,
          '',
          1,
          0,
          checkParams,
        )
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

    // 3. R-3: Rate limit persistente e em memória por tenant + destinatário
    const recipientHash = $security.sha256(effectiveTenantId + ':' + normalizedEmail)
    const activeKey = effectiveTenantId + ':' + recipientHash
    const now = new Date()
    const fiveMinutesAgoIso = new Date(now.getTime() - 5 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    // Rate limit persistente via tabela invitations (rate_limit_hash + created recente)
    const rlDbFilter = 'rate_limit_hash = {:hash} && created >= {:since}'
    const rlDbParams = { hash: recipientHash, since: fiveMinutesAgoIso }
    let recentDbCount = 0
    try {
      const recentInvs = $app.findRecordsByFilter(
        'invitations',
        rlDbFilter,
        '-created',
        10,
        0,
        rlDbParams,
      )
      recentDbCount = recentInvs.length
    } catch (_) {}

    const cache = $app.store()
    const rateLimitKey = 'rl_inv_' + recipientHash
    let sendCount = 0
    if (cache.has(rateLimitKey)) {
      sendCount = Number(cache.get(rateLimitKey)) || 0
    }

    if (sendCount >= 5 || recentDbCount >= 5) {
      return e.json(429, {
        code: 429,
        message: 'Limite de convites excedido para este destinatário. Tente novamente mais tarde.',
      })
    }
    cache.set(rateLimitKey, sendCount + 1, 300)

    // 4. Gerar Token Seguro e Hash SHA-256 (nunca logado ou retornado)
    const rawToken = $security.randomString(32) + $security.randomString(32)
    const tokenHash = $security.sha256(rawToken)
    const expirationDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    const invCol = $app.findCollectionByNameOrId('invitations')
    const memCol = $app.findCollectionByNameOrId('user_memberships')
    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')

    let deliveryStatus = 'delivery_pending'

    try {
      $app.runInTransaction((txApp) => {
        let userRec = null
        try {
          userRec = txApp.findAuthRecordByEmail('_pb_users_auth_', normalizedEmail)
        } catch (_) {}

        if (!userRec) {
          // R-5: Usuário novo recebe SEMPRE role global neutra 'servidor', nunca admin/superadmin
          const tempPassword = $security.randomString(24) + 'A1!@' + $security.randomString(8)
          userRec = new Record(usersCol)
          userRec.setEmail(normalizedEmail)
          userRec.setPassword(tempPassword)
          userRec.setVerified(false)
          userRec.set('name', rawName)
          userRec.set('role', 'servidor') // Papel global neutro sem autoridade municipal/global
          userRec.set('status', 'ativo')
          userRec.set('tenant', effectiveTenantId)
          txApp.save(userRec)
        } else {
          if (rawName && !userRec.getString('name')) {
            userRec.set('name', rawName)
            txApp.save(userRec)
          }
        }

        // Criar ou garantir membership pendente
        const memFilter = 'user = {:userId} && tenant = {:tenantId}'
        const memParams = { userId: userRec.id, tenantId: effectiveTenantId }
        const existingMems = txApp.findRecordsByFilter(
          'user_memberships',
          memFilter,
          '',
          1,
          0,
          memParams,
        )
        if (existingMems.length === 0) {
          const newMem = new Record(memCol)
          newMem.set('user', userRec.id)
          newMem.set('tenant', effectiveTenantId)
          newMem.set('role', requestedRole)
          newMem.set('status', 'pendente')
          txApp.save(newMem)
        } else if (existingMems[0].getString('status') !== 'ativo') {
          existingMems[0].set('status', 'pendente')
          existingMems[0].set('role', requestedRole)
          txApp.save(existingMems[0])
        }

        // R-3: Cancelar e liberar active_key de convites pendentes anteriores para este tenant + email
        const invFilter = "tenant = {:tenantId} && email = {:email} && status = 'pending'"
        const invParams = { tenantId: effectiveTenantId, email: normalizedEmail }
        const existingInvs = txApp.findRecordsByFilter(
          'invitations',
          invFilter,
          '-created',
          10,
          0,
          invParams,
        )
        for (let i = 0; i < existingInvs.length; i++) {
          const oldInv = existingInvs[i]
          oldInv.set('status', 'cancelled')
          oldInv.set('active_key', '') // Limpa active_key para não colidir no índice único
          txApp.save(oldInv)
        }

        // Criar o novo convite único com active_key atômico
        const inv = new Record(invCol)
        inv.set('name', rawName)
        inv.set('email', normalizedEmail)
        inv.set('role', requestedRole)
        inv.set('tenant', effectiveTenantId)
        inv.set('invited_by', auth.getString('name') || authRole)
        inv.set('status', 'pending')
        inv.set('token_hash', tokenHash)
        inv.set('expires_at', expirationDate)
        inv.set('rate_limit_hash', recipientHash)
        inv.set('recipient_hash', recipientHash)
        inv.set('active_key', activeKey)
        inv.set('delivery_status', 'delivery_pending')
        inv.set('user', userRec.id)
        txApp.save(inv)
      })

      // R-4: Entrega pelo mecanismo oficial de e-mail SMTP se configurado
      try {
        let smtpConfig = null
        try {
          const ts = $app.findFirstRecordByData('tenant_settings', 'tenant', effectiveTenantId)
          const sStr = ts.getString('smtp_config')
          if (sStr) smtpConfig = JSON.parse(sStr)
        } catch (_) {}

        if (!smtpConfig) {
          try {
            const psList = $app.findRecordsByFilter('platform_settings', '', '', 1, 0)
            if (psList.length > 0) {
              const sStr2 = psList[0].getString('smtp_config')
              if (sStr2) smtpConfig = JSON.parse(sStr2)
            }
          } catch (_) {}
        }

        if (smtpConfig && smtpConfig.server && smtpConfig.username) {
          const client = $app.newMailClient({
            host: smtpConfig.server,
            port: parseInt(smtpConfig.port) || 587,
            username: smtpConfig.username || '',
            password: smtpConfig.password || '',
            authMethod: 'LOGIN',
            tls: true,
          })

          const appOrigin =
            $os.getenv('PUBLIC_URL') ||
            'https://bussola-juridica-municipal-0e0e1.shrd00.internal.goskip.dev'
          const inviteUrl = appOrigin + '/convite#token=' + rawToken
          const subject = '[Bússola Jurídica] Convite de Acesso Municipal'
          const html =
            '<h3>Olá, ' +
            rawName +
            '!</h3>' +
            '<p>Você recebeu um convite para integrar a equipe municipal no sistema Bússola Jurídica.</p>' +
            '<p>Para aceitar este convite com segurança e definir sua senha, acesse o link de uso único abaixo:</p>' +
            '<p><a href="' +
            inviteUrl +
            '">Aceitar Convite</a></p>' +
            '<p><small>Este convite é de uso único e expira em 48 horas.</small></p>'

          client.send({
            from: {
              address: smtpConfig.senderEmail || smtpConfig.username || '',
              name: smtpConfig.senderName || 'Bússola Jurídica',
            },
            to: [{ address: normalizedEmail }],
            subject: subject,
            html: html,
          })

          deliveryStatus = 'delivered'
        } else {
          // SMTP não configurado no preview -> status seguro delivery_pending/failed SEM segredo
          deliveryStatus = 'delivery_pending'
        }
      } catch (mailErr) {
        $app.logger().error('Falha no envio do email de convite', 'error', String(mailErr))
        deliveryStatus = 'delivery_failed'
      }

      // Atualiza delivery_status se necessário
      if (deliveryStatus !== 'delivery_pending') {
        try {
          const createdInv = $app.findFirstRecordByData('invitations', 'token_hash', tokenHash)
          if (createdInv) {
            createdInv.set('delivery_status', deliveryStatus)
            $app.save(createdInv)
          }
        } catch (_) {}
      }

      // Resposta genérica sem enumeração nem vazamento de segredos
      return e.json(200, {
        success: true,
        message: 'Convite processado com sucesso. O titular deve aceitar para concluir o vínculo.',
        status: 'pendente',
      })
    } catch (err) {
      $app.logger().error('Erro ao processar criação de convite', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao processar convite.' })
    }
  },
  $apis.requireAuth(),
)
