migrate(
  (app) => {
    const tenantsCol = app.findCollectionByNameOrId('tenants')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    function mkTenant(name, cnpj, slug, adminName) {
      try {
        app.findFirstRecordByData('tenants', 'slug', slug)
        return
      } catch (_) {}
      var r = new Record(tenantsCol)
      r.set('name', name)
      r.set('cnpj', cnpj)
      r.set('slug', slug)
      r.set('admin_name', adminName)
      r.set('status', 'ativa')
      app.save(r)
    }

    function mkUser(email, name, role, tenantSlug) {
      try {
        app.findAuthRecordByEmail('_pb_users_auth_', email)
        return
      } catch (_) {}
      var r = new Record(usersCol)
      r.setEmail(email)
      r.setPassword('Skip@Pass')
      r.setVerified(true)
      r.set('name', name)
      r.set('role', role)
      r.set('status', 'ativo')
      if (tenantSlug) {
        var t = app.findFirstRecordByData('tenants', 'slug', tenantSlug)
        r.set('tenant', t.id)
      }
      app.save(r)
    }

    mkTenant('Florânia', '12.345.678/0001-90', 'florania', 'Ana Silva')
    mkTenant('Tangará', '98.765.432/0001-10', 'tangara', 'Pedro Oliveira')
    mkTenant('Parazinho', '11.222.333/0001-44', 'parazinho', 'Lucas Almeida')

    mkUser('sinvalsalomao@gmail.com', 'Dr. Silval Salomão', 'superadmin', null)
    mkUser('admin1@florania.gov.br', 'Ana Silva', 'admin', 'florania')
    mkUser('servidor1@florania.gov.br', 'Carlos Santos', 'servidor', 'florania')
    mkUser('servidor2@florania.gov.br', 'Mariana Costa', 'servidor', 'florania')
    mkUser('admin1@tangara.gov.br', 'Pedro Oliveira', 'admin', 'tangara')
    mkUser('servidor1@tangara.gov.br', 'Sofia Ferreira', 'servidor', 'tangara')
    mkUser('servidor2@tangara.gov.br', 'João Pereira', 'servidor', 'tangara')
    mkUser('admin1@parazinho.gov.br', 'Lucas Almeida', 'admin', 'parazinho')
    mkUser('servidor1@parazinho.gov.br', 'Fernanda Lima', 'servidor', 'parazinho')
    mkUser('servidor2@parazinho.gov.br', 'Roberto Dias', 'servidor', 'parazinho')
  },
  (app) => {
    try {
      app.truncateCollection(app.findCollectionByNameOrId('tenants'))
    } catch (_) {}
  },
)
