migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('bot_api_keys')

    // 1. Atualizar regras de acesso da coleção bot_api_keys:
    // Apenas superadmin pode listar, ver, criar, atualizar e deletar chaves
    col.listRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    col.viewRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    col.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    col.updateRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    col.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"

    app.save(col)

    // 2. Revogar qualquer chave anterior pessoal que possa existir (embora nenhuma tenha sido gerada)
    try {
      app
        .db()
        .newQuery("UPDATE bot_api_keys SET status = 'revogada' WHERE status != 'revogada'")
        .execute()
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('bot_api_keys')
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
      app.save(col)
    } catch (_) {}
  },
)
