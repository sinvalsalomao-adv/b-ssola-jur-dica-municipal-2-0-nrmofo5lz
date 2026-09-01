// Security Hook & Validation for Academia Multi-tenant (Secretarias, Grupos Educacionais e Membros)
// Enforces:
// 1. Secretarias: Tenant match, active admin of tenant or superadmin, immutable audit log
// 2. Education Groups: Tenant match, secretaria belongs to same tenant, active admin or superadmin, immutable audit log
// 3. Education Group Members: Target user must be active in same tenant, cannot be inactive or foreign tenant, immutable audit log
// 4. Zero leak of foreign tenant existence on direct ID access or manipulation (uniform sanitized errors)
// 5. Strict parametrized queries {:param} on all DB operations

// --- HELPER INLINE VALIDATORS ---

// 1. SECRETARIAS CREATE GUARD & AUDIT
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')

  if (!targetTenant) {
    return e.json(400, { code: 400, message: 'Município é obrigatório.' })
  }

  // Validate tenant authorization
  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para administrar secretarias neste município.',
      })
    }
  }

  return e.next()
}, 'secretarias')

onRecordAfterCreateSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const secName = record.getString('nome') || 'Secretaria'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Criou secretaria')
    logRec.set('description', 'Criou a secretaria/unidade: ' + secName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de criacao de secretaria:', err)
  }
}, 'secretarias')

// SECRETARIAS UPDATE GUARD & AUDIT
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const originalRecord = record.original()
  const originalTenant = originalRecord
    ? originalRecord.getString('tenant')
    : record.getString('tenant')
  const body = e.requestInfo().body || {}

  if (body.tenant && body.tenant !== originalTenant) {
    return e.json(403, {
      code: 403,
      message: 'Não é permitido transferir secretaria entre municípios.',
    })
  }

  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: originalTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar secretarias neste município.',
      })
    }
  }

  return e.next()
}, 'secretarias')

onRecordAfterUpdateSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const secName = record.getString('nome') || 'Secretaria'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Editou secretaria')
    logRec.set('description', 'Atualizou dados da secretaria/unidade: ' + secName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de edicao de secretaria:', err)
  }
}, 'secretarias')

// SECRETARIAS DELETE GUARD & AUDIT
onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')

  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para excluir secretarias neste município.',
      })
    }
  }

  return e.next()
}, 'secretarias')

onRecordAfterDeleteSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const secName = record.getString('nome') || 'Secretaria'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Excluiu secretaria')
    logRec.set('description', 'Excluiu a secretaria/unidade: ' + secName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de exclusao de secretaria:', err)
  }
}, 'secretarias')

// 2. EDUCATION GROUPS CREATE GUARD & AUDIT
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')
  const secretariaId = record.getString('secretaria')

  if (!targetTenant) {
    return e.json(400, { code: 400, message: 'Município é obrigatório.' })
  }

  // Validate admin authority
  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para criar grupos educacionais neste município.',
      })
    }
  }

  // Validate that associated secretaria belongs strictly to the same tenant
  if (secretariaId) {
    try {
      const secRec = $app.findFirstRecordByData('secretarias', 'id', secretariaId)
      if (!secRec || secRec.getString('tenant') !== targetTenant) {
        return e.json(400, {
          code: 400,
          message: 'A secretaria selecionada não pertence ao município informado.',
        })
      }
    } catch (_) {
      return e.json(400, {
        code: 400,
        message: 'Secretaria inválida ou não encontrada.',
      })
    }
  }

  return e.next()
}, 'education_groups')

onRecordAfterCreateSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const grpName = record.getString('nome') || 'Grupo Educacional'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Criou grupo educacional')
    logRec.set('description', 'Criou o grupo educacional: ' + grpName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de criacao de grupo educacional:', err)
  }
}, 'education_groups')

// EDUCATION GROUPS UPDATE GUARD & AUDIT
onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const originalRecord = record.original()
  const originalTenant = originalRecord
    ? originalRecord.getString('tenant')
    : record.getString('tenant')
  const body = e.requestInfo().body || {}
  const targetSecretaria = record.getString('secretaria')

  if (body.tenant && body.tenant !== originalTenant) {
    return e.json(403, {
      code: 403,
      message: 'Não é permitido transferir grupo educacional entre municípios.',
    })
  }

  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: originalTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para alterar grupos educacionais neste município.',
      })
    }
  }

  if (targetSecretaria) {
    try {
      const secRec = $app.findFirstRecordByData('secretarias', 'id', targetSecretaria)
      if (!secRec || secRec.getString('tenant') !== originalTenant) {
        return e.json(400, {
          code: 400,
          message: 'A secretaria selecionada não pertence ao município informado.',
        })
      }
    } catch (_) {
      return e.json(400, {
        code: 400,
        message: 'Secretaria inválida ou não encontrada.',
      })
    }
  }

  return e.next()
}, 'education_groups')

onRecordAfterUpdateSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const grpName = record.getString('nome') || 'Grupo Educacional'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Editou grupo educacional')
    logRec.set('description', 'Atualizou dados do grupo educacional: ' + grpName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de edicao de grupo educacional:', err)
  }
}, 'education_groups')

// EDUCATION GROUPS DELETE GUARD & AUDIT
onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')

  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para excluir grupos educacionais neste município.',
      })
    }
  }

  return e.next()
}, 'education_groups')

onRecordAfterDeleteSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const grpName = record.getString('nome') || 'Grupo Educacional'

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Excluiu grupo educacional')
    logRec.set('description', 'Excluiu o grupo educacional: ' + grpName)
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de exclusao de grupo educacional:', err)
  }
}, 'education_groups')

// 3. EDUCATION GROUP MEMBERS CREATE GUARD & AUDIT
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')
  const targetUserId = record.getString('user')
  const targetGroupId = record.getString('group')

  if (!targetTenant || !targetUserId || !targetGroupId) {
    return e.json(400, {
      code: 400,
      message: 'Dados incompletos para associação ao grupo.',
    })
  }

  // 1. Admin authority check
  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para associar membros neste município.',
      })
    }
  }

  // 2. Validate group belongs to targetTenant
  try {
    const groupRec = $app.findFirstRecordByData('education_groups', 'id', targetGroupId)
    if (!groupRec || groupRec.getString('tenant') !== targetTenant) {
      return e.json(400, {
        code: 400,
        message: 'O grupo educacional informado é inválido ou de outro município.',
      })
    }
  } catch (_) {
    return e.json(400, {
      code: 400,
      message: 'Grupo educacional não encontrado.',
    })
  }

  // 3. Validate user belongs to targetTenant with status 'ativo' (no foreign or inactive or tenantless user)
  let isUserActiveInTenant = false
  try {
    const memFilter = "user = {:userId} && tenant = {:tenantId} && status = 'ativo'"
    const memParams = { userId: targetUserId, tenantId: targetTenant }
    const userMems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (userMems.length > 0) {
      isUserActiveInTenant = true
    } else {
      // Fallback check on users record
      const uRec = $app.findFirstRecordByData('users', 'id', targetUserId)
      if (
        uRec &&
        uRec.getString('tenant') === targetTenant &&
        uRec.getString('status') === 'ativo'
      ) {
        isUserActiveInTenant = true
      }
    }
  } catch (_) {}

  if (!isUserActiveInTenant) {
    return e.json(400, {
      code: 400,
      message: 'Apenas usuários ativos deste mesmo município podem ser associados ao grupo.',
    })
  }

  // Set added_by if empty
  if (!record.getString('added_by')) {
    record.set('added_by', authId)
  }

  return e.next()
}, 'education_group_members')

onRecordAfterCreateSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const targetUserId = record.getString('user')

  let targetUserName = 'Usuário'
  try {
    const uRec = $app.findFirstRecordByData('users', 'id', targetUserId)
    targetUserName = uRec.getString('name') || uRec.getString('email') || 'Usuário'
  } catch (_) {}

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Adicionou membro ao grupo')
    logRec.set('description', 'Associou o usuário ' + targetUserName + ' ao grupo educacional')
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de adicao de membro ao grupo:', err)
  }
}, 'education_group_members')

// EDUCATION GROUP MEMBERS DELETE GUARD & AUDIT
onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth) {
    return e.json(401, { code: 401, message: 'Autenticação necessária.' })
  }

  const record = e.record
  if (!record) return e.next()

  const authRole = auth.getString('role')
  const authId = auth.id
  const targetTenant = record.getString('tenant')

  if (authRole !== 'superadmin') {
    let isAdminForTenant = false
    try {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      const adminCheck = $app.findRecordsByFilter(
        'user_memberships',
        checkFilter,
        '',
        1,
        0,
        checkParams,
      )
      if (adminCheck.length > 0) {
        isAdminForTenant = true
      }
    } catch (_) {}

    if (!isAdminForTenant) {
      return e.json(403, {
        code: 403,
        message: 'Você não tem permissão para remover membros de grupos neste município.',
      })
    }
  }

  return e.next()
}, 'education_group_members')

onRecordAfterDeleteSuccess((e) => {
  const auth = e.auth
  const record = e.record
  if (!record) return

  const actorName = auth
    ? auth.getString('name') || auth.getString('email') || 'Usuário'
    : 'Sistema'
  const tenantId = record.getString('tenant')
  const targetUserId = record.getString('user')

  let targetUserName = 'Usuário'
  try {
    const uRec = $app.findFirstRecordByData('users', 'id', targetUserId)
    targetUserName = uRec.getString('name') || uRec.getString('email') || 'Usuário'
  } catch (_) {}

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const logRec = new Record(auditCol)
    logRec.set('user_name', actorName)
    logRec.set('action_type', 'Removeu membro do grupo')
    logRec.set('description', 'Removeu o usuário ' + targetUserName + ' do grupo educacional')
    logRec.set('project_title', 'Bússola Academia')
    logRec.set('tenant', tenantId)
    $app.save(logRec)
  } catch (err) {
    console.log('Erro ao registrar auditoria de remocao de membro do grupo:', err)
  }
}, 'education_group_members')
