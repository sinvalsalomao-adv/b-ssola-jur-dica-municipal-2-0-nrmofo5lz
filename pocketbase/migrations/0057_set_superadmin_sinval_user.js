migrate(
  (app) => {
    // 1. Ajustar temporariamente o campo password da coleção users para permitir min: 6
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const pwdField = usersCol.fields.getByName('password')
    if (pwdField) {
      pwdField.min = 6
      app.save(usersCol)
    }

    const targetEmail = 'sinvalsalomao@gmail.com'
    const targetName = 'Sinval Salomão Alves de Medeiros'
    const targetPassword = '123456'

    let user = null
    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
    } catch (_) {}

    if (!user) {
      try {
        user = app.findFirstRecordByData('users', 'email', targetEmail)
      } catch (_) {}
    }

    if (!user) {
      user = new Record(usersCol)
      user.setEmail(targetEmail)
      user.setPassword(targetPassword)
      user.setVerified(true)
      user.set('name', targetName)
      user.set('role', 'superadmin')
      user.set('status', 'ativo')
      user.set('tenant', '')
      user.set('emailVisibility', true)
      app.save(user)
    } else {
      user.setEmail(targetEmail)
      user.setPassword(targetPassword)
      user.setVerified(true)
      user.set('name', targetName)
      user.set('role', 'superadmin')
      user.set('status', 'ativo')
      user.set('tenant', '')
      user.set('emailVisibility', true)
      app.save(user)
    }
  },
  (app) => {
    // Reversão defensiva
  },
)
