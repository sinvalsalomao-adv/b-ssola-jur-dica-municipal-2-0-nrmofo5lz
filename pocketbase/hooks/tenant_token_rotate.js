// Route: POST /backend/v1/tenant-users/rotate-own-token
// Dedicated Authenticated Endpoint for User to Invalidate Residual Sessions (Token Rotation)
// Strictly invalidates caller's tokenKey or specified ephemeral user if superadmin.

routerAdd(
  'POST',
  '/backend/v1/tenant-users/rotate-own-token',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const targetUserId = String(body.userId || authId).trim()

    if (targetUserId !== authId && authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        message: 'Você só pode rotacionar as sessões do seu próprio usuário.',
      })
    }

    let targetUser = null
    try {
      targetUser = $app.findFirstRecordByData('users', 'id', targetUserId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Usuário não encontrado.' })
    }

    if (typeof targetUser.refreshTokenKey === 'function') {
      targetUser.refreshTokenKey()
    } else {
      targetUser.set('tokenKey:autogenerate', '')
    }

    try {
      $app.save(targetUser)
      return e.json(200, {
        success: true,
        message: 'Sessões anteriores invalidadas com sucesso.',
      })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao rotacionar tokenKey.' })
    }
  },
  $apis.requireAuth(),
)
