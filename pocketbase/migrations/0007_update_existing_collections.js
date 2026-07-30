migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const projectsId = app.findCollectionByNameOrId('projects').id

    // 1. Users - update role select with new options
    var usersCol = app.findCollectionByNameOrId('users')
    usersCol.fields.add(
      new SelectField({
        name: 'role',
        values: ['superadmin', 'admin', 'servidor', 'gestor', 'secretario', 'procurador'],
        maxSelect: 1,
      }),
    )
    app.save(usersCol)

    // 2. Projects - add objeto, justificativa, responsible_user
    var projectsCol = app.findCollectionByNameOrId('projects')
    if (!projectsCol.fields.getByName('objeto')) {
      projectsCol.fields.add(new TextField({ name: 'objeto' }))
    }
    if (!projectsCol.fields.getByName('justificativa')) {
      projectsCol.fields.add(new TextField({ name: 'justificativa' }))
    }
    if (!projectsCol.fields.getByName('responsible_user')) {
      projectsCol.fields.add(
        new RelationField({
          name: 'responsible_user',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    projectsCol.addIndex('idx_projects_responsible_user', false, 'responsible_user', '')
    app.save(projectsCol)

    // 3. DFDs - add projeto_id, responsible_user
    var dfdsCol = app.findCollectionByNameOrId('dfds')
    if (!dfdsCol.fields.getByName('projeto_id')) {
      dfdsCol.fields.add(
        new RelationField({
          name: 'projeto_id',
          collectionId: projectsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!dfdsCol.fields.getByName('responsible_user')) {
      dfdsCol.fields.add(
        new RelationField({
          name: 'responsible_user',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    dfdsCol.addIndex('idx_dfds_projeto_id', false, 'projeto_id', '')
    dfdsCol.addIndex('idx_dfds_responsible_user', false, 'responsible_user', '')
    app.save(dfdsCol)

    // 4. Notifications - add projeto_id, mensagem, enviada_em, lida
    var notifCol = app.findCollectionByNameOrId('notifications')
    if (!notifCol.fields.getByName('projeto_id')) {
      notifCol.fields.add(
        new RelationField({
          name: 'projeto_id',
          collectionId: projectsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!notifCol.fields.getByName('mensagem')) {
      notifCol.fields.add(new TextField({ name: 'mensagem' }))
    }
    if (!notifCol.fields.getByName('enviada_em')) {
      notifCol.fields.add(
        new AutodateField({ name: 'enviada_em', onCreate: true, onUpdate: false }),
      )
    }
    if (!notifCol.fields.getByName('lida')) {
      notifCol.fields.add(new BoolField({ name: 'lida' }))
    }
    notifCol.addIndex('idx_notifications_projeto_id', false, 'projeto_id', '')
    notifCol.addIndex('idx_notifications_lida', false, 'lida', '')
    app.save(notifCol)

    // 5. Documents - add projeto_id
    var docsCol = app.findCollectionByNameOrId('documents')
    if (!docsCol.fields.getByName('projeto_id')) {
      docsCol.fields.add(
        new RelationField({
          name: 'projeto_id',
          collectionId: projectsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    docsCol.addIndex('idx_documents_projeto_id', false, 'projeto_id', '')
    app.save(docsCol)
  },
  (app) => {
    var cols = ['projects', 'dfds', 'notifications', 'documents']
    for (var i = 0; i < cols.length; i++) {
      try {
        var col = app.findCollectionByNameOrId(cols[i])
        var idxNames = [
          'idx_projects_responsible_user',
          'idx_dfds_projeto_id',
          'idx_dfds_responsible_user',
          'idx_notifications_projeto_id',
          'idx_notifications_lida',
          'idx_documents_projeto_id',
        ]
        for (var j = 0; j < idxNames.length; j++) {
          try {
            col.removeIndex(idxNames[j])
          } catch (_) {}
        }
        app.save(col)
      } catch (_) {}
    }
  },
)
