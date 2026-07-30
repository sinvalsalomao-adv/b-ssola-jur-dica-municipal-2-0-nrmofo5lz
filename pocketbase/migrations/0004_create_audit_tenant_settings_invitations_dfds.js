migrate(
  (app) => {
    const tid = app.findCollectionByNameOrId('tenants').id
    const rule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    app.save(
      new Collection({
        name: 'audit_logs',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'superadmin'",
        fields: [
          { name: 'user_name', type: 'text' },
          {
            name: 'action_type',
            type: 'select',
            values: ['Criou card', 'Moveu card', 'Editou card'],
            maxSelect: 1,
          },
          { name: 'description', type: 'text' },
          { name: 'project_title', type: 'text' },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_audit_tenant ON audit_logs (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'tenant_settings',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'stall_limits', type: 'json' },
          { name: 'smtp_config', type: 'json' },
          { name: 'ai_api_key', type: 'text' },
          { name: 'proximity_days', type: 'number', onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_tenant_settings_tenant ON tenant_settings (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'invitations',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'text', required: true },
          { name: 'role', type: 'select', values: ['admin', 'servidor'], maxSelect: 1 },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'invited_by', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pending', 'activated', 'cancelled'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_invitations_tenant ON invitations (tenant)'],
      }),
    )

    app.save(
      new Collection({
        name: 'dfds',
        type: 'base',
        listRule: rule,
        viewRule: rule,
        createRule: rule,
        updateRule: rule,
        deleteRule: rule,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'objeto', type: 'text' },
          { name: 'descricao', type: 'text' },
          { name: 'justificativa', type: 'text' },
          { name: 'responsible', type: 'text' },
          { name: 'deadline', type: 'date' },
          { name: 'status', type: 'select', values: ['Rascunho', 'Finalizado'], maxSelect: 1 },
          { name: 'tenant', type: 'relation', collectionId: tid, maxSelect: 1, required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_dfds_tenant ON dfds (tenant)'],
      }),
    )
  },
  (app) => {
    ;['audit_logs', 'tenant_settings', 'invitations', 'dfds'].forEach(function (n) {
      try {
        app.delete(app.findCollectionByNameOrId(n))
      } catch (_) {}
    })
  },
)
