migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const col = app.findCollectionByNameOrId('bot_api_keys')

    // 1. Adicionar campo 'user' (relation -> users)
    if (!col.fields.getByName('user')) {
      col.fields.add(
        new RelationField({
          name: 'user',
          type: 'relation',
          required: false,
          collectionId: usersId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }

    // 2. Adicionar campo 'role_snapshot' (select)
    if (!col.fields.getByName('role_snapshot')) {
      col.fields.add(
        new SelectField({
          name: 'role_snapshot',
          type: 'select',
          required: false,
          values: ['superadmin', 'admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        }),
      )
    }

    // 3. Atualizar regras de acesso para permitir que o usuário veja e gerencie suas próprias chaves,
    // além de admins do tenant e superadmins
    col.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    col.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    col.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
    col.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    col.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || user = @request.auth.id || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"

    // 4. Adicionar índice em user se não existir
    try {
      col.addIndex('idx_bot_api_keys_user', false, 'user', '')
    } catch (_) {}

    app.save(col)

    // 5. Backfill de chaves existentes que possam ter created_by mas não user
    try {
      app
        .db()
        .newQuery("UPDATE bot_api_keys SET user = created_by WHERE user IS NULL OR user = ''")
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bot_api_keys')
      if (col.fields.getByName('user')) {
        col.fields.removeByName('user')
      }
      if (col.fields.getByName('role_snapshot')) {
        col.fields.removeByName('role_snapshot')
      }
      try {
        col.removeIndex('idx_bot_api_keys_user')
      } catch (_) {}
      app.save(col)
    } catch (_) {}
  },
)
