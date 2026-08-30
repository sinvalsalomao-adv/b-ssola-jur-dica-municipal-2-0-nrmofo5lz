migrate(
  (app) => {
    // 1. Atualizar regras de user_memberships
    // - Superadmin: acesso global (list/view/create/update/delete)
    // - Admin: pode listar/ver/criar/atualizar/excluir apenas vínculos do tenant onde possui vínculo ativo como admin
    // - Servidor: apenas leitura (list/view) dos próprios vínculos (user = @request.auth.id); nunca create/update/delete
    // - Usuário pendente/inativo/rejeitado: sem acesso de list/view para outros
    const memCol = app.findCollectionByNameOrId('user_memberships')

    // listRule e viewRule:
    // Superadmin: global
    // Próprio usuário: pode ver seus próprios registros (user = @request.auth.id)
    // Admin do município: pode ver registros onde tenant faz parte dos tenants onde ele é admin ativo
    memCol.listRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'user = @request.auth.id || ' +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      ')'

    memCol.viewRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'user = @request.auth.id || ' +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      ')'

    // createRule:
    // Superadmin: global
    // Admin: pode criar membership somente no seu próprio tenant onde é admin ativo
    // Servidor: NÃO pode criar membership diretamente (apenas via endpoint seguro ou por admin)
    memCol.createRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || (" +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= @request.body.tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    // updateRule:
    // Superadmin: global
    // Admin: pode atualizar membership somente no seu próprio tenant onde é admin ativo (não pode alterar a si próprio para se auto-escalar/desativar de forma inválida)
    // Servidor / Usuário comum: NUNCA atualiza membership
    memCol.updateRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || (" +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    // deleteRule:
    // Superadmin: global
    // Admin: pode excluir membership somente no seu próprio tenant onde é admin ativo
    // Servidor: NUNCA exclui membership
    memCol.deleteRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || (" +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    app.save(memCol)

    // 2. Atualizar regras de users
    // - list/view: Superadmin (global), próprio usuário (id = @request.auth.id), ou Admin com membership ativa compartilhada
    // - create: Superadmin apenas via REST direto (auto-cadastro é feito por endpoint seguro dedicado de backend)
    // - update: Superadmin (global), próprio usuário (apenas seus próprios dados protegidos por hook), ou Admin do mesmo tenant
    // - delete: Superadmin apenas
    const usersCol = app.findCollectionByNameOrId('users')

    usersCol.listRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'id = @request.auth.id || ' +
      '(@collection.user_memberships.user ?= @request.auth.id && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo' && " +
      '@collection.user_memberships.tenant ?= @collection.user_memberships.tenant && ' +
      '@collection.user_memberships.user ?= id)' +
      ')'

    usersCol.viewRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'id = @request.auth.id || ' +
      '(@collection.user_memberships.user ?= @request.auth.id && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo' && " +
      '@collection.user_memberships.tenant ?= @collection.user_memberships.tenant && ' +
      '@collection.user_memberships.user ?= id)' +
      ')'

    usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"

    usersCol.updateRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'id = @request.auth.id || ' +
      '(@collection.user_memberships.user ?= @request.auth.id && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo' && " +
      '@collection.user_memberships.tenant ?= @collection.user_memberships.tenant && ' +
      '@collection.user_memberships.user ?= id)' +
      ')'

    usersCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"

    app.save(usersCol)
  },
  (app) => {
    // Reverter para regras anteriores se necessário
    const memCol = app.findCollectionByNameOrId('user_memberships')
    memCol.listRule = "@request.auth.id != ''"
    memCol.viewRule = "@request.auth.id != ''"
    memCol.createRule = "@request.auth.id != ''"
    memCol.updateRule = "@request.auth.id != ''"
    memCol.deleteRule = "@request.auth.id != ''"
    app.save(memCol)

    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    usersCol.createRule = ''
    usersCol.updateRule = "@request.auth.id != ''"
    usersCol.deleteRule = "@request.auth.id != ''"
    app.save(usersCol)
  },
)
