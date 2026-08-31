// Dedicated Backend Endpoints for Tenant User Management
// Routes:
// 1. GET  /backend/v1/tenant-users/list   -> Lists/searches active or pending users/memberships of authorized tenant
// 2. GET  /backend/v1/tenant-users/view   -> Gets minimized details of a specific user in caller's tenant
// 3. POST /backend/v1/tenant-users/update -> Updates profile name and membership role/status with transaction
// 4. POST /backend/v1/tenant-users/delete -> Removes/unlinks user membership in caller's tenant (or deletes orphan user safely)

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
    const requestedTenant = (query.tenant || '').trim()
    const search = (query.search || query.q || '').trim().toLowerCase()
    const statusFilter = (query.status || '').trim().toLowerCase() // 'ativo', 'pendente', 'inativo', or '' (all)
    const page = Math.max(1, parseInt(query.page || '1', 10) || 1)
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage || '50', 10) || 50))

    // Determinação do tenant autorizado
    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
      // Superadmin sem tenant selecionado pode listar tudo ou de um tenant
    } else {
      // Local Admin: deve ter membership ATIVA com role 'admin' no tenant solicitado (ou derivado de suas memberships)
      let checkTenant = requestedTenant
      if (!checkTenant) {
        // Se não veio requestedTenant, buscar o tenant onde o usuário é admin ativo
        try {
          const myAdminMems = $app.findRecordsByFilter(
            'user_memberships',
            "user = '" + authId + "' && role = 'admin' && status = 'ativo'",
            '-created',
            1,
            0,
          )
          if (myAdminMems.length > 0) {
            checkTenant = myAdminMems[0].getString('tenant')
          }
        } catch (_) {}
      }
      if (!checkTenant) {
        checkTenant = auth.getString('tenant')
      }

      if (!checkTenant) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
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
          return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
      }
    }

    try {
      // Buscar memberships do tenant
      let memFilter = ''
      if (effectiveTenantId) {
        memFilter = "tenant = '" + effectiveTenantId + "'"
      } else {
        memFilter = "id != ''" // Superadmin vendo todos
      }

      if (statusFilter) {
        memFilter += " && status = '" + statusFilter + "'"
      }

      // Buscar todos os registros correspondentes ordenados por -created
      const memberships = $app.findRecordsByFilter(
        'user_memberships',
        memFilter,
        '-created',
        500,
        0,
      )

      // Carregar os dados dos usuários e tenants relacionados de forma eficiente
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

        // Aplicar filtro de busca normalizada (nome / email)
        if (search) {
          const matchName = uName.toLowerCase().indexOf(search) !== -1
          const matchEmail = uEmail.toLowerCase().indexOf(search) !== -1
          if (!matchName && !matchEmail) {
            continue
          }
        }

        // Cache do tenant para nome/slug
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

      // Paginação in-memory dos itens filtrados
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
    const targetUserId = (query.userId || query.id || '').trim()
    const requestedTenant = (query.tenant || '').trim()

    if (!targetUserId) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
    } else {
      let checkTenant = requestedTenant
      if (!checkTenant) {
        try {
          const myAdminMems = $app.findRecordsByFilter(
            'user_memberships',
            "user = '" + authId + "' && role = 'admin' && status = 'ativo'",
            '-created',
            1,
            0,
          )
          if (myAdminMems.length > 0) {
            checkTenant = myAdminMems[0].getString('tenant')
          }
        } catch (_) {}
      }
      if (!checkTenant) checkTenant = auth.getString('tenant')

      if (!checkTenant) {
        return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
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
          return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
      }
    }

    // Verificar se o targetUserId possui membership no effectiveTenantId
    try {
      let filter = "user = '" + targetUserId + "'"
      if (effectiveTenantId) {
        filter += " && tenant = '" + effectiveTenantId + "'"
      }

      const targetMems = $app.findRecordsByFilter('user_memberships', filter, '-created', 1, 0)
      if (targetMems.length === 0) {
        return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
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
    const targetUserId = (body.userId || body.id || '').trim()
    const requestedTenant = (body.tenant || '').trim()

    if (!targetUserId) {
      return e.json(400, { code: 400, message: 'ID do usuário é obrigatório.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
    } else {
      let checkTenant = requestedTenant
      if (!checkTenant) {
        try {
          const myAdminMems = $app.findRecordsByFilter(
            'user_memberships',
            "user = '" + authId + "' && role = 'admin' && status = 'ativo'",
            '-created',
            1,
            0,
          )
          if (myAdminMems.length > 0) {
            checkTenant = myAdminMems[0].getString('tenant')
          }
        } catch (_) {}
      }
      if (!checkTenant) checkTenant = auth.getString('tenant')

      if (!checkTenant) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
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
          return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
      }
    }

    // Validações de segurança e integridade
    const targetMems = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" + targetUserId + "' && tenant = '" + effectiveTenantId + "'",
      '-created',
      1,
      0,
    )
    if (targetMems.length === 0) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado no município.' })
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

    // Proibir promoção a superadmin
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

    // Regra do Último Admin Ativo: se estiver rebaixando role ou inativando/rejeitando status de um admin ativo
    const isTargetActiveAdmin = currentRole === 'admin' && currentStatus === 'ativo'
    const willDemoteOrDeactivate = newRole !== 'admin' || newStatus !== 'ativo'

    if (isTargetActiveAdmin && willDemoteOrDeactivate) {
      const activeAdmins = $app.findRecordsByFilter(
        'user_memberships',
        "tenant = '" + effectiveTenantId + "' && role = 'admin' && status = 'ativo'",
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

    // Admin local não pode rebaixar a si próprio se for deixar sem admin
    if (isSelf && (newRole !== currentRole || newStatus !== currentStatus)) {
      if (currentRole === 'admin' && newRole !== 'admin') {
        return e.json(403, {
          code: 403,
          message: 'Você não pode remover seu próprio papel de administrador.',
        })
      }
    }

    // Execução atômica da atualização
    try {
      $app.runInTransaction((txApp) => {
        // Atualizar nome no perfil se enviado
        if (newName && newName !== targetUserRec.getString('name')) {
          targetUserRec.set('name', newName)
          txApp.save(targetUserRec)
        }

        // Atualizar membership
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
    const targetUserId = (body.userId || body.id || '').trim()
    const requestedTenant = (body.tenant || '').trim()

    if (!targetUserId) {
      return e.json(400, { code: 400, message: 'ID do usuário é obrigatório.' })
    }

    let effectiveTenantId = ''
    if (authRole === 'superadmin') {
      effectiveTenantId = requestedTenant || auth.getString('tenant')
    } else {
      let checkTenant = requestedTenant
      if (!checkTenant) {
        try {
          const myAdminMems = $app.findRecordsByFilter(
            'user_memberships',
            "user = '" + authId + "' && role = 'admin' && status = 'ativo'",
            '-created',
            1,
            0,
          )
          if (myAdminMems.length > 0) {
            checkTenant = myAdminMems[0].getString('tenant')
          }
        } catch (_) {}
      }
      if (!checkTenant) checkTenant = auth.getString('tenant')

      if (!checkTenant) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
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
          return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
        }
        effectiveTenantId = checkTenant
      } catch (_) {
        return e.json(403, { code: 403, message: 'Acesso não autorizado.' })
      }
    }

    // Verificar se o targetUserId possui membership no effectiveTenantId
    const targetMems = $app.findRecordsByFilter(
      'user_memberships',
      "user = '" + targetUserId + "' && tenant = '" + effectiveTenantId + "'",
      '-created',
      1,
      0,
    )
    if (targetMems.length === 0) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado no município.' })
    }

    const targetMembership = targetMems[0]
    const isTargetAdmin =
      targetMembership.getString('role') === 'admin' &&
      targetMembership.getString('status') === 'ativo'

    // Regra do Último Admin Ativo
    if (isTargetAdmin) {
      const activeAdmins = $app.findRecordsByFilter(
        'user_memberships',
        "tenant = '" + effectiveTenantId + "' && role = 'admin' && status = 'ativo'",
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

    // Impedir auto-exclusão pelo admin local se não for superadmin
    if (authRole !== 'superadmin' && authId === targetUserId) {
      return e.json(403, {
        code: 403,
        message: 'Você não pode remover seu próprio vínculo de administrador.',
      })
    }

    try {
      $app.runInTransaction((txApp) => {
        // 1. Remover o vínculo com o município
        txApp.delete(targetMembership)

        // 2. Verificar se o usuário possui outros vínculos em outros municípios
        const otherMems = txApp.findRecordsByFilter(
          'user_memberships',
          "user = '" + targetUserId + "'",
          '',
          10,
          0,
        )

        // Se o usuário não possui mais NENHUM outro vínculo e não é superadmin, verificar se o registro auth pode ser removido
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
