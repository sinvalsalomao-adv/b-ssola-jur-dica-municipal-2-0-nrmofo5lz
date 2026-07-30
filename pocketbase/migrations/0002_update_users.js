migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    const tenantsId = app.findCollectionByNameOrId('tenants').id

    if (!col.fields.getByName('role')) {
      col.fields.add(
        new SelectField({
          name: 'role',
          values: ['superadmin', 'admin', 'servidor'],
          maxSelect: 1,
        }),
      )
    }
    if (!col.fields.getByName('tenant')) {
      col.fields.add(
        new RelationField({
          name: 'tenant',
          collectionId: tenantsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!col.fields.getByName('status')) {
      col.fields.add(
        new SelectField({ name: 'status', values: ['ativo', 'inativo'], maxSelect: 1 }),
      )
    }

    col.listRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || tenant = @request.auth.tenant)"
    col.viewRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || tenant = @request.auth.tenant)"
    col.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    col.updateRule =
      "@request.auth.id != '' && (id = @request.auth.id || @request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))"
    col.deleteRule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))"

    col.addIndex('idx_users_tenant', false, 'tenant', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('users')
    try {
      col.removeIndex('idx_users_tenant')
      app.save(col)
    } catch (_) {}
  },
)
