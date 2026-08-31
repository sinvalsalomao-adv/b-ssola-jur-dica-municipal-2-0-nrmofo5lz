// Dedicated Backend Endpoints for Tenant User Management & Memberships
// Routes:
// 1. GET  /backend/v1/tenant-users/list    -> Lists/searches users/memberships of authorized tenant (tenant required for non-superadmin)
// 2. GET  /backend/v1/tenant-users/view    -> Gets minimized details of a specific user in requested tenant (tenant required for non-superadmin)
// 3. POST /backend/v1/tenant-users/update  -> Updates profile name and membership role/status in requested tenant
// 4. POST /backend/v1/tenant-users/delete  -> Removes/unlinks user membership in requested tenant (or safe delete)
// 5. POST /backend/v1/tenant-users/approve -> Approves pending membership in requested tenant
// 6. POST /backend/v1/tenant-users/reject  -> Rejects pending membership in requested tenant

// --- 1. LIST USERS OF TENANT ---
routerAdd(
  'GET',
  '/backend/v1/tenant-users/list',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const query = e.requestInfo().query || {}
    const requestedTenant = String(query.tenant || '').trim()
    const search = String(query.search || query.q || '')
      .trim()
      .toLowerCase()
    const statusFilter = String(query.status || '')
      .trim()
      .toLowerCase()
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage || '50', 10) || 50))

    // Validação de formato seguro para IDs/filtros
    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    const allowedStatuses = ['', 'ativo', 'pendente', 'inativo', 'rejeitado']
    if (statusFilter && allowedStatuses.indexOf(statusFilter) === -1) {
      return e.json(400, { code: 400, message: 'Filtro de status inválido.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || ''
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para gestão municipal.',
        })
      }

      // Revalida explicitamente que o autenticado possui membership admin ATIVA no tenant solicitado
      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo no município selecionado.',
          })
        }
        effectiveTenantId = requestedTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    try {
      let memFilter = "id != ''"
      if (effectiveTenantId) {
        const safeEscapedTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        memFilter = "tenant = '" + safeEscapedTenant + "'"
      }

      if (statusFilter) {
        const safeStatus = statusFilter.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        memFilter += " && status = '" + safeStatus + "'"
      }

      const memberships = $app.findRecordsByFilter(
        'user_memberships',
        memFilter,
        '-created',
        1000,
        0,
      )

      const items = []
      const tenantsMap = {}

      for (let i = 0; i < memberships.length; i++) {
        const m = memberships[i]
        const uId = m.getString('user')
        const tId = m.getString('tenant')

        let uRec = null
        try {
          uRec = $app.findFirstRecordByData('users', 'id', uId)
        } catch (_) {}

        if (!uRec) continue

        const uName = uRec.getString('name') || ''
        const uEmail = uRec.getString('email') || ''
        const mRole = m.getString('role')
        const mStatus = m.getString('status')

        // Filtro em memória de texto de busca seguro
        if (search) {
          const matchName = uName.toLowerCase().indexOf(search) !== -1
          const matchEmail = uEmail.toLowerCase().indexOf(search) !== -1
          if (!matchName && !matchEmail) {
            continue
          }
        }

        if (!tenantsMap[tId]) {
          try {
            const tRec = $app.findFirstRecordByData('tenants', 'id', tId)
            tenantsMap[tId] = {
              name: tRec.getString('name') || '',
              slug: tRec.getString('slug') || '',
            }
          } catch (_) {
            tenantsMap[tId] = { name: '—', slug: '' }
          }
        }

        const tInfo = tenantsMap[tId]

        items.push({
          id: uRec.id,
          membershipId: m.id,
          name: uName,
          email: uEmail,
          tenantId: tId,
          prefeituraName: tInfo.name,
          prefeituraSlug: tInfo.slug,
          role: mRole,
          status: mStatus,
          lastAccess: m.getString('updated') || m.getString('created') || '',
          created: m.getString('created') || '',
        })
      }

      const totalItems = items.length
      const totalPages = Math.ceil(totalItems / perPage) || 1
      const offset = (page - 1) * perPage
      const pagedItems = items.slice(offset, offset + perPage)

      return e.json(200, {
        page: page,
        perPage: perPage,
        totalItems: totalItems,
        totalPages: totalPages,
        items: pagedItems,
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao listar usuários.' })
    }
  },
  $apis.requireAuth(),
)

// --- 2. VIEW SINGLE USER IN TENANT ---
routerAdd(
  'GET',
  '/backend/v1/tenant-users/view',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const query = e.requestInfo().query || {}
    const targetUserId = String(query.userId || query.id || '').trim()
    const requestedTenant = String(query.tenant || '').trim()

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!targetUserId || !safeIdRegex.test(targetUserId)) {
      return e.json(400, { code: 400, message: 'ID do usuário inválido ou não informado.' })
    }
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || ''
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para consulta municipal.',
        })
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo no município selecionado.',
          })
        }
        effectiveTenantId = requestedTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    try {
      const escapedTargetUser = targetUserId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      let filter = "user = '" + escapedTargetUser + "'"
      if (effectiveTenantId) {
        const escapedEffectiveTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        filter += " && tenant = '" + escapedEffectiveTenant + "'"
      }

      const targetMems = $app.findRecordsByFilter('user_memberships', filter, '-created', 1, 0)
      if (targetMems.length === 0) {
        return e.json(404, { code: 404, message: 'Usuário não encontrado no município.' })
      }

      const m = targetMems[0]
      const uRec = $app.findFirstRecordByData('users', 'id', targetUserId)

      let tName = '—'
      let tSlug = ''
      try {
        const tRec = $app.findFirstRecordByData('tenants', 'id', m.getString('tenant'))
        tName = tRec.getString('name') || '—'
        tSlug = tRec.getString('slug') || ''
      } catch (_) {}

      return e.json(200, {
        id: uRec.id,
        membershipId: m.id,
        name: uRec.getString('name') || '',
        email: uRec.getString('email') || '',
        tenantId: m.getString('tenant'),
        prefeituraName: tName,
        prefeituraSlug: tSlug,
        role: m.getString('role'),
        status: m.getString('status'),
        created: m.getString('created'),
        updated: m.getString('updated'),
      })
    } catch (_) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }
  },
  $apis.requireAuth(),
)

// --- 3. UPDATE USER / MEMBERSHIP IN TENANT ---
routerAdd(
  'POST',
  '/backend/v1/tenant-users/update',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const targetUserId = String(body.userId || body.id || '').trim()
    const requestedTenant = String(body.tenant || '').trim()

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!targetUserId || !safeIdRegex.test(targetUserId)) {
      return e.json(400, { code: 400, message: 'ID do usuário é obrigatório e inválido.' })
    }
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || ''
      if (!effectiveTenantId) {
        return e.json(400, {
          code: 400,
          message: 'Município (tenant) é obrigatório para atualização de usuário.',
        })
      }
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para operação municipal.',
        })
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo no município selecionado.',
          })
        }
        effectiveTenantId = requestedTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    const escapedTarget = targetUserId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const escapedEffectiveTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const memFilter = "user = '" + escapedTarget + "' && tenant = '" + escapedEffectiveTenant + "'"

    const targetMems = $app.findRecordsByFilter('user_memberships', memFilter, '-created', 1, 0)
    if (targetMems.length === 0) {
      return e.json(404, {
        code: 404,
        message: 'Usuário não encontrado no município especificado.',
      })
    }

    const targetMembership = targetMems[0]
    let targetUserRec = null
    try {
      targetUserRec = $app.findFirstRecordByData('users', 'id', targetUserId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }

    const isSelf = authId === targetUserId
    const currentRole = targetMembership.getString('role')
    const currentStatus = targetMembership.getString('status')

    const newRole = body.role !== undefined ? String(body.role).trim() : currentRole
    const newStatus = body.status !== undefined ? String(body.status).trim() : currentStatus
    const newName = body.name !== undefined ? String(body.name).trim() : null

    if (newRole === 'superadmin') {
      return e.json(403, { code: 403, message: 'Papel de superadministrador não é permitido.' })
    }

    const allowedRoles = ['admin', 'servidor', 'gestor', 'secretario', 'procurador']
    if (allowedRoles.indexOf(newRole) === -1) {
      return e.json(400, { code: 400, message: 'Papel inválido especificado.' })
    }

    const allowedStatuses = ['ativo', 'inativo', 'pendente', 'rejeitado']
    if (allowedStatuses.indexOf(newStatus) === -1) {
      return e.json(400, { code: 400, message: 'Status inválido especificado.' })
    }

    // Regra do Último Admin Ativo
    const isTargetActiveAdmin = currentRole === 'admin' && currentStatus === 'ativo'
    const willDemoteOrDeactivate = newRole !== 'admin' || newStatus !== 'ativo'

    if (isTargetActiveAdmin && willDemoteOrDeactivate) {
      const activeAdminsFilter =
        "tenant = '" + escapedEffectiveTenant + "' && role = 'admin' && status = 'ativo'"
      const activeAdmins = $app.findRecordsByFilter(
        'user_memberships',
        activeAdminsFilter,
        '',
        10,
        0,
      )
      if (activeAdmins.length <= 1) {
        return e.json(400, {
          code: 400,
          message:
            'Não é permitido desativar ou rebaixar o único Administrador ativo deste município.',
        })
      }
    }

    // Admin local não pode rebaixar a si próprio se não for superadmin
    if (
      authRole !== 'superadmin' &&
      isSelf &&
      (newRole !== currentRole || newStatus !== currentStatus)
    ) {
      if (currentRole === 'admin' && newRole !== 'admin') {
        return e.json(403, {
          code: 403,
          message: 'Você não pode remover seu próprio papel de administrador.',
        })
      }
    }

    try {
      $app.runInTransaction((txApp) => {
        if (newName && newName !== targetUserRec.getString('name')) {
          targetUserRec.set('name', newName)
          txApp.save(targetUserRec)
        }

        if (newRole !== currentRole || newStatus !== currentStatus) {
          targetMembership.set('role', newRole)
          targetMembership.set('status', newStatus)
          txApp.save(targetMembership)
        }
      })

      return e.json(200, {
        success: true,
        message: 'Usuário atualizado com sucesso.',
        user: {
          id: targetUserRec.id,
          name: targetUserRec.getString('name'),
          email: targetUserRec.getString('email'),
          role: targetMembership.getString('role'),
          status: targetMembership.getString('status'),
        },
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao salvar alterações do usuário.' })
    }
  },
  $apis.requireAuth(),
)

// --- 4. DELETE / UNLINK USER IN TENANT ---
routerAdd(
  'POST',
  '/backend/v1/tenant-users/delete',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const targetUserId = String(body.userId || body.id || '').trim()
    const requestedTenant = String(body.tenant || '').trim()

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!targetUserId || !safeIdRegex.test(targetUserId)) {
      return e.json(400, { code: 400, message: 'ID do usuário é obrigatório e inválido.' })
    }
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || ''
      if (!effectiveTenantId) {
        return e.json(400, {
          code: 400,
          message: 'Município (tenant) é obrigatório para desvinculação.',
        })
      }
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para desvinculação municipal.',
        })
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo no município selecionado.',
          })
        }
        effectiveTenantId = requestedTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    const escapedTarget = targetUserId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const escapedEffectiveTenant = effectiveTenantId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const memFilter = "user = '" + escapedTarget + "' && tenant = '" + escapedEffectiveTenant + "'"

    const targetMems = $app.findRecordsByFilter('user_memberships', memFilter, '-created', 1, 0)
    if (targetMems.length === 0) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado no município.' })
    }

    const targetMembership = targetMems[0]
    const isTargetAdmin =
      targetMembership.getString('role') === 'admin' &&
      targetMembership.getString('status') === 'ativo'

    // Regra do Último Admin Ativo
    if (isTargetAdmin) {
      const activeAdminsFilter =
        "tenant = '" + escapedEffectiveTenant + "' && role = 'admin' && status = 'ativo'"
      const activeAdmins = $app.findRecordsByFilter(
        'user_memberships',
        activeAdminsFilter,
        '',
        10,
        0,
      )
      if (activeAdmins.length <= 1) {
        return e.json(400, {
          code: 400,
          message: 'Não é permitido desvincular o único Administrador ativo deste município.',
        })
      }
    }

    // Impedir auto-exclusão pelo admin local
    if (authRole !== 'superadmin' && authId === targetUserId) {
      return e.json(403, {
        code: 403,
        message: 'Você não pode remover seu próprio vínculo de administrador.',
      })
    }

    try {
      $app.runInTransaction((txApp) => {
        txApp.delete(targetMembership)

        const escapedTargetForOther = targetUserId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
        const otherMems = txApp.findRecordsByFilter(
          'user_memberships',
          "user = '" + escapedTargetForOther + "'",
          '',
          10,
          0,
        )

        if (otherMems.length === 0 && authRole === 'superadmin') {
          try {
            const uRec = txApp.findFirstRecordByData('users', 'id', targetUserId)
            if (uRec.getString('role') !== 'superadmin') {
              txApp.delete(uRec)
            }
          } catch (_) {}
        }
      })

      return e.json(200, {
        success: true,
        message: 'Vínculo do usuário com o município removido com sucesso.',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao desvincular usuário.' })
    }
  },
  $apis.requireAuth(),
)

// --- 5. APPROVE MEMBERSHIP IN TENANT ---
routerAdd(
  'POST',
  '/backend/v1/tenant-users/approve',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const membershipId = String(body.membershipId || body.id || '').trim()
    const requestedTenant = String(body.tenant || body.tenantId || '').trim()
    const requestedRole = body.role ? String(body.role).trim() : null

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!membershipId || !safeIdRegex.test(membershipId)) {
      return e.json(400, { code: 400, message: 'ID da solicitação/membership inválido.' })
    }
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    let targetMem = null
    try {
      targetMem = $app.findFirstRecordByData('user_memberships', 'id', membershipId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Solicitação de vínculo não encontrada.' })
    }

    const targetTenant = targetMem.getString('tenant')
    const targetUserId = targetMem.getString('user')

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = targetTenant
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para aprovação municipal.',
        })
      }

      if (requestedTenant !== targetTenant) {
        return e.json(403, {
          code: 403,
          message: 'A solicitação não pertence ao município informado.',
        })
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo neste município.',
          })
        }
        effectiveTenantId = requestedTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    // Proibir autopromoção / autoaprovação por usuário comum ou admin sem privilégio
    if (
      authRole !== 'superadmin' &&
      authId === targetUserId &&
      targetMem.getString('status') === 'pendente'
    ) {
      return e.json(403, {
        code: 403,
        message: 'Você não pode autoaprovar sua própria solicitação.',
      })
    }

    const currentRole = targetMem.getString('role')
    const finalRole = requestedRole || currentRole
    if (finalRole === 'superadmin') {
      return e.json(403, { code: 403, message: 'Papel de superadministrador não é permitido.' })
    }

    const allowedRoles = ['admin', 'servidor', 'gestor', 'secretario', 'procurador']
    if (allowedRoles.indexOf(finalRole) === -1) {
      return e.json(400, { code: 400, message: 'Papel inválido especificado.' })
    }

    try {
      targetMem.set('status', 'ativo')
      targetMem.set('role', finalRole)
      $app.save(targetMem)

      let uRec = null
      try {
        uRec = $app.findFirstRecordByData('users', 'id', targetUserId)
      } catch (_) {}

      let tRec = null
      try {
        tRec = $app.findFirstRecordByData('tenants', 'id', targetTenant)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Vínculo aprovado com sucesso!',
        membership: {
          id: targetMem.id,
          userId: targetUserId,
          userName: uRec ? uRec.getString('name') : '—',
          userEmail: uRec ? uRec.getString('email') : '',
          tenantId: targetTenant,
          tenantName: tRec ? tRec.getString('name') : '—',
          tenantSlug: tRec ? tRec.getString('slug') : '',
          role: finalRole,
          status: 'ativo',
          created: targetMem.getString('created'),
          updated: targetMem.getString('updated'),
        },
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao aprovar vínculo.' })
    }
  },
  $apis.requireAuth(),
)

// --- 6. REJECT MEMBERSHIP IN TENANT ---
routerAdd(
  'POST',
  '/backend/v1/tenant-users/reject',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const membershipId = String(body.membershipId || body.id || '').trim()
    const requestedTenant = String(body.tenant || body.tenantId || '').trim()

    const safeIdRegex = /^[a-zA-Z0-9_-]{1,40}$/
    if (!membershipId || !safeIdRegex.test(membershipId)) {
      return e.json(400, { code: 400, message: 'ID da solicitação/membership inválido.' })
    }
    if (requestedTenant && !safeIdRegex.test(requestedTenant)) {
      return e.json(400, { code: 400, message: 'ID de município inválido.' })
    }

    let targetMem = null
    try {
      targetMem = $app.findFirstRecordByData('user_memberships', 'id', membershipId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Solicitação de vínculo não encontrada.' })
    }

    const targetTenant = targetMem.getString('tenant')
    const targetUserId = targetMem.getString('user')

    if (authRole === 'superadmin') {
      // Superadmin tem acesso total
    } else {
      if (!requestedTenant) {
        return e.json(400, {
          code: 400,
          message: 'Parâmetro tenant é obrigatório para rejeição municipal.',
        })
      }

      if (requestedTenant !== targetTenant) {
        return e.json(403, {
          code: 403,
          message: 'A solicitação não pertence ao município informado.',
        })
      }

      const escapedAuthId = authId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const escapedTenant = requestedTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
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
            message: 'Você não possui permissão de Administrador ativo neste município.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    // Regra do último admin ativo (caso estivesse ativo e como admin)
    const currentRole = targetMem.getString('role')
    const currentStatus = targetMem.getString('status')
    if (currentRole === 'admin' && currentStatus === 'ativo') {
      const escapedTenantForAdmins = targetTenant.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      const activeAdminsFilter =
        "tenant = '" + escapedTenantForAdmins + "' && role = 'admin' && status = 'ativo'"
      const activeAdmins = $app.findRecordsByFilter(
        'user_memberships',
        activeAdminsFilter,
        '',
        10,
        0,
      )
      if (activeAdmins.length <= 1) {
        return e.json(400, {
          code: 400,
          message:
            'Não é permitido rejeitar/desativar o único Administrador ativo deste município.',
        })
      }
    }

    try {
      targetMem.set('status', 'rejeitado')
      $app.save(targetMem)

      let uRec = null
      try {
        uRec = $app.findFirstRecordByData('users', 'id', targetUserId)
      } catch (_) {}

      let tRec = null
      try {
        tRec = $app.findFirstRecordByData('tenants', 'id', targetTenant)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Vínculo rejeitado com sucesso.',
        membership: {
          id: targetMem.id,
          userId: targetUserId,
          userName: uRec ? uRec.getString('name') : '—',
          userEmail: uRec ? uRec.getString('email') : '',
          tenantId: targetTenant,
          tenantName: tRec ? tRec.getString('name') : '—',
          tenantSlug: tRec ? tRec.getString('slug') : '',
          role: currentRole,
          status: 'rejeitado',
          created: targetMem.getString('created'),
          updated: targetMem.getString('updated'),
        },
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao rejeitar vínculo.' })
    }
  },
  $apis.requireAuth(),
)
