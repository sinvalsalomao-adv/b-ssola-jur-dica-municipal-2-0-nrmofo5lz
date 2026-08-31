// Route: POST /backend/v1/tenant-users/create-admin-fixture
// Dedicated Authenticated Endpoint for Superadmin to Provision Real Local Admin Fixtures in Ephemeral Tenants
// STRICT SECURITY CONSTRAINTS:
// 1. Only accessible by authenticated superadmin (or local admin in own tenant).
// 2. Automatically links user as active admin with strong random password or specified strong password.
// 3. Exclusively for tenant administration & privileged test setup, separated from public registration.

routerAdd(
  'POST',
  '/backend/v1/tenant-users/create-admin-fixture',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}

    const name = String(body.name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const password = String(body.password || '')
    const passwordConfirm = String(body.passwordConfirm || '')
    const tenantId = String(body.tenant || body.tenantId || '').trim()

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!tenantId || !safeIdRegex.test(tenantId)) {
      return e.badRequestError('ID de município inválido.')
    }

    if (!name) return e.badRequestError('Nome é obrigatório.')
    if (!email || !email.includes('@')) return e.badRequestError('Email válido é obrigatório.')
    if (!password) return e.badRequestError('Senha é obrigatória.')
    if (password !== passwordConfirm) return e.badRequestError('As senhas não coincidem.')

    // Validação de força de senha
    const hasMinLen = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    const hasSpecial = /[@$!%*?&]/.test(password)
    if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return e.json(400, {
        code: 400,
        message: 'A senha não atende aos requisitos de segurança mínimos.',
      })
    }

    // Permissão: Superadmin ou Admin ativo no tenant solicitado
    if (authRole !== 'superadmin') {
      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de administrador neste município.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao verificar privilégios.' })
      }
    }

    // Verificar se o tenant existe
    try {
      $app.findFirstRecordByData('tenants', 'id', tenantId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = $app.findCollectionByNameOrId('user_memberships')

    let userRec = null
    try {
      userRec = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}

    try {
      $app.runInTransaction((txApp) => {
        if (!userRec) {
          userRec = new Record(usersCol)
          userRec.setEmail(email)
          userRec.setPassword(password)
          userRec.setVerified(true)
          userRec.set('name', name)
          userRec.set('role', 'admin')
          userRec.set('status', 'ativo')
          userRec.set('tenant', tenantId)
          txApp.save(userRec)
        }

        const escapedUser = userRec.id.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const escapedTenant = tenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const memFilter = "user = '" + escapedUser + "' && tenant = '" + escapedTenant + "'"

        let memRec = null
        const existingMems = txApp.findRecordsByFilter('user_memberships', memFilter, '', 1, 0)
        if (existingMems.length > 0) {
          memRec = existingMems[0]
          memRec.set('role', 'admin')
          memRec.set('status', 'ativo')
          txApp.save(memRec)
        } else {
          memRec = new Record(memCol)
          memRec.set('user', userRec.id)
          memRec.set('tenant', tenantId)
          memRec.set('role', 'admin')
          memRec.set('status', 'ativo')
          txApp.save(memRec)
        }
      })

      return e.json(201, {
        success: true,
        userId: userRec.id,
        tenantId: tenantId,
        role: 'admin',
        status: 'ativo',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao provisionar fixture de admin.' })
    }
  },
  $apis.requireAuth(),
)
