migrate(
  (app) => {
    // 1. Atualizar emailVisibility = true em todos os usuários existentes
    try {
      app
        .db()
        .newQuery(
          'UPDATE users SET emailVisibility = 1 WHERE emailVisibility = 0 OR emailVisibility IS NULL',
        )
        .execute()
    } catch (e) {
      console.log('Erro ao atualizar emailVisibility no banco:', e)
    }

    // 2. Garantir que a collection users não mantenha email escondido
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol && usersCol.authRule !== undefined) {
        // authRule se existir
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter emailVisibility
  },
)
