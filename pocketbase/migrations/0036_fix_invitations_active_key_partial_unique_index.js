migrate(
  (app) => {
    const invCol = app.findCollectionByNameOrId('invitations')

    // Substitui o índice antigo (se existir) por um índice único parcial WHERE active_key != ''
    try {
      invCol.removeIndex('idx_invitations_active_key')
    } catch (_) {}

    invCol.addIndex('idx_invitations_active_key', true, 'active_key', "active_key != ''")
    app.save(invCol)
  },
  (app) => {
    try {
      const invCol = app.findCollectionByNameOrId('invitations')
      invCol.removeIndex('idx_invitations_active_key')
      invCol.addIndex('idx_invitations_active_key', true, 'active_key', '')
      app.save(invCol)
    } catch (_) {}
  },
)
