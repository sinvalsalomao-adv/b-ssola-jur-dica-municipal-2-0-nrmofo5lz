migrate(
  (app) => {
    var tid = app.findCollectionByNameOrId('tenants').id
    var usersId = '_pb_users_auth_'
    var tenantRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"
    var authRule = "@request.auth.id != ''"
    var ownerRule = "@request.auth.id != '' && usuario_id = @request.auth.id"

    // frases_salvas
    app.save(
      new Collection({
        name: 'frases_salvas',
        type: 'base',
        listRule: tenantRule,
        viewRule: tenantRule,
        createRule: tenantRule,
        updateRule: tenantRule,
        deleteRule: tenantRule,
        fields: [
          { name: 'texto', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            values: ['objeto', 'descricao'],
            maxSelect: 1,
            required: true,
          },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'contador_uso', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_frases_salvas_tenant ON frases_salvas (tenant)',
          'CREATE INDEX idx_frases_salvas_tipo ON frases_salvas (tipo)',
        ],
      }),
    )

    // trilhas
    app.save(
      new Collection({
        name: 'trilhas',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        fields: [
          { name: 'titulo', type: 'text', required: true },
          { name: 'descricao', type: 'text', required: true },
          { name: 'ordem', type: 'number', onlyInt: true, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_trilhas_ordem ON trilhas (ordem)'],
      }),
    )

    // aulas
    var trilhasId = app.findCollectionByNameOrId('trilhas').id
    app.save(
      new Collection({
        name: 'aulas',
        type: 'base',
        listRule: authRule,
        viewRule: authRule,
        createRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        fields: [
          {
            name: 'trilha_id',
            type: 'relation',
            collectionId: trilhasId,
            maxSelect: 1,
            required: true,
            cascadeDelete: true,
          },
          { name: 'titulo', type: 'text', required: true },
          { name: 'url_video', type: 'url', required: true },
          { name: 'ordem', type: 'number', onlyInt: true, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_aulas_trilha_id ON aulas (trilha_id)',
          'CREATE INDEX idx_aulas_ordem ON aulas (ordem)',
        ],
      }),
    )

    // progresso_usuario
    var aulasId = app.findCollectionByNameOrId('aulas').id
    app.save(
      new Collection({
        name: 'progresso_usuario',
        type: 'base',
        listRule: ownerRule,
        viewRule: ownerRule,
        createRule: authRule,
        updateRule: ownerRule,
        deleteRule: ownerRule,
        fields: [
          {
            name: 'usuario_id',
            type: 'relation',
            collectionId: usersId,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'trilha_id',
            type: 'relation',
            collectionId: trilhasId,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'aula_id',
            type: 'relation',
            collectionId: aulasId,
            maxSelect: 1,
            required: true,
          },
          { name: 'concluido', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_progresso_usuario_id ON progresso_usuario (usuario_id)',
          'CREATE INDEX idx_progresso_trilha_id ON progresso_usuario (trilha_id)',
          'CREATE INDEX idx_progresso_aula_id ON progresso_usuario (aula_id)',
          'CREATE UNIQUE INDEX idx_progresso_usuario_aula ON progresso_usuario (usuario_id, aula_id)',
        ],
      }),
    )

    // quiz_respostas
    app.save(
      new Collection({
        name: 'quiz_respostas',
        type: 'base',
        listRule: ownerRule,
        viewRule: ownerRule,
        createRule: authRule,
        updateRule: ownerRule,
        deleteRule: ownerRule,
        fields: [
          {
            name: 'usuario_id',
            type: 'relation',
            collectionId: usersId,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'trilha_id',
            type: 'relation',
            collectionId: trilhasId,
            maxSelect: 1,
            required: true,
          },
          { name: 'acertos', type: 'number', onlyInt: true, required: true },
          { name: 'total', type: 'number', onlyInt: true, required: true },
          { name: 'aprovado', type: 'bool' },
          { name: 'data', type: 'date', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_quiz_respostas_usuario_id ON quiz_respostas (usuario_id)',
          'CREATE INDEX idx_quiz_respostas_trilha_id ON quiz_respostas (trilha_id)',
          'CREATE INDEX idx_quiz_respostas_data ON quiz_respostas (data)',
        ],
      }),
    )
  },
  (app) => {
    var names = ['frases_salvas', 'trilhas', 'aulas', 'progresso_usuario', 'quiz_respostas']
    for (var i = 0; i < names.length; i++) {
      try {
        app.delete(app.findCollectionByNameOrId(names[i]))
      } catch (_) {}
    }
  },
)
