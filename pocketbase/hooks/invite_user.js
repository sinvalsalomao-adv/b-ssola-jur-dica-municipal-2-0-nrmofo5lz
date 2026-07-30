routerAdd(
  'POST',
  '/backend/v1/invitations/create',
  (e) => {
    const body = e.requestInfo().body || {}

    if (!body.name || !body.name.trim()) return e.badRequestError('Nome é obrigatório')
    if (!body.email || !body.email.trim()) return e.badRequestError('Email é obrigatório')

    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const role = e.auth.getString('role')
    let tenantId = body.tenant || ''

    if (role === 'admin') {
      tenantId = e.auth.getString('tenant')
    } else if (role === 'superadmin') {
      if (!tenantId) return e.badRequestError('Tenant é obrigatório')
    } else {
      return e.forbiddenError('Apenas admin ou superadmin podem convidar')
    }

    const invCol = $app.findCollectionByNameOrId('invitations')
    const inv = new Record(invCol)
    inv.set('name', body.name.trim())
    inv.set('email', body.email.trim())
    inv.set('role', body.role || 'servidor')
    inv.set('tenant', tenantId)
    inv.set('invited_by', e.auth.getString('name'))
    inv.set('status', 'pending')
    $app.save(inv)

    return e.json(201, { id: inv.id, status: 'pending', message: 'Convite criado com sucesso' })
  },
  $apis.requireAuth(),
)
