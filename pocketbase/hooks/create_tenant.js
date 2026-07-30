routerAdd(
  'POST',
  '/backend/v1/tenants/create',
  (e) => {
    const body = e.requestInfo().body || {}

    if (!body.name || !body.name.trim())
      return e.badRequestError('Nome da Prefeitura é obrigatório')
    if (!body.slug || !body.slug.trim()) return e.badRequestError('Slug é obrigatório')
    if (!body.admin_name || !body.admin_name.trim())
      return e.badRequestError('Nome do Administrador é obrigatório')

    try {
      $app.findFirstRecordByData('tenants', 'slug', body.slug.trim())
      return e.badRequestError('Slug já existe. Escolha outro.')
    } catch (_) {}

    const tenantsCol = $app.findCollectionByNameOrId('tenants')
    const tenant = new Record(tenantsCol)
    tenant.set('name', body.name.trim())
    tenant.set('cnpj', body.cnpj || '')
    tenant.set('slug', body.slug.trim())
    tenant.set('admin_name', body.admin_name.trim())
    tenant.set('status', 'ativa')
    $app.save(tenant)

    const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
    const adminEmail = 'admin@' + body.slug.trim() + '.prefeitura.gov'
    const adminUser = new Record(usersCol)
    adminUser.setEmail(adminEmail)
    adminUser.setPassword('Skip@Pass')
    adminUser.setVerified(true)
    adminUser.set('name', body.admin_name.trim())
    adminUser.set('role', 'admin')
    adminUser.set('status', 'ativo')
    adminUser.set('tenant', tenant.id)
    $app.save(adminUser)

    return e.json(201, {
      tenant: { id: tenant.id, name: tenant.getString('name'), slug: tenant.getString('slug') },
      admin: { id: adminUser.id, email: adminEmail, name: body.admin_name.trim() },
    })
  },
  $apis.requireSuperuserAuth(),
)
