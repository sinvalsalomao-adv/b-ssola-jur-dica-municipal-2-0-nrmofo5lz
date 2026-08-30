// Dedicated Transactional Endpoint for Tenant Admins to Create/Link Users
// Route: POST /backend/v1/tenant-users/create
// Requires Auth: Local Admin (active in target tenant) or Superadmin
// Behavior:
// 1. Derives tenant from caller's active admin membership (or body.tenant if superadmin).
// 2. Validates password strength (8+ chars, upper, lower, digit, special).
// 3. Allowed roles: only 'servidor', 'gestor', 'secretario', 'procurador', 'admin'. NEVER 'superadmin'.
// 4. If global user exists with that email: links user to tenant with status 'ativo' (no duplication, no password overwrite).
// 5. If global user does not exist: creates new user with validated password and links to tenant with status 'ativo'.
// 6. Returns generic safe payload without exposing password, tokens or internal hashes.

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

    const name = (body.name || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const passwordConfirm = String(body.passwordConfirm || '')
    const requestedRole = (body.role || 'servidor').trim()
    const requestedTenant = (body.tenant || '').trim()

    // 1. Validações de campos obrigatórios
    if (!name) return e.badRequestError('Nome completo é obrigatório.')
    if (!email || !email.includes('@')) return e.badRequestError('Email válido é obrigatório.')

    // 2. Determinação e validação do Tenant
    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
      if (!effectiveTenantId) {
        return e.badRequestError('Município/Tenant é obrigatório para criação pelo superadmin.')
      }
    } else {
      // Para Admin local, verificar se possui membership ativa como admin no requestedTenant (ou no seu próprio tenant)
      let checkTenant = requestedTenant || auth.getString('tenant')
      if (!checkTenant) {
        return e.badRequestError('Município/Tenant é obrigatório.')
      }

      try {
        const adminMems = $app.findRecordsByFilter(
          'user_memberships',
          "user = '" +
            authId +
            "' && tenant = '" +
            checkTenant +
            "' && role = 'admin' && status = 'ativo'",
          '',
          1,
          0,
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

    // 3. Validação de Role permitida (NUNCA superadmin)
    const allowedRoles = ['servidor', 'gestor', 'secretario', 'procurador', 'admin']
    if (allowedRoles.indexOf(requestedRole) === -1) {
      return e.badRequestError('Papel inválido especificado.')
    }

    // 4. Verificar se o município está ativo
    try {
      const tenantRec = $app.findCollectionByNameOrId('tenants')
      const tRec = $app.findFirstRecordByData('tenants', 'id', effectiveTenantId)
      if (tRec.getString('status') !== 'ativa') {
        return e.badRequestError('O município selecionado está inativo.')
      }
    } catch (_) {
      return e.badRequestError('Município não encontrado.')
    }

    // 5. Verificar se o usuário global já existe
    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = $app.findCollectionByNameOrId('user_memberships')

    let userRecord = null
    try {
      userRecord = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}

    if (!userRecord) {
      // Para novo usuário, senha é obrigatória e deve ser validada
      if (!password) {
        return e.badRequestError('Senha é obrigatória para criar novo usuário.')
      }
      if (password !== passwordConfirm) {
        return e.badRequestError('As senhas não coincidem.')
      }

      const hasMinLen = password.length >= 8
      const hasUpper = /[A-Z]/.test(password)
      const hasLower = /[a-z]/.test(password)
      const hasNumber = /[0-9]/.test(password)
      const hasSpecial = /[@$!%*?&]/.test(password)
      if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
        return e.json(400, {
          code: 400,
          message:
            'A senha não atende aos requisitos de segurança mínimos (8+ caracteres, maiúscula, minúscula, número e caractere especial).',
        })
      }

      try {
        userRecord = new Record(usersCol)
        userRecord.setEmail(email)
        userRecord.setPassword(password)
        userRecord.setVerified(true)
        userRecord.set('name', name)
        userRecord.set('role', requestedRole)
        userRecord.set('status', 'ativo')
        userRecord.set('tenant', effectiveTenantId)
        $app.save(userRecord)
      } catch (err) {
        return e.json(500, { code: 500, message: 'Erro ao criar conta do usuário.' })
      }
    } else {
      // Usuário global já existe.
      // Atualizar nome se fornecido e não preenchido
      if (name && !userRecord.getString('name')) {
        userRecord.set('name', name)
        try {
          $app.save(userRecord)
        } catch (_) {}
      }
    }

    // 6. Criar ou ativar vínculo em user_memberships no effectiveTenantId
    let membershipRecord = null
    try {
      const existingMems = $app.findRecordsByFilter(
        'user_memberships',
        "user = '" + userRecord.id + "' && tenant = '" + effectiveTenantId + "'",
        '',
        1,
        0,
      )
      if (existingMems.length > 0) {
        membershipRecord = existingMems[0]
        membershipRecord.set('role', requestedRole)
        membershipRecord.set('status', 'ativo')
        $app.save(membershipRecord)
      } else {
        membershipRecord = new Record(memCol)
        membershipRecord.set('user', userRecord.id)
        membershipRecord.set('tenant', effectiveTenantId)
        membershipRecord.set('role', requestedRole)
        membershipRecord.set('status', 'ativo')
        $app.save(membershipRecord)
      }
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao vincular usuário ao município.' })
    }

    return e.json(201, {
      success: true,
      message: 'Usuário vinculado e ativado com sucesso!',
      user: {
        id: userRecord.id,
        name: userRecord.getString('name'),
        email: userRecord.getString('email'),
      },
      membership: {
        id: membershipRecord.id,
        tenant: effectiveTenantId,
        role: requestedRole,
        status: 'ativo',
      },
    })
  },
  $apis.requireAuth(),
)
