migrate(
  (app) => {
    const tenants = app.findCollectionByNameOrId('tenants')
    const collection = new Collection({
      name: 'document_templates',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      viewRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      createRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      updateRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      deleteRule:
        "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'content', type: 'text', required: false },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Minuta', 'Ofício', 'Parecer', 'Declaração', 'Outro'],
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenants.id,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_document_templates_tenant ON document_templates (tenant)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('document_templates')
      app.delete(col)
    } catch (_) {}
  },
)
