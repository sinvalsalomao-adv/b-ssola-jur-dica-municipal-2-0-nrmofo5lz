migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    // 1. Criar a coleção user_memberships
    const membershipsCol = new Collection({
      name: 'user_memberships',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'role',
          type: 'select',
          required: true,
          values: ['admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'ativo', 'inativo', 'rejeitado'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_user_membership_unique ON user_memberships (user, tenant)',
        'CREATE INDEX idx_user_membership_tenant ON user_memberships (tenant)',
        'CREATE INDEX idx_user_membership_user ON user_memberships (user)',
        'CREATE INDEX idx_user_membership_status ON user_memberships (status)',
      ],
    })
    app.save(membershipsCol)

    // 2. Migrar dados existentes de users (que possuem tenant) para user_memberships
    const allUsers = app.findRecordsByFilter('users', '', 'created', 0, 0)
    for (var i = 0; i < allUsers.length; i++) {
      const u = allUsers[i]
      const tenantId = u.getString('tenant')
      const role = u.getString('role')
      const userStatus = u.getString('status') || 'ativo'

      if (tenantId && tenantId.trim() !== '') {
        // Criar vínculo de membership ativo
        const membershipRole = role === 'superadmin' ? 'admin' : role || 'servidor'
        const membershipStatus = userStatus === 'ativo' ? 'ativo' : 'inativo'

        try {
          // Verificar se já existe vínculo
          const existing = app.findRecordsByFilter(
            'user_memberships',
            "user = '" + u.id + "' && tenant = '" + tenantId + "'",
            '',
            1,
            0,
          )
          if (existing.length === 0) {
            const memRecord = new Record(membershipsCol)
            memRecord.set('user', u.id)
            memRecord.set('tenant', tenantId)
            memRecord.set('role', membershipRole)
            memRecord.set('status', membershipStatus)
            app.save(memRecord)
          }
        } catch (err) {
          console.log('Erro ao migrar usuário para user_memberships: ' + u.id, err)
        }
      }
    }

    // 3. Atualizar regras de users para que qualquer usuário autenticado ou público possa verificar/criar conforme fluxo
    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = '' // Permitir auto-cadastro público e criação via backend/admin
    usersCol.updateRule = "@request.auth.id != ''"
    usersCol.deleteRule = "@request.auth.id != ''"
    app.save(usersCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('user_memberships')
      app.delete(col)
    } catch (_) {}
  },
)
