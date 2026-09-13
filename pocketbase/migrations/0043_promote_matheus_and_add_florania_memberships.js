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

    // 2. Alterar o papel da conta de Matheus para superadmin
    // Importante: superadmin é papel da conta, sem vínculo municipal
    user.set('role', 'superadmin')
    // Conforme padrão do sistema para superadmin (ex: Dr. Silval), superadmin tem tenant nulo
    user.set('tenant', '')
    app.save(user)

    // 3. Localizar o tenant Florânia
    let florania = null
    try {
      florania = app.findFirstRecordByData('tenants', 'slug', floraniaSlug)
    } catch (_) {}

    if (!florania) {
      throw new Error('Tenant Florânia (' + floraniaSlug + ') não foi localizado no banco.')
    }

    const membershipsCol = app.findCollectionByNameOrId('user_memberships')

    // 4. Criar vínculos ativos com Florânia nos papéis 'admin' e 'servidor'
    // Verificar se já existe vínculo ativo ou pendente para cada papel em Florânia
    const rolesToCreate = ['admin', 'servidor']

    for (var i = 0; i < rolesToCreate.length; i++) {
      const roleName = rolesToCreate[i]
      let existingRecord = null

      try {
        const found = app.findRecordsByFilter(
          'user_memberships',
          "user = '" + user.id + "' && tenant = '" + florania.id + "' && role = '" + roleName + "'",
          '',
          1,
          0,
        )
        if (found && found.length > 0) {
          existingRecord = found[0]
        }
      } catch (_) {}

      if (existingRecord) {
        existingRecord.set('status', 'ativo')
        app.save(existingRecord)
      } else {
        const memRecord = new Record(membershipsCol)
        memRecord.set('user', user.id)
        memRecord.set('tenant', florania.id)
        memRecord.set('role', roleName)
        memRecord.set('status', 'ativo')
        app.save(memRecord)
      }
    }
  },
  (app) => {
    // Reversão segura se necessário
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
