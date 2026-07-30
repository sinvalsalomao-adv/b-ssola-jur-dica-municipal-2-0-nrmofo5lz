migrate(
  (app) => {
    function hasField(col, name) {
      try {
        return !!col.fields.getByName(name)
      } catch (_) {
        return false
      }
    }

    function renameField(colName, oldName, newField) {
      var col = app.findCollectionByNameOrId(colName)
      if (!hasField(col, oldName)) return
      if (hasField(col, newField.name)) {
        app
          .db()
          .newQuery('UPDATE `' + colName + '` SET `' + newField.name + '` = `' + oldName + '`')
          .execute()
        col = app.findCollectionByNameOrId(colName)
        col.fields.removeByName(oldName)
        app.save(col)
        return
      }
      col.fields.add(newField)
      app.save(col)
      app
        .db()
        .newQuery('UPDATE `' + colName + '` SET `' + newField.name + '` = `' + oldName + '`')
        .execute()
      col = app.findCollectionByNameOrId(colName)
      col.fields.removeByName(oldName)
      app.save(col)
    }

    function removeField(colName, fieldName) {
      var col = app.findCollectionByNameOrId(colName)
      if (!hasField(col, fieldName)) return
      col.fields.removeByName(fieldName)
      app.save(col)
    }

    var KANBAN_COLUMNS = [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ]

    removeField('projects', 'responsible')
    renameField('projects', 'title', new TextField({ name: 'titulo', required: true }))
    renameField('projects', 'description', new TextField({ name: 'descricao' }))
    renameField('projects', 'deadline', new DateField({ name: 'prazo' }))
    renameField(
      'projects',
      'column',
      new SelectField({
        name: 'coluna_kanban',
        values: KANBAN_COLUMNS,
        maxSelect: 1,
      }),
    )

    removeField('dfds', 'responsible')
    renameField('dfds', 'title', new TextField({ name: 'titulo', required: true }))
    renameField('dfds', 'deadline', new DateField({ name: 'prazo' }))

    renameField(
      'notifications',
      'alert_type',
      new SelectField({
        name: 'tipo',
        values: ['Gargalo', 'Prazo Fatal'],
        maxSelect: 1,
      }),
    )

    renameField('documents', 'file_name', new TextField({ name: 'nome_arquivo' }))
    renameField('documents', 'pdf_url', new URLField({ name: 'url' }))
    renameField('documents', 'file_size', new NumberField({ name: 'tamanho', onlyInt: true }))
    renameField('documents', 'upload_date', new DateField({ name: 'upload_em' }))
    renameField('documents', 'uploaded_by', new TextField({ name: 'upload_por' }))
  },
  (app) => {
    function hasField(col, name) {
      try {
        return !!col.fields.getByName(name)
      } catch (_) {
        return false
      }
    }

    function renameField(colName, oldName, newField) {
      var col = app.findCollectionByNameOrId(colName)
      if (!hasField(col, oldName)) return
      if (hasField(col, newField.name)) {
        app
          .db()
          .newQuery('UPDATE `' + colName + '` SET `' + newField.name + '` = `' + oldName + '`')
          .execute()
        col = app.findCollectionByNameOrId(colName)
        col.fields.removeByName(oldName)
        app.save(col)
        return
      }
      col.fields.add(newField)
      app.save(col)
      app
        .db()
        .newQuery('UPDATE `' + colName + '` SET `' + newField.name + '` = `' + oldName + '`')
        .execute()
      col = app.findCollectionByNameOrId(colName)
      col.fields.removeByName(oldName)
      app.save(col)
    }

    function addField(colName, field) {
      var col = app.findCollectionByNameOrId(colName)
      if (!hasField(col, field.name)) {
        col.fields.add(field)
        app.save(col)
      }
    }

    var KANBAN_COLUMNS = [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ]

    renameField('projects', 'titulo', new TextField({ name: 'title', required: true }))
    renameField('projects', 'descricao', new TextField({ name: 'description' }))
    renameField('projects', 'prazo', new DateField({ name: 'deadline' }))
    renameField(
      'projects',
      'coluna_kanban',
      new SelectField({
        name: 'column',
        values: KANBAN_COLUMNS,
        maxSelect: 1,
      }),
    )
    addField('projects', new TextField({ name: 'responsible' }))

    renameField('dfds', 'titulo', new TextField({ name: 'title', required: true }))
    renameField('dfds', 'prazo', new DateField({ name: 'deadline' }))
    addField('dfds', new TextField({ name: 'responsible' }))

    renameField(
      'notifications',
      'tipo',
      new SelectField({
        name: 'alert_type',
        values: ['Gargalo', 'Prazo Fatal'],
        maxSelect: 1,
      }),
    )

    renameField('documents', 'nome_arquivo', new TextField({ name: 'file_name' }))
    renameField('documents', 'url', new URLField({ name: 'pdf_url' }))
    renameField('documents', 'tamanho', new NumberField({ name: 'file_size', onlyInt: true }))
    renameField('documents', 'upload_em', new DateField({ name: 'upload_date' }))
    renameField('documents', 'upload_por', new TextField({ name: 'uploaded_by' }))
  },
)
