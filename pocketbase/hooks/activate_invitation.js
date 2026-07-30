routerAdd(
  'POST',
  '/backend/v1/invitations/activate',
  (e) => {
    const body = e.requestInfo().body || {}
    const invitationId = body.id

    if (!invitationId) return e.badRequestError('ID do convite é obrigatório')

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const inv = $app.findRecordById('invitations', invitationId)

    if (inv.getString('status') !== 'pending') {
      return e.badRequestError('Convite já processado')
    }

    const role = e.auth.getString('role')
    if (role === 'admin') {
      if (inv.getString('tenant') !== e.auth.getString('tenant')) {
        return e.forbiddenError('Você só pode ativar convites do seu tenant')
      }
    }

    try {
      $app.findAuthRecordByEmail('_pb_users_auth_', inv.getString('email'))
      return e.badRequestError('Email já cadastrado no sistema')
    } catch (_) {}

    const password = $security.randomString(12)
    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const user = new Record(usersCol)
    user.setEmail(inv.getString('email'))
    user.setPassword(password)
    user.setVerified(true)
    user.set('name', inv.getString('name'))
    user.set('role', inv.getString('role'))
    user.set('status', 'ativo')
    user.set('tenant', inv.getString('tenant'))
    $app.save(user)

    inv.set('status', 'activated')
    $app.save(inv)

    return e.json(200, {
      password: password,
      email: inv.getString('email'),
      name: inv.getString('name'),
    })
  },
  $apis.requireAuth(),
)
