migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    // 1. Coleção 'secretarias' (Unidades Organizacionais / Secretarias Municipais)
    const secretariasCol = new Collection({
      name: 'secretarias',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))",
      viewRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'sigla', type: 'text', required: false },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_secretarias_tenant ON secretarias (tenant)',
        'CREATE INDEX idx_secretarias_status ON secretarias (status)',
      ],
    })
    app.save(secretariasCol)

    const secretariasId = app.findCollectionByNameOrId('secretarias').id

    // 2. Coleção 'education_groups' (Grupos Educacionais da Academia)
    const educationGroupsCol = new Collection({
      name: 'education_groups',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))",
      viewRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text', required: false },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'secretaria',
          type: 'relation',
          required: false,
          collectionId: secretariasId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'cargos_alvo',
          type: 'json',
          required: false,
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_education_groups_tenant ON education_groups (tenant)',
        'CREATE INDEX idx_education_groups_secretaria ON education_groups (secretaria)',
        'CREATE INDEX idx_education_groups_status ON education_groups (status)',
      ],
    })
    app.save(educationGroupsCol)

    const educationGroupsId = app.findCollectionByNameOrId('education_groups').id

    // 3. Coleção 'education_group_members' (Associação Usuário <-> Grupo Educacional)
    const groupMembersCol = new Collection({
      name: 'education_group_members',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      viewRule:
        "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      fields: [
        {
          name: 'group',
          type: 'relation',
          required: true,
          collectionId: educationGroupsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
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
          name: 'added_by',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: false,
          values: ['ativo', 'inativo'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_edu_grp_mem_unique ON education_group_members (group, user)',
        'CREATE INDEX idx_edu_grp_mem_group ON education_group_members (group)',
        'CREATE INDEX idx_edu_grp_mem_user ON education_group_members (user)',
        'CREATE INDEX idx_edu_grp_mem_tenant ON education_group_members (tenant)',
      ],
    })
    app.save(groupMembersCol)

    // 4. Atualizar audit_logs action_type com novos tipos de auditoria educacional caso necessário
    const auditLogsCol = app.findCollectionByNameOrId('audit_logs')
    const actionTypeField = auditLogsCol.fields.getByName('action_type')
    if (actionTypeField && actionTypeField.values) {
      const neededTypes = [
        'Criou secretaria',
        'Editou secretaria',
        'Excluiu secretaria',
        'Criou grupo educacional',
        'Editou grupo educacional',
        'Excluiu grupo educacional',
        'Adicionou membro ao grupo',
        'Removeu membro do grupo',
      ]
      let changed = false
      const curValues = actionTypeField.values.slice()
      for (let j = 0; j < neededTypes.length; j++) {
        if (curValues.indexOf(neededTypes[j]) === -1) {
          curValues.push(neededTypes[j])
          changed = true
        }
      }
      if (changed) {
        actionTypeField.values = curValues
        app.save(auditLogsCol)
      }
    }
  },
  (app) => {
    // Helper para buscar por múltiplos casings
    const findCol = (name1, name2) => {
      try {
        return app.findCollectionByNameOrId(name1)
      } catch (_) {
        if (name2) {
          try {
            return app.findCollectionByNameOrId(name2)
          } catch (_) {}
        }
        return null
      }
    }

    // 1. Reverter exclusão de coleções na ordem correta de dependência
    try {
      const c1 = findCol('education_group_members', 'Education_group_members')
      if (c1) app.delete(c1)
    } catch (_) {}
    try {
      const c2 = findCol('education_groups', 'Education_groups')
      if (c2) app.delete(c2)
    } catch (_) {}
    try {
      const c3 = findCol('secretarias', 'Secretarias')
      if (c3) app.delete(c3)
    } catch (_) {}

    // 2. Reverter os 8 action_type adicionados a audit_logs, preservando os valores históricos anteriores
    try {
      const auditLogsCol = findCol('audit_logs', 'Audit_logs')
      if (auditLogsCol) {
        const actionTypeField = auditLogsCol.fields.getByName('action_type')
        if (actionTypeField && actionTypeField.values) {
          const addedTypes = [
            'Criou secretaria',
            'Editou secretaria',
            'Excluiu secretaria',
            'Criou grupo educacional',
            'Editou grupo educacional',
            'Excluiu grupo educacional',
            'Adicionou membro ao grupo',
            'Removeu membro do grupo',
          ]
          const filteredValues = actionTypeField.values.filter(
            (val) => addedTypes.indexOf(val) === -1,
          )
          if (filteredValues.length !== actionTypeField.values.length) {
            actionTypeField.values = filteredValues
            app.save(auditLogsCol)
          }
        }
      }
    } catch (_) {}
  },
)
