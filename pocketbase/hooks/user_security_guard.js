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

  // 1. Superadmin pode atualizar qualquer usuário
  if (authRole === 'superadmin') {
    return e.next()
  }

  // 2. Bloqueio para qualquer usuário não-superadmin atualizar terceiros diretamente
  if (!isSelf) {
    return e.json(403, {
      code: 403,
      message: 'Você não tem permissão para alterar dados de outros usuários diretamente.',
    })
  }

  // 3. Autoatualização (usuário comum atualizando o próprio perfil)
  // Proibir expressamente alteração de campos privilegiados / estruturais
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
}, 'users')

// --- USERS CREATE GUARD ---
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const authRole = auth.getString('role')

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

  // Admin local não pode se auto-promover ou alterar o próprio status/role
  if (isSelf && body.status && body.status !== record.getString('status')) {
    return e.json(403, {
      code: 403,
      message: 'Você não pode alterar o status do seu próprio vínculo.',
    })
  }
  if (isSelf && body.role && body.role !== record.getString('role')) {
    return e.json(403, {
      code: 403,
      message: 'Você não pode alterar o papel do seu próprio vínculo.',
    })
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
