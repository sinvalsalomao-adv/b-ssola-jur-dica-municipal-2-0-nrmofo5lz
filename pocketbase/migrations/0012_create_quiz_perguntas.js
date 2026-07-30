migrate(
  (app) => {
    var trilhasId = app.findCollectionByNameOrId('trilhas').id
    var authRule = "@request.auth.id != ''"
    var adminRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"

    app.save(
      new Collection({
        name: 'quiz_perguntas',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          {
            name: 'trilha_id',
            type: 'relation',
            collectionId: trilhasId,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'pergunta', type: 'text', required: true },
          { name: 'opcoes', type: 'json', required: true },
          { name: 'resposta_correta', type: 'text', required: true },
          { name: 'ordem', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_quiz_perguntas_trilha_id ON quiz_perguntas (trilha_id)'],
      }),
    )
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('quiz_perguntas'))
    } catch (_) {}
  },
)
