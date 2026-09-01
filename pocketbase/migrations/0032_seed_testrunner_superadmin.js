migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = app.findCollectionByNameOrId('user_memberships')

    // Migration 0032 obsoleta / neutralizada em conformidade com política de segurança estrita:
    // Nenhuma credencial fixa ou conta efêmera é permitida no código executável.
  },
  (app) => {
    // No-op
  },
)
