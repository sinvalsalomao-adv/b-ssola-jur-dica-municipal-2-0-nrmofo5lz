// Dedicated Transactional Endpoint for Creating/Inviting Tenant Users
// Route: POST /backend/v1/tenant-users/create
// Requires Auth: Local Admin (active in target tenant) or Superadmin

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

    // 6. R-3: Rate limit persistente e em memória por tenant + destinatário normalizado em hash
    const recipientHash = $security.sha256(effectiveTenantId + ':' + normalizedEmail)
    const activeKey = effectiveTenantId + ':' + recipientHash
    const now = new Date()
    const fiveMinutesAgoIso = new Date(now.getTime() - 5 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)

    // Rate limit persistente via tabela invitations
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
        message:
          'Limite de convites excedido para este destinatário. Aguarde alguns minutos antes de reenviar.',
      })
    }
    cache.set(rateLimitKey, sendCount + 1, 300) // Janela de 5 minutos

    // 7. Gerar Token Seguro e seu Hash SHA-256 (nunca retornado nem logado)
    const rawToken = $security.randomString(32) + $security.randomString(32)
    const tokenHash = $security.sha256(rawToken)
    const expirationDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19) // 48h

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = $app.findCollectionByNameOrId('user_memberships')
    const invCol = $app.findCollectionByNameOrId('invitations')

    let deliveryStatus = 'delivery_pending'

    // 8. Executar Transação Atômica para criação/convite
    try {
      $app.runInTransaction((txApp) => {
        let userRecord = null
        try {
          userRecord = txApp.findAuthRecordByEmail('_pb_users_auth_', normalizedEmail)
        } catch (_) {}

        if (!userRecord) {
          // R-4 & R-5: Novo usuário NÃO recebe senha inicial pela UI/endpoint
          // Define senha provisória aleatória forte e NÃO revelada
          // R-5: Papel global users.role é SEMPRE neutro 'servidor', autoridade municipal somente na membership
          const tempPassword = $security.randomString(24) + 'A1!@' + $security.randomString(8)
          userRecord = new Record(usersCol)
          userRecord.setEmail(normalizedEmail)
          userRecord.setPassword(tempPassword)
          userRecord.setVerified(false)
          userRecord.set('name', rawName)
          userRecord.set('role', 'servidor') // Neutro global
          userRecord.set('status', 'ativo')
          userRecord.set('tenant', effectiveTenantId)
          txApp.save(userRecord)
        } else {
          if (rawName && !userRecord.getString('name')) {
            userRecord.set('name', rawName)
            txApp.save(userRecord)
          }
        }

        // 9. Membership em user_memberships: SEMPRE PENDENTE se for novo convite ou e-mail existente
        const memFilter = 'user = {:userId} && tenant = {:tenantId}'
        const memParams = { userId: userRecord.id, tenantId: effectiveTenantId }

        let membershipRecord = null
        const existingMems = txApp.findRecordsByFilter(
          'user_memberships',
          memFilter,
          '',
          1,
          0,
          memParams,
        )
        if (existingMems.length > 0) {
          membershipRecord = existingMems[0]
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
          membershipRecord.set('status', 'pendente')
          txApp.save(membershipRecord)
        }

        // 10. R-3: Cancelar e liberar active_key de convites pendentes anteriores para reenvio transacionado
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
          oldInv.set('active_key', '') // Libera chave para unicidade atômica
          txApp.save(oldInv)
        }

        // Criar o novo convite ativo pendente com active_key único
        const invRecord = new Record(invCol)
        invRecord.set('name', rawName)
        invRecord.set('email', normalizedEmail)
        invRecord.set('role', requestedRole)
        invRecord.set('tenant', effectiveTenantId)
        invRecord.set('invited_by', auth.getString('name') || authRole)
        invRecord.set('status', 'pending')
        invRecord.set('token_hash', tokenHash)
        invRecord.set('expires_at', expirationDate)
        invRecord.set('rate_limit_hash', recipientHash)
        invRecord.set('recipient_hash', recipientHash)
        invRecord.set('active_key', activeKey)
        invRecord.set('delivery_status', 'delivery_pending')
        invRecord.set('user', userRecord.id)
        txApp.save(invRecord)
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
            $os.getenv('PUBLIC_URL') || $os.getenv('APP_URL') || 'http://localhost:5173'
          const inviteUrl = appOrigin + '/convite#token=' + rawToken
          const subject = '[Bússola Jurídica] Convite de Acesso Municipal'
          const html =
            '<h3>Olá, ' +
            rawName +
            '!</h3>' +
            '<p>Você recebeu um convite para integrar a equipe municipal no sistema Bússola Jurídica.</p>' +
            '<p>Para aceitar este convite com segurança e definir sua senha de acesso, utilize o link de uso único abaixo:</p>' +
            '<p><a href="' +
            inviteUrl +
            '">Aceitar Convite e Acessar</a></p>' +
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
          deliveryStatus = 'delivery_pending'
        }
      } catch (mailErr) {
        $app.logger().error('Falha no envio de email de convite', 'error', String(mailErr))
        deliveryStatus = 'delivery_failed'
      }

      if (deliveryStatus !== 'delivery_pending') {
        try {
          const createdInv = $app.findFirstRecordByData('invitations', 'token_hash', tokenHash)
          if (createdInv) {
            createdInv.set('delivery_status', deliveryStatus)
            $app.save(createdInv)
          }
        } catch (_) {}
      }

      // RESPOSTA GENÉRICA E INDISTINGUÍVEL (Sem enumeração de e-mails, sem userId, sem token, sem senha)
      return e.json(200, {
        success: true,
        message:
          'Solicitação de cadastro/convite processada com sucesso. O titular deverá aceitar o vínculo para ativação.',
        status: 'pendente',
      })
    } catch (err) {
      $app.logger().error('Erro ao processar criação de usuário tenant', 'error', String(err))
      return e.json(500, {
        code: 500,
        message: 'Erro ao processar convite do usuário.',
      })
    }
  },
  $apis.requireAuth(),
)
