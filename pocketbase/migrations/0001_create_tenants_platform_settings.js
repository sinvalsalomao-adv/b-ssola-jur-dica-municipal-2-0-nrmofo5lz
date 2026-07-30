migrate(
  (app) => {
    app.save(
      new Collection({
        name: 'tenants',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'cnpj', type: 'text' },
          { name: 'slug', type: 'text', required: true },
          {
            name: 'logo',
            type: 'file',
            maxSelect: 1,
            maxSize: 5242880,
            mimeTypes: ['image/jpeg', 'image/png'],
          },
          { name: 'admin_name', type: 'text' },
          { name: 'status', type: 'select', values: ['ativa', 'inativa'], maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_tenants_slug ON tenants (slug)'],
      }),
    )

    app.save(
      new Collection({
        name: 'platform_settings',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        fields: [
          { name: 'stall_limits', type: 'json' },
          { name: 'smtp_config', type: 'json' },
          { name: 'ai_api_key', type: 'text' },
          { name: 'proximity_days', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      }),
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('tenants'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('platform_settings'))
    } catch (_) {}
  },
)
