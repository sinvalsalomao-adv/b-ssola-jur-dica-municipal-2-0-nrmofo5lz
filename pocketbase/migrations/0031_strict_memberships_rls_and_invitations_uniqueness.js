migrate(
  (app) => {
    // 1. R-1: Fechar regra create de user_memberships para superadmin apenas (ou null / superusers only)
    const memCol = app.findCollectionByNameOrId('user_memberships')
    memCol.createRule = "@request.auth.id != '' && @request.auth.role = 'superadmin'"
    // Preservar as regras de list, view, update, delete conforme já estabelecidas
    app.save(memCol)

    // 2. R-3: Adicionar recipient_hash e delivery_status na coleção invitations
    const invCol = app.findCollectionByNameOrId('invitations')

    if (!invCol.fields.getByName('recipient_hash')) {
      invCol.fields.add(
        new TextField({
          name: 'recipient_hash',
          required: false,
        }),
      )
    }

    if (!invCol.fields.getByName('active_key')) {
      invCol.fields.add(
        new TextField({
          name: 'active_key',
          required: false,
        }),
      )
    }

    if (!invCol.fields.getByName('delivery_status')) {
      invCol.fields.add(
        new SelectField({
          name: 'delivery_status',
          required: false,
          values: ['delivered', 'delivery_pending', 'delivery_failed', 'skipped'],
          maxSelect: 1,
        }),
      )
    }

    // Criar índice único para active_key para garantir unicidade estrita por tenant + recipient ativo
    invCol.addIndex('idx_invitations_recipient_hash', false, 'recipient_hash', '')
    invCol.addIndex('idx_invitations_active_key', true, 'active_key', '')

    app.save(invCol)
  },
  (app) => {
    // Reversão segura
  },
)
