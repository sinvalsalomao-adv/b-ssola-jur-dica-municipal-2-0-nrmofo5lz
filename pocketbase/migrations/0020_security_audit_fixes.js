migrate(
  (app) => {
    // 1. Atualizar regras de users
    const usersCol = app.findCollectionByNameOrId('users')
    usersCol.listRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || tenant = @request.auth.tenant)"
    usersCol.viewRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || tenant = @request.auth.tenant)"
    usersCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    // Regra de update: superadmin pode atualizar; admin pode atualizar usuários do seu tenant (exceto superadmin); o próprio usuário pode atualizar apenas seus próprios dados (mas role é guardado no hook de segurança).
    usersCol.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))"
    usersCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))"
    app.save(usersCol)

    // 2. Atualizar regras de platform_settings (apenas superadmin)
    const psCol = app.findCollectionByNameOrId('platform_settings')
    psCol.listRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    psCol.viewRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    psCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    psCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    psCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    app.save(psCol)

    // 3. Atualizar regras de tenant_settings (admin do tenant ou superadmin)
    const tsCol = app.findCollectionByNameOrId('tenant_settings')
    tsCol.listRule =
      "@request.auth.id != '' && ((tenant = @request.auth.tenant && @request.auth.role = 'admin') || @request.auth.role = 'superadmin')"
    tsCol.viewRule =
      "@request.auth.id != '' && ((tenant = @request.auth.tenant && @request.auth.role = 'admin') || @request.auth.role = 'superadmin')"
    tsCol.createRule =
      "@request.auth.id != '' && ((tenant = @request.auth.tenant && @request.auth.role = 'admin') || @request.auth.role = 'superadmin')"
    tsCol.updateRule =
      "@request.auth.id != '' && ((tenant = @request.auth.tenant && @request.auth.role = 'admin') || @request.auth.role = 'superadmin')"
    tsCol.deleteRule =
      "@request.auth.id != '' && ((tenant = @request.auth.tenant && @request.auth.role = 'admin') || @request.auth.role = 'superadmin')"
    app.save(tsCol)

    // 4. Atualizar regras de audit_logs (createRule restrito ao tenant do usuário ou superadmin)
    const alCol = app.findCollectionByNameOrId('audit_logs')
    alCol.listRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    alCol.viewRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    alCol.createRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    alCol.updateRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    alCol.deleteRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    app.save(alCol)
  },
  (app) => {
    // Reverter regras se necessário
    const psCol = app.findCollectionByNameOrId('platform_settings')
    psCol.listRule = "@request.auth.id != ''"
    psCol.viewRule = "@request.auth.id != ''"
    app.save(psCol)

    const tsCol = app.findCollectionByNameOrId('tenant_settings')
    tsCol.listRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    tsCol.viewRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    app.save(tsCol)

    const alCol = app.findCollectionByNameOrId('audit_logs')
    alCol.createRule = "@request.auth.id != ''"
    app.save(alCol)
  },
)
