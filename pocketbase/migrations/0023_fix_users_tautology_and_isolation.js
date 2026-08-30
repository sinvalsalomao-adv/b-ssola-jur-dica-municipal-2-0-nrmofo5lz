migrate(
  (app) => {
    // 1. Atualizar regras de user_memberships
    // - Superadmin: acesso irrestrito global (list/view/create/update/delete)
    // - Usuário autenticado: pode ler seus próprios vínculos (user = @request.auth.id)
    // - Admin do município: pode listar/ver/criar/atualizar/excluir vínculos no município onde é admin ativo
    // - Servidor / Pendente / Inativo: sem permissão de criar, atualizar ou excluir outros
    const memCol = app.findCollectionByNameOrId('user_memberships')

    memCol.listRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'user = @request.auth.id || (' +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    memCol.viewRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || " +
      'user = @request.auth.id || (' +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    memCol.createRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || (" +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= @request.body.tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

    memCol.updateRule =
      "@request.auth.id != '' && (" +
      "@request.auth.role = 'superadmin' || (" +
      '@collection.user_memberships.user ?= @request.auth.id && ' +
      '@collection.user_memberships.tenant ?= tenant && ' +
      "@collection.user_memberships.role ?= 'admin' && " +
      "@collection.user_memberships.status ?= 'ativo'" +
      '))'

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
    // Correção do achado Crítico: remoção total da tautologia.
    // Regra estrita de isolamento de PII:
    // - list / view: apenas superadmin e o próprio usuário autenticado (id = @request.auth.id)
    //   (Admins locais listam usuários do seu município via user_memberships expandindo user e tenant)
    // - create: apenas superadmin (criação por admin local é feita via endpoint seguro de backend)
    // - update: superadmin ou o próprio usuário (com proteção de campos em user_security_guard.js)
    // - delete: apenas superadmin
    const usersCol = app.findCollectionByNameOrId('users')

    usersCol.listRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)"
    usersCol.viewRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)"
    usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    usersCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || id = @request.auth.id)"
    usersCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"

    app.save(usersCol)
  },
  (app) => {
    // Reverter para as regras da migration 0022 se necessário
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
    usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    usersCol.updateRule = "@request.auth.id != ''"
    usersCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    app.save(usersCol)
  },
)
