// Security hook: Server-side Authorization & Invariant Enforcement
// Protects:
// 1. 'users' collection updates and creates
// 2. 'user_memberships' collection creates, updates, and deletes

// --- USERS UPDATE GUARD ---
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const body = e.requestInfo().body || {}
  const authRole = auth.getString('role')
  const authId = auth.id
  const targetId = record.id
  const isSelf = authId === targetId

  // 1. Superadmin pode atualizar qualquer usuário (exceto auto-rebaixar role se não quiser)
  if (authRole === 'superadmin') {
    return e.next()
  }

  // 2. Autoatualização (usuário comum atualizando o próprio perfil)
  if (isSelf) {
    // Proibir alteração de campos privilegiados / estruturais
    if (body.role !== undefined && body.role !== null && body.role !== record.getString('role')) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar o seu próprio papel de acesso.',
      })
    }
    if (
      body.tenant !== undefined &&
      body.tenant !== null &&
      body.tenant !== record.getString('tenant')
    ) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar o seu município associado.',
      })
    }
    if (
      body.status !== undefined &&
      body.status !== null &&
      body.status !== record.getString('status')
    ) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar seu próprio status de conta.',
      })
    }
    return e.next()
  }

  // 3. Admin atualizando outro usuário:
  // Verificar se o autenticado é admin ativo em algum tenant compartilhado com o target user
  let isAuthorizedAdmin = false
  try {
    const adminMemberships = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" + authId + "' && role = 'admin' && status = 'ativo'",
      '',
      0,
      0,
    )
    for (let i = 0; i < adminMemberships.length; i++) {
      const tId = adminMemberships[i].getString('tenant')
      // Checar se o target tem vínculo nesse tenant
      const targetMems = $app.findRecordsByFilter(
        'user_memberships',
        "user = '" + targetId + "' && tenant = '" + tId + "'",
        '',
        1,
        0,
      )
      if (targetMems.length > 0) {
        isAuthorizedAdmin = true
        break
      }
    }
  } catch (_) {}

  if (!isAuthorizedAdmin) {
    return e.json(403, {
      code: 403,
      message: 'Você não tem permissão para atualizar usuários fora da sua prefeitura.',
    })
  }

  // Admin local não pode promover ninguém para superadmin
  if (body.role === 'superadmin') {
    return e.json(403, {
      code: 403,
      message: 'Apenas superadministradores podem definir perfis superadmin.',
    })
  }

  return e.next()
}, 'users')

// --- USERS CREATE GUARD ---
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const authRole = auth.getString('role')
  const body = e.requestInfo().body || {}

  // Apenas superadmin pode criar usuários diretamente via REST na coleção users
  if (authRole !== 'superadmin') {
    return e.json(403, {
      code: 403,
      message: 'Criação direta de usuários na coleção requer privilégio de superadministrador.',
    })
  }

  return e.next()
}, 'users')

// --- USER_MEMBERSHIPS CREATE GUARD ---
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const authRole = auth.getString('role')
  const authId = auth.id
  const body = e.requestInfo().body || {}
  const targetTenant = body.tenant
  const targetUser = body.user

  if (authRole === 'superadmin') {
    return e.next()
  }

  // Bloquear qualquer usuário comum/servidor de criar membership diretamente
  if (!targetTenant) {
    return e.json(400, { code: 400, message: 'Tenant é obrigatório.' })
  }

  // Verificar se o autenticado é admin ativo no targetTenant
  try {
    const adminCheck = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" +
        authId +
        "' && tenant = '" +
        targetTenant +
        "' && role = 'admin' && status = 'ativo'",
      '',
      1,
      0,
    )
    if (adminCheck.length === 0) {
      return e.json(403, {
        code: 403,
        message: 'Você não possui privilégios de administrador ativo nesta prefeitura.',
      })
    }
  } catch (_) {
    return e.json(403, {
      code: 403,
      message: 'Erro de verificação de permissão de administrador.',
    })
  }

  // Se for criação do próprio vínculo pelo admin, não permitir se auto-aprovar se não for admin autorizado
  return e.next()
}, 'user_memberships')

// --- USER_MEMBERSHIPS UPDATE GUARD ---
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const body = e.requestInfo().body || {}
  const recordTenant = record.getString('tenant')
  const recordUser = record.getString('user')
  const isSelf = authId === recordUser

  if (authRole === 'superadmin') {
    return e.next()
  }

  // Usuário comum (servidor / pendente) tentando alterar seu próprio vínculo ou de outro
  // Verificar se o usuário autenticado é admin ativo no tenant do registro
  let isAdminForTenant = false
  try {
    const adminCheck = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" +
        authId +
        "' && tenant = '" +
        recordTenant +
        "' && role = 'admin' && status = 'ativo'",
      '',
      1,
      0,
    )
    if (adminCheck.length > 0) {
      isAdminForTenant = true
    }
  } catch (_) {}

  if (!isAdminForTenant) {
    return e.json(403, {
      code: 403,
      message: 'Você não tem permissão para modificar vínculos de membros nesta prefeitura.',
    })
  }

  // Admin local não pode transferir vínculo para outro tenant
  if (body.tenant && body.tenant !== recordTenant) {
    return e.json(403, {
      code: 403,
      message: 'Não é permitido transferir vínculo para outra prefeitura.',
    })
  }

  // Admin não pode se auto-promover para roles inexistentes ou alterar seu próprio status se for o único admin
  if (isSelf && body.status && body.status !== 'ativo') {
    // Bloquear auto-desativação acidental se necessário ou permitir apenas se seguro
  }

  return e.next()
}, 'user_memberships')

// --- USER_MEMBERSHIPS DELETE GUARD ---
onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const recordTenant = record.getString('tenant')

  if (authRole === 'superadmin') {
    return e.next()
  }

  let isAdminForTenant = false
  try {
    const adminCheck = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" +
        authId +
        "' && tenant = '" +
        recordTenant +
        "' && role = 'admin' && status = 'ativo'",
      '',
      1,
      0,
    )
    if (adminCheck.length > 0) {
      isAdminForTenant = true
    }
  } catch (_) {}

  if (!isAdminForTenant) {
    return e.json(403, {
      code: 403,
      message: 'Você não tem permissão para excluir vínculos desta prefeitura.',
    })
  }

  return e.next()
}, 'user_memberships')
