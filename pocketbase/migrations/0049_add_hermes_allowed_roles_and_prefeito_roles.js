migrate(
  (app) => {
    // 1. Atualizar a coleção tenants com hermes_allowed_roles (campo JSON)
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    if (!tenantsCol.fields.getByName('hermes_allowed_roles')) {
      tenantsCol.fields.add(
        new JSONField({
          name: 'hermes_allowed_roles',
          required: false,
        }),
      )
      app.save(tenantsCol)
    }

    // Inicializar registros existentes como array vazio []
    try {
      app
        .db()
        .newQuery(
          "UPDATE tenants SET hermes_allowed_roles = '[]' WHERE hermes_allowed_roles IS NULL OR hermes_allowed_roles = ''",
        )
        .execute()
    } catch (_) {}

    // 2. Adicionar 'prefeito' e 'vice-prefeito' aos valores do campo select 'role' de user_memberships
    const membershipsCol = app.findCollectionByNameOrId('user_memberships')
    const roleField = membershipsCol.fields.getByName('role')
    if (roleField) {
      membershipsCol.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: [
            'admin',
            'servidor',
            'gestor',
            'secretario',
            'procurador',
            'prefeito',
            'vice-prefeito',
          ],
          maxSelect: 1,
        }),
      )
      app.save(membershipsCol)
    }
  },
  (app) => {
    try {
      const tenantsCol = app.findCollectionByNameOrId('tenants')
      if (tenantsCol.fields.getByName('hermes_allowed_roles')) {
        tenantsCol.fields.removeByName('hermes_allowed_roles')
        app.save(tenantsCol)
      }
    } catch (_) {}

    try {
      const membershipsCol = app.findCollectionByNameOrId('user_memberships')
      membershipsCol.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['admin', 'servidor', 'gestor', 'secretario', 'procurador'],
          maxSelect: 1,
        }),
      )
      app.save(membershipsCol)
    } catch (_) {}
  },
)
