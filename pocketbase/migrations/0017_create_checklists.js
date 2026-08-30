migrate(
  (app) => {
    const tid = app.findCollectionByNameOrId('tenants').id
    const pid = app.findCollectionByNameOrId('projects').id
    const uid = '_pb_users_auth_'

    const rule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    // 1. Create checklists collection
    const checklistsCol = new Collection({
      name: 'checklists',
      type: 'base',
      listRule: rule,
      viewRule: rule,
      createRule: rule,
      updateRule: rule,
      deleteRule: rule,
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'projeto_id',
          type: 'relation',
          collectionId: pid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'tenant',
          type: 'relation',
          collectionId: tid,
          maxSelect: 1,
          required: true,
        },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_checklists_projeto ON checklists (projeto_id)',
        'CREATE INDEX idx_checklists_tenant ON checklists (tenant)',
      ],
    })
    app.save(checklistsCol)

    const clid = app.findCollectionByNameOrId('checklists').id

    // 2. Create checklist_items collection
    const checklistItemsCol = new Collection({
      name: 'checklist_items',
      type: 'base',
      listRule: rule,
      viewRule: rule,
      createRule: rule,
      updateRule: rule,
      deleteRule: rule,
      fields: [
        { name: 'texto', type: 'text', required: true },
        { name: 'concluido', type: 'bool' },
        {
          name: 'checklist_id',
          type: 'relation',
          collectionId: clid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'projeto_id',
          type: 'relation',
          collectionId: pid,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        {
          name: 'responsible_user',
          type: 'relation',
          collectionId: uid,
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date' },
        { name: 'ordem', type: 'number', onlyInt: true },
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
        'CREATE INDEX idx_checklist_items_checklist ON checklist_items (checklist_id)',
        'CREATE INDEX idx_checklist_items_projeto ON checklist_items (projeto_id)',
        'CREATE INDEX idx_checklist_items_tenant ON checklist_items (tenant)',
        'CREATE INDEX idx_checklist_items_responsible ON checklist_items (responsible_user)',
      ],
    })
    app.save(checklistItemsCol)
  },
  (app) => {
    ;['checklist_items', 'checklists'].forEach(function (n) {
      try {
        app.delete(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
  },
)
