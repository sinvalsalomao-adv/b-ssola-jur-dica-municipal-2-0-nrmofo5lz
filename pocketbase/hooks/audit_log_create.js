routerAdd(
  'POST',
  '/backend/v1/audit-logs/create',
  (e) => {
    const body = e.requestInfo().body || {}
    const userId = e.auth ? e.auth.id : ''
    if (!userId) return e.unauthorizedError('Autenticação necessária')

    const userRole = e.auth.getString('role')
    let tenantId = e.auth.getString('tenant')

    // Se o usuário não for superadmin, forçar o log sempre para o tenant do usuário logado
    if (userRole !== 'superadmin') {
      if (!tenantId) {
        return e.forbiddenError('Usuário sem prefeitura associada não pode criar log de auditoria')
      }
    } else {
      // Superadmin pode especificar o tenant pelo body ou usar o seu
      if (!tenantId && body.tenant) {
        tenantId = body.tenant
      }
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
