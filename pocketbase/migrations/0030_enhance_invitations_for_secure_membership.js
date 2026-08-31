migrate(
  (app) => {
    const invCol = app.findCollectionByNameOrId('invitations')

    // 1. Atualizar select de status caso necessário (adicionar accepted, rejected, expired, cancelled)
    // Para select fields existentes, podemos atualizar os values permitidos
    const statusField = invCol.fields.getByName('status')
    if (statusField) {
      statusField.values = ['pending', 'activated', 'accepted', 'rejected', 'expired', 'cancelled']
    }

    const roleField = invCol.fields.getByName('role')
    if (roleField) {
      roleField.values = ['admin', 'servidor', 'gestor', 'secretario', 'procurador']
    }

    // 2. Adicionar token_hash (text)
    if (!invCol.fields.getByName('token_hash')) {
      invCol.fields.add(
        new TextField({
          name: 'token_hash',
          required: false,
        }),
      )
    }

    // 3. Adicionar expires_at (date)
    if (!invCol.fields.getByName('expires_at')) {
      invCol.fields.add(
        new DateField({
          name: 'expires_at',
          required: false,
        }),
      )
    }

    // 4. Adicionar used_at (date)
    if (!invCol.fields.getByName('used_at')) {
      invCol.fields.add(
        new DateField({
          name: 'used_at',
          required: false,
        }),
      )
    }

    // 5. Adicionar user relation (opcional, apontando para o destinatário quando conhecido)
    if (!invCol.fields.getByName('user')) {
      invCol.fields.add(
        new RelationField({
          name: 'user',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // 6. Adicionar rate_limit_hash (text) para busca/rate limiting seguro
    if (!invCol.fields.getByName('rate_limit_hash')) {
      invCol.fields.add(
        new TextField({
          name: 'rate_limit_hash',
          required: false,
        }),
      )
    }

    // RLS fechada: superadmin ou admin do tenant (list/view/delete), update controlado
    const tid = app.findCollectionByNameOrId('tenants').id
    const rule =
      "@request.auth.id != '' && (@request.auth.role = 'superadmin' || (@collection.user_memberships.user ?= @request.auth.id && @collection.user_memberships.tenant ?= tenant && @collection.user_memberships.role ?= 'admin' && @collection.user_memberships.status ?= 'ativo'))"

    invCol.listRule = rule
    invCol.viewRule = rule
    invCol.createRule = rule
    invCol.updateRule = rule
    invCol.deleteRule = rule

    // Índices adicionais
    invCol.addIndex('idx_invitations_token_hash', false, 'token_hash', '')
    invCol.addIndex('idx_invitations_email', false, 'email', '')
    invCol.addIndex('idx_invitations_status', false, 'status', '')
    invCol.addIndex('idx_invitations_rate_limit_hash', false, 'rate_limit_hash', '')

    app.save(invCol)
  },
  (app) => {
    // Reversão segura se necessário
  },
)
