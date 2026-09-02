migrate(
  (app) => {
    // Helper idempotente para carregar coleção por múltiplos casings
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

    // 1. Atualizar secretarias com regras RLS estritas (load and mutate)
    const secCol = findCol('secretarias', 'Secretarias')
    if (secCol) {
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
    }

    // 2. Atualizar education_groups com regras RLS estritas (load and mutate)
    const eduGrpCol = findCol('education_groups', 'Education_groups')
    if (eduGrpCol) {
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
    }

    // 3. Atualizar education_group_members com regras RLS estritas (load and mutate)
    const eduMemCol = findCol('education_group_members', 'Education_group_members')
    if (eduMemCol) {
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
    }
  },
  (app) => {
    // Reverter para regras anteriores se necessário
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

    try {
      const secCol = findCol('secretarias', 'Secretarias')
      if (secCol) {
        secCol.listRule =
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
        secCol.viewRule =
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
        app.save(secCol)
      }
    } catch (_) {}

    try {
      const eduGrpCol = findCol('education_groups', 'Education_groups')
      if (eduGrpCol) {
        eduGrpCol.listRule =
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
        eduGrpCol.viewRule =
          "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.status ?= 'ativo'))"
        app.save(eduGrpCol)
      }
    } catch (_) {}

    try {
      const eduMemCol = findCol('education_group_members', 'Education_group_members')
      if (eduMemCol) {
        eduMemCol.listRule =
          "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
        eduMemCol.viewRule =
          "@request.auth.id != '' && (user = @request.auth.id || tenant = @request.auth.tenant || @request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"
        app.save(eduMemCol)
      }
    } catch (_) {}
  },
)
