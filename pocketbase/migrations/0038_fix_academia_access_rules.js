migrate(
  (app) => {
    // Atualizar secretarias com regras RLS estritas
    const secCol = app.findCollectionByNameOrId('secretarias')
    secCol.listRule =
      "@request.auth.id != '' && ((@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant))"
    secCol.viewRule =
      "@request.auth.id != '' && ((@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant))"
    secCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    secCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    secCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    app.save(secCol)

    // Atualizar education_groups com regras RLS estritas
    const eduGrpCol = app.findCollectionByNameOrId('education_groups')
    eduGrpCol.listRule =
      "@request.auth.id != '' && ((@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant) || (@collection.education_group_members.group ?= id && @collection.education_group_members.user ?= @request.auth.id && @collection.education_group_members.status ?= 'ativo'))"
    eduGrpCol.viewRule =
      "@request.auth.id != '' && ((@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant) || (@collection.education_group_members.group ?= id && @collection.education_group_members.user ?= @request.auth.id && @collection.education_group_members.status ?= 'ativo'))"
    eduGrpCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    eduGrpCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    eduGrpCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    app.save(eduGrpCol)

    // Atualizar education_group_members com regras RLS estritas
    const eduMemCol = app.findCollectionByNameOrId('education_group_members')
    eduMemCol.listRule =
      "@request.auth.id != '' && (user = @request.auth.id || (@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant))"
    eduMemCol.viewRule =
      "@request.auth.id != '' && (user = @request.auth.id || (@request.auth.role = 'admin' && @request.auth.tenant != '' && tenant = @request.auth.tenant) || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo') || (@request.auth.role = 'superadmin' && @request.query.tenant != '' && tenant = @request.query.tenant))"
    eduMemCol.createRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    eduMemCol.updateRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    eduMemCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
    app.save(eduMemCol)
  },
  (app) => {
    // Reverter para regras anteriores se necessário
    try {
      const secCol = app.findCollectionByNameOrId('secretarias')
      secCol.listRule =
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
      secCol.viewRule =
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
      app.save(secCol)
    } catch (_) {}

    try {
      const eduGrpCol = app.findCollectionByNameOrId('education_groups')
      eduGrpCol.listRule =
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
      eduGrpCol.viewRule =
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
      app.save(eduGrpCol)
    } catch (_) {}

    try {
      const eduMemCol = app.findCollectionByNameOrId('education_group_members')
      eduMemCol.listRule =
        "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
      eduMemCol.viewRule =
        "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
      app.save(eduMemCol)
    } catch (_) {}
  },
)
