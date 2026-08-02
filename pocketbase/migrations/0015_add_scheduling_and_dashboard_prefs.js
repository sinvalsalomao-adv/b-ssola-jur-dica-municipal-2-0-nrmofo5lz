migrate(
  (app) => {
    const notifCol = app.findCollectionByNameOrId('notifications')

    if (!notifCol.fields.getByName('scheduled_for')) {
      notifCol.fields.add(new DateField({ name: 'scheduled_for' }))
    }
    if (!notifCol.fields.getByName('delivery_status')) {
      notifCol.fields.add(
        new SelectField({ name: 'delivery_status', values: ['enviada', 'agendada', 'cancelada'] }),
      )
    }
    if (!notifCol.fields.getByName('delivered_at')) {
      notifCol.fields.add(new DateField({ name: 'delivered_at' }))
    }
    app.save(notifCol)

    app
      .db()
      .newQuery(
        "UPDATE notifications SET delivery_status = 'enviada' WHERE delivery_status IS NULL OR delivery_status = ''",
      )
      .execute()

    const tenantsId = app.findCollectionByNameOrId('tenants').id
    const dashCol = new Collection({
      name: 'dashboard_preferences',
      type: 'base',
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        { name: 'tenant', type: 'relation', required: true, collectionId: tenantsId, maxSelect: 1 },
        { name: 'config', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_dashboard_pref_user ON dashboard_preferences (user)'],
    })
    app.save(dashCol)
  },
  (app) => {
    const dashCol = app.findCollectionByNameOrId('dashboard_preferences')
    app.delete(dashCol)
  },
)
