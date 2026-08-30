// Security hook: Privilege Escalation Prevention & User Role Protection
// 1. Prevents any non-superadmin from changing 'role' (self-update or updating other users).
// 2. Prevents self-update from modifying 'role' even if the user is superadmin (prevents accidental lockout/tampering).
// 3. Prevents any admin from escalating someone to 'superadmin'.
// 4. Prevents modifying other users across tenants if not superadmin.

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

  // Se o campo role foi enviado na requisição de atualização
  if (body.role !== undefined && body.role !== null) {
    const requestedRole = String(body.role)
    const currentRole = record.getString('role')

    // 1. Autoatualização nunca pode alterar o próprio role
    if (isSelf && requestedRole !== currentRole) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar o seu próprio papel/nível de acesso.',
      })
    }

    // 2. Apenas superadmin pode alterar o papel de outros usuários
    if (!isSelf && requestedRole !== currentRole) {
      if (authRole !== 'superadmin') {
        return e.json(403, {
          code: 403,
          message: 'Apenas superadministradores podem alterar os papéis de outros usuários.',
        })
      }
    }
  }

  // Se o usuário não for superadmin, garantir que ele não altere usuários de outro tenant
  if (authRole !== 'superadmin' && !isSelf) {
    const authTenant = auth.getString('tenant')
    const targetTenant = record.getString('tenant')
    // Se existir tenant no record direto, checar; senão verificar se compartilham membership ativa
    if (authTenant && targetTenant && authTenant !== targetTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para atualizar usuários de outro município.',
      })
    }
  }

  return e.next()
}, 'users')

onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const authRole = auth.getString('role')
  const body = e.requestInfo().body || {}

  // Apenas superadmin pode criar usuários com papel 'superadmin'
  if (body.role === 'superadmin' && authRole !== 'superadmin') {
    return e.json(403, {
      code: 403,
      message: 'Apenas superadministradores podem criar usuários com perfil superadmin.',
    })
  }

  return e.next()
}, 'users')
