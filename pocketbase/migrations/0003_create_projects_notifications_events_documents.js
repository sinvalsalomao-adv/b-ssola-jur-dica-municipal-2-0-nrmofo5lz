migrate(
  (app) => {
    const tid = app.findCollectionByNameOrId('tenants').id
    const cols = app.findCollectionByNameOrId('tenants').id
    const rule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    app.save(
      new Collection({
        name: 'projects',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'description', type: 'text' },
          { name: 'responsible', type: 'text' },
          { name: 'deadline', type: 'date' },
          { name: 'priority', type: 'select', values: ['Alta', 'Média', 'Baixa'], maxSelect: 1 },
          {
            name: 'column',
            type: 'select',
            values: [
              'Ideação',
              'Projeto Executivo',
              'Elaborar DFD',
              'Procedimentos Internos',
              'Execução',
              'Prestação de Contas',
              'Marketing',
            ],
            maxSelect: 1,
          },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_projects_tenant ON projects (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'notifications',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'project_title', type: 'text' },
          { name: 'column', type: 'text' },
          { name: 'days_stalled', type: 'number', onlyInt: true },
          { name: 'person_responsible', type: 'text' },
          { name: 'alert_date', type: 'date' },
          { name: 'alert_type', type: 'select', values: ['Gargalo', 'Prazo Fatal'], maxSelect: 1 },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_notifications_tenant ON notifications (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'agenda_events',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'day', type: 'date' },
          { name: 'card_title', type: 'text' },
          { name: 'card_id', type: 'text' },
          { name: 'color_code', type: 'select', values: ['green', 'yellow', 'red'], maxSelect: 1 },
          { name: 'responsible', type: 'text' },
          { name: 'column', type: 'text' },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_agenda_tenant ON agenda_events (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'documents',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'file_name', type: 'text' },
          { name: 'file_size', type: 'number', onlyInt: true },
          { name: 'project_name', type: 'text' },
          { name: 'upload_date', type: 'date' },
          { name: 'uploaded_by', type: 'text' },
          { name: 'pdf_url', type: 'url' },
          {
            name: 'file',
            type: 'file',
            maxSelect: 1,
            maxSize: 10485760,
            mimeTypes: ['application/pdf'],
          },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_documents_tenant ON documents (tenant)'],
      }),
    )
  },
  (app) => {
    ;['projects', 'notifications', 'agenda_events', 'documents'].forEach(function (n) {
      try {
        app.delete(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
  },
)
