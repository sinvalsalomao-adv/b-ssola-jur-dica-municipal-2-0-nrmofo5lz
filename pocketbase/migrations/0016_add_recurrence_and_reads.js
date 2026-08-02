migrate(
  (app) => {
    const notifCol = app.findCollectionByNameOrId('notifications')
    const notifColId = notifCol.id

    if (!notifCol.fields.getByName('recorrencia')) {
      notifCol.fields.add(
        new SelectField({
          name: 'recorrencia',
          required: false,
          values: ['nenhuma', 'diaria', 'semanal', 'mensal'],
        }),
      )
    }
    if (!notifCol.fields.getByName('dia_semana')) {
      notifCol.fields.add(
        new SelectField({
          name: 'dia_semana',
          required: false,
          values: ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'],
        }),
      )
    }
    if (!notifCol.fields.getByName('dia_mes')) {
      notifCol.fields.add(new NumberField({ name: 'dia_mes', min: 1, max: 31, onlyInt: true }))
    }
    if (!notifCol.fields.getByName('exige_confirmacao')) {
      notifCol.fields.add(new BoolField({ name: 'exige_confirmacao' }))
    }
    if (!notifCol.fields.getByName('modo_confirmacao')) {
      notifCol.fields.add(
        new SelectField({
          name: 'modo_confirmacao',
          required: false,
          values: ['leitura', 'video'],
        }),
      )
    }
    if (!notifCol.fields.getByName('video_url')) {
      notifCol.fields.add(new URLField({ name: 'video_url' }))
    }
    if (!notifCol.fields.getByName('recorrencia_ativa')) {
      notifCol.fields.add(new BoolField({ name: 'recorrencia_ativa' }))
    }
    if (!notifCol.fields.getByName('parent_notification')) {
      notifCol.fields.add(
        new RelationField({
          name: 'parent_notification',
          collectionId: notifColId,
          maxSelect: 1,
        }),
      )
    }
    app.save(notifCol)

    app
      .db()
      .newQuery(
        "UPDATE notifications SET recorrencia = 'nenhuma' WHERE recorrencia IS NULL OR recorrencia = ''",
      )
      .execute()
    app
      .db()
      .newQuery('UPDATE notifications SET recorrencia_ativa = 1 WHERE recorrencia_ativa IS NULL')
      .execute()
    app
      .db()
      .newQuery('UPDATE notifications SET exige_confirmacao = 0 WHERE exige_confirmacao IS NULL')
      .execute()

    const tenantsId = app.findCollectionByNameOrId('tenants').id

    const readsCol = new Collection({
      name: 'notification_reads',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))",
      viewRule:
        "@request.auth.id != '' && (user = @request.auth.id || @request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))",
      createRule: "@request.auth.id != '' && user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule:
        "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@request.auth.role = 'admin' && tenant = @request.auth.tenant))",
      fields: [
        {
          name: 'notification',
          type: 'relation',
          required: true,
          collectionId: notifColId,
          maxSelect: 1,
        },
        {
          name: 'user',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          required: true,
          collectionId: tenantsId,
          maxSelect: 1,
        },
        { name: 'read_at', type: 'date' },
        { name: 'confirmed_at', type: 'date' },
        { name: 'watched_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_notification_reads_notif_user ON notification_reads (notification, user)',
        'CREATE INDEX idx_notification_reads_tenant ON notification_reads (tenant)',
        'CREATE INDEX idx_notification_reads_user ON notification_reads (user)',
        'CREATE INDEX idx_notification_reads_notif ON notification_reads (notification)',
      ],
    })
    app.save(readsCol)
  },
  (app) => {
    try {
      const readsCol = app.findCollectionByNameOrId('notification_reads')
      app.delete(readsCol)
    } catch (_) {}
  },
)
