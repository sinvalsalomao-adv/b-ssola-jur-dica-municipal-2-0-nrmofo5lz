migrate(
  (app) => {
    try {
      const tenant = app.findFirstRecordByData('tenants', 'id', '1e6lxk1tvyt27ok')
      tenant.set('hermes_allowed_roles', [
        'prefeito',
        'vice-prefeito',
        'secretario',
        'servidor',
        'admin',
      ])
      tenant.set('hermes_enabled', true)
      app.save(tenant)
    } catch (e) {
      // Fallback via SQL caso busca por registro falhe
      app
        .db()
        .newQuery(
          'UPDATE tenants SET hermes_allowed_roles = \'["prefeito","vice-prefeito","secretario","servidor","admin"]\', hermes_enabled = 1 WHERE id = \'1e6lxk1tvyt27ok\'',
        )
        .execute()
    }
  },
  (app) => {
    try {
      const tenant = app.findFirstRecordByData('tenants', 'id', '1e6lxk1tvyt27ok')
      tenant.set('hermes_allowed_roles', [])
      app.save(tenant)
    } catch (_) {}
  },
)
