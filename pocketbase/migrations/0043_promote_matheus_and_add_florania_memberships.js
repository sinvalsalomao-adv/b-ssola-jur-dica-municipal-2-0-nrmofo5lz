migrate(
  (app) => {
    const targetEmail = 'matheusflotencio137482@gmail.com'
    const targetUserId = '52o9enaexq1pxev'
    const floraniaSlug = 'florania'

    // 1. Localizar o usuário Matheus (por ID ou email)
    let user = null
    try {
      user = app.findFirstRecordByData('_pb_users_auth_', 'id', targetUserId)
    } catch (_) {}

    if (!user) {
      try {
        user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
      } catch (_) {}
    }

    if (!user) {
      throw new Error('Usuário Matheus (' + targetEmail + ') não foi localizado no banco.')
    }

    // 2. Promover o papel da conta para 'superadmin' caso ainda não seja
    // Usuários superadmin globais mantêm tenant nulo
    let userModified = false
    if (user.getString('role') !== 'superadmin') {
      user.set('role', 'superadmin')
      userModified = true
    }
    if (user.getString('tenant') !== '') {
      user.set('tenant', '')
      userModified = true
    }
    if (userModified) {
      app.save(user)
    }

    // 3. Localizar o tenant Florânia
    let florania = null
    try {
      florania = app.findFirstRecordByData('tenants', 'slug', floraniaSlug)
    } catch (_) {}

    if (!florania) {
      throw new Error('Tenant Florânia (' + floraniaSlug + ') não foi localizado no banco.')
    }

    // 4. Criar ou atualizar o vínculo com Florânia em user_memberships
    // A coleção user_memberships possui restrição de unicidade idx_user_membership_unique (user, tenant).
    // O usuário Matheus deve possuir APENAS UM vínculo ativo com Florânia no papel "admin".
    // Papel "admin" cobre as capacidades de "servidor".
    const membershipsCol = app.findCollectionByNameOrId('user_memberships')

    let existingMembership = null
    try {
      const records = app.findRecordsByFilter(
        'user_memberships',
        "user = '" + user.id + "' && tenant = '" + florania.id + "'",
        '',
        1,
        0,
      )
      if (records && records.length > 0) {
        existingMembership = records[0]
      }
    } catch (_) {}

    if (existingMembership) {
      let needsSave = false
      if (existingMembership.getString('role') !== 'admin') {
        existingMembership.set('role', 'admin')
        needsSave = true
      }
      if (existingMembership.getString('status') !== 'ativo') {
        existingMembership.set('status', 'ativo')
        needsSave = true
      }
      if (needsSave) {
        app.save(existingMembership)
      }
    } else {
      const memRecord = new Record(membershipsCol)
      memRecord.set('user', user.id)
      memRecord.set('tenant', florania.id)
      memRecord.set('role', 'admin')
      memRecord.set('status', 'ativo')
      app.save(memRecord)
    }
  },
  (app) => {
    // Reversão segura
    const targetEmail = 'matheusflotencio137482@gmail.com'
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
      if (user) {
        user.set('role', 'servidor')
        app.save(user)
      }
    } catch (_) {}
  },
)
