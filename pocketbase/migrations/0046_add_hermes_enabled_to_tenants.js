migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('tenants')

    if (!col.fields.getByName('hermes_enabled')) {
      col.fields.add(
        new BoolField({
          name: 'hermes_enabled',
          type: 'bool',
          required: false,
        }),
      )
      app.save(col)
    }

    // Garantir que todos os tenants existentes comecem com hermes_enabled desativado (false / 0)
    try {
      app
        .db()
        .newQuery(
          'UPDATE tenants SET hermes_enabled = false WHERE hermes_enabled IS NULL OR hermes_enabled = 1',
        )
        .execute()
    } catch (_) {
      try {
        app.db().newQuery('UPDATE tenants SET hermes_enabled = 0').execute()
      } catch (_) {}
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('tenants')
      if (col.fields.getByName('hermes_enabled')) {
        col.fields.removeByName('hermes_enabled')
        app.save(col)
      }
    } catch (_) {}
  },
)
