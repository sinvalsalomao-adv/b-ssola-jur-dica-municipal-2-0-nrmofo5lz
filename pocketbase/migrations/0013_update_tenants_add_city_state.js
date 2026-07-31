migrate(
  (app) => {
    var col = app.findCollectionByNameOrId('tenants')

    try {
      col.fields.getByName('cidade')
    } catch (_) {
      col.fields.add(new TextField({ name: 'cidade' }))
    }

    try {
      col.fields.getByName('estado')
    } catch (_) {
      col.fields.add(new TextField({ name: 'estado' }))
    }

    try {
      col.fields.removeByName('logo')
    } catch (_) {}
    col.fields.add(
      new FileField({
        name: 'logo',
        maxSelect: 1,
        maxSize: 2097152,
        mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml'],
      }),
    )

    app.save(col)
  },
  (app) => {
    var col = app.findCollectionByNameOrId('tenants')

    try {
      col.fields.removeByName('cidade')
    } catch (_) {}
    try {
      col.fields.removeByName('estado')
    } catch (_) {}

    try {
      col.fields.removeByName('logo')
    } catch (_) {}
    col.fields.add(
      new FileField({
        name: 'logo',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png'],
      }),
    )

    app.save(col)
  },
)
