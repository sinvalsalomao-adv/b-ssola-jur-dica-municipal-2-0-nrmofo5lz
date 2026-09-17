migrate(
  (app) => {
    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const usersId = '_pb_users_auth_'

    // Coleção bot_api_keys: chaves de integração por município para bots como o Hermes
    const botApiKeysCol = new Collection({
      name: 'bot_api_keys',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      viewRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      createRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      updateRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))",
      fields: [
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'name', type: 'text', required: true },
        { name: 'key_hash', type: 'text', required: true },
        { name: 'key_prefix', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativa', 'revogada'],
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'last_used_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_bot_api_keys_tenant ON bot_api_keys (tenant)',
        'CREATE UNIQUE INDEX idx_bot_api_keys_hash ON bot_api_keys (key_hash)',
        'CREATE INDEX idx_bot_api_keys_status ON bot_api_keys (status)',
      ],
    })
    app.save(botApiKeysCol)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bot_api_keys')
      app.delete(col)
    } catch (_) {}
  },
)
