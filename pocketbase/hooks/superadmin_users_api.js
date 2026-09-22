// Endpoint seguro exclusivo para Superadmin listar todos os usuários com e-mail visível
// Skip Cloud / PocketBase oculta por padrão o campo 'email' de auth records quando emailVisibility é false
// para outros usuários que não o próprio titular. Este endpoint devolve os usuários reais com seus e-mails.

routerAdd(
  'GET',
  '/backend/v1/superadmin/users',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authRole = auth.getString('role')
    if (authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        message: 'Acesso restrito a Superadministradores da plataforma.',
      })
    }

    try {
      const records = $app.findRecordsByFilter('users', "id != ''", 'created', 1000, 0)

      // Carregar todos os tenants para mapeamento
      const tenants = $app.findRecordsByFilter('tenants', "id != ''", 'name', 1000, 0)
      const tenantMap = {}
      for (let i = 0; i < tenants.length; i++) {
        const t = tenants[i]
        tenantMap[t.id] = {
          id: t.id,
          name: t.getString('name') || '',
          slug: t.getString('slug') || '',
        }
      }

      // Carregar vínculos de memberships para enriquecer município caso não preenchido em users.tenant
      const memberships = $app.findRecordsByFilter(
        'user_memberships',
        "id != ''",
        '-created',
        1000,
        0,
      )
      const membershipMap = {}
      for (let i = 0; i < memberships.length; i++) {
        const m = memberships[i]
        const uId = m.getString('user')
        if (uId && (!membershipMap[uId] || m.getString('status') === 'ativo')) {
          membershipMap[uId] = {
            tenantId: m.getString('tenant'),
            role: m.getString('role'),
            status: m.getString('status'),
          }
        }
      }

      const users = []
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        const directTenantId = r.getString('tenant')
        const mem = membershipMap[r.id]
        const effectiveTenantId = directTenantId || (mem ? mem.tenantId : '')
        const tInfo = tenantMap[effectiveTenantId] || { name: '—', slug: '' }

        let effectiveRole = r.getString('role') || 'servidor'
        if (effectiveRole === 'servidor' && mem && mem.role) {
          effectiveRole = mem.role
        }

        users.push({
          id: r.id,
          name: r.getString('name') || '',
          email: r.getString('email') || '',
          prefeituraName: tInfo.name || '—',
          prefeituraSlug: tInfo.slug || '',
          role: effectiveRole,
          status: r.getString('status') || 'ativo',
          lastAccess: r.getString('updated') || r.getString('created') || '—',
          created: r.getString('created') || '',
        })
      }

      return e.json(200, { items: users })
    } catch (err) {
      return e.json(500, { code: 500, message: 'Erro ao consultar usuários globais.' })
    }
  },
  $apis.requireAuth(),
)
