migrate(
  (app) => {
    const tid = app.findCollectionByNameOrId('tenants').id
    const pid = app.findCollectionByNameOrId('projects').id
    const uid = '_pb_users_auth_'

    const rule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    // 1. Criar coleção project_participants
    const participantsCol = new Collection({
      name: 'project_participants',
      type: 'base',
      listRule: rule,
      viewRule: rule,
      createRule: rule,
      updateRule: rule,
      deleteRule: rule,
      fields: [
        {
          name: 'project_id',
          type: 'relation',
          collectionId: pid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'tenant',
          type: 'relation',
          collectionId: tid,
          maxSelect: 1,
          required: true,
        },
        { name: 'added_by', type: 'relation', collectionId: uid, maxSelect: 1 },
        { name: 'role', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_proj_part_project ON project_participants (project_id)',
        'CREATE INDEX idx_proj_part_user ON project_participants (user_id)',
        'CREATE INDEX idx_proj_part_tenant ON project_participants (tenant)',
        'CREATE UNIQUE INDEX idx_proj_part_unique ON project_participants (project_id, user_id)',
      ],
    })
    app.save(participantsCol)

    // 2. Criar coleção project_comments
    const commentsCol = new Collection({
      name: 'project_comments',
      type: 'base',
      listRule: rule,
      viewRule: rule,
      createRule: rule,
      updateRule: rule,
      deleteRule: rule,
      fields: [
        {
          name: 'project_id',
          type: 'relation',
          collectionId: pid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'author_name',
          type: 'text',
        },
        {
          name: 'content',
          type: 'text',
          required: true,
        },
        {
          name: 'parent_id',
          type: 'text',
        },
        {
          name: 'is_edited',
          type: 'bool',
        },
        {
          name: 'edited_at',
          type: 'date',
        },
        {
          name: 'deleted',
          type: 'bool',
        },
        {
          name: 'deleted_at',
          type: 'date',
        },
        {
          name: 'deleted_by',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
        },
        {
          name: 'tenant',
          type: 'relation',
          collectionId: tid,
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_proj_comm_project ON project_comments (project_id)',
        'CREATE INDEX idx_proj_comm_user ON project_comments (user_id)',
        'CREATE INDEX idx_proj_comm_parent ON project_comments (parent_id)',
        'CREATE INDEX idx_proj_comm_deleted ON project_comments (deleted)',
        'CREATE INDEX idx_proj_comm_tenant ON project_comments (tenant)',
      ],
    })
    app.save(commentsCol)

    const cid = app.findCollectionByNameOrId('project_comments').id

    // 3. Criar coleção comment_mentions
    const mentionsCol = new Collection({
      name: 'comment_mentions',
      type: 'base',
      listRule: rule,
      viewRule: rule,
      createRule: rule,
      updateRule: rule,
      deleteRule: rule,
      fields: [
        {
          name: 'comment_id',
          type: 'relation',
          collectionId: cid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'project_id',
          type: 'relation',
          collectionId: pid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'mentioned_user_id',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'author_id',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
          required: true,
          cascadeDelete: false,
        },
        {
          name: 'tenant',
          type: 'relation',
          collectionId: tid,
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_mentions_comment ON comment_mentions (comment_id)',
        'CREATE INDEX idx_mentions_project ON comment_mentions (project_id)',
        'CREATE INDEX idx_mentions_user ON comment_mentions (mentioned_user_id)',
        'CREATE INDEX idx_mentions_tenant ON comment_mentions (tenant)',
      ],
    })
    app.save(mentionsCol)

    // 4. Atualizar audit_logs para permitir novas ações de comentários e participantes
    const auditCol = app.findCollectionByNameOrId('audit_logs')
    auditCol.fields.add(
      new SelectField({
        name: 'action_type',
        values: [
          'Criou card',
          'Moveu card',
          'Editou card',
          'Adicionou documento',
          'Nova versão documento',
          'Arquivou documento',
          'Restaurou documento',
          'Visualizou documento',
          'Baixou documento',
          'Adicionou participante',
          'Removeu participante',
          'Criou comentário',
          'Editou comentário',
          'Removeu comentário',
          'Criou resposta',
          'Editou resposta',
          'Removeu resposta',
          'Mencionou usuário',
        ],
        maxSelect: 1,
      }),
    )
    app.save(auditCol)

    // 5. Atualizar notifications para permitir tipo 'Mencao'
    const notifCol = app.findCollectionByNameOrId('notifications')
    notifCol.fields.add(
      new SelectField({
        name: 'tipo',
        values: ['Gargalo', 'Prazo Fatal', 'Aviso Interno', 'Mencao'],
        maxSelect: 1,
      }),
    )
    if (!notifCol.fields.getByName('target_user')) {
      notifCol.fields.add(
        new RelationField({
          name: 'target_user',
          collectionId: uid,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    app.save(notifCol)
  },
  (app) => {
    ;['comment_mentions', 'project_comments', 'project_participants'].forEach(function (n) {
      try {
        app.delete(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
  },
)
