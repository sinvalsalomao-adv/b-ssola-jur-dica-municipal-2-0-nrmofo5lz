migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('notifications')
    col.fields.add(
      new SelectField({
        name: 'tipo',
        required: false,
        values: ['Gargalo', 'Prazo Fatal', 'Aviso Interno'],
      }),
    )
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('notifications')
    col.fields.add(
      new SelectField({
        name: 'tipo',
        required: false,
        values: ['Gargalo', 'Prazo Fatal'],
      }),
    )
    app.save(col)
  },
)
