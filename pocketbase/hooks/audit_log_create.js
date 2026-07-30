routerAdd(
  'POST',
  '/backend/v1/audit-logs/create',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    let tenantId = e.auth.getString('tenant')
    if (!tenantId && body.tenant) {
      tenantId = body.tenant
    }
    if (!tenantId) return e.badRequestError('Tenant é obrigatório')

    const col = $app.findCollectionByNameOrId('audit_logs')
    const log = new Record(col)
    log.set('user_name', e.auth.getString('name') || body.user_name || 'Sistema')
    log.set('action_type', body.action_type || 'Editou card')
    log.set('description', body.description || '')
    log.set('project_title', body.project_title || '')
    log.set('tenant', tenantId)
    $app.save(log)

    return e.json(201, { id: log.id })
  },
  $apis.requireAuth(),
)
