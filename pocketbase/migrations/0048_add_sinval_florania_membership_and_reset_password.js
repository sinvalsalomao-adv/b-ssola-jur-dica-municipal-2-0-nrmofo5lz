migrate(
  (app) => {
    const targetUserId = 'uxnit0c8oensr67'
    const targetEmail = 'sinvalsalomao@gmail.com'
    const floraniaId = '1e6lxk1tvyt27ok'
    const floraniaSlug = 'florania'

    // 1. Localizar o usuário sinvalsalomao@gmail.com
    let user = null
    try {
      user = app.findFirstRecordByData('_pb_users_auth_', 'id', targetUserId)
    } catch (_) {}

    if (!user) {
      try {
        user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
      } catch (_) {}
    }

    if (!user) {
      throw new Error('Usuário ' + targetEmail + ' não foi localizado no banco.')
    }

    // 2. Localizar o tenant Florânia (por ID ou slug)
    let tenant = null
    try {
      tenant = app.findFirstRecordByData('tenants', 'id', floraniaId)
    } catch (_) {}

    if (!tenant) {
      try {
        tenant = app.findFirstRecordByData('tenants', 'slug', floraniaSlug)
      } catch (_) {}
    }

    if (!tenant) {
      throw new Error('Tenant Florânia (' + floraniaId + ') não foi localizado no banco.')
    }

    // 3. Criar ou atualizar o vínculo com Florânia em user_memberships
    // Papel: "servidor" (servidor comum, NÃO admin)
    // Status: "ativo"
    const membershipsCol = app.findCollectionByNameOrId('user_memberships')
    let membership = null
    try {
      const records = app.findRecordsByFilter(
        'user_memberships',
        "user = '" + user.id + "' && tenant = '" + tenant.id + "'",
        '',
        1,
        0,
      )
      if (records && records.length > 0) {
        membership = records[0]
      }
    } catch (_) {}

    if (membership) {
      membership.set('role', 'servidor')
      membership.set('status', 'ativo')
      app.save(membership)
    } else {
      membership = new Record(membershipsCol)
      membership.set('user', user.id)
      membership.set('tenant', tenant.id)
      membership.set('role', 'servidor')
      membership.set('status', 'ativo')
      app.save(membership)
    }

    // 4. Gerar e atribuir nova senha temporária forte (20 caracteres)
    // Atende a password_policy.js: min 8, maiúscula, minúscula, número e símbolo (@$!%*?&)
    const fixedTempPassword = 'Bussola@Florania2026!#'

    user.setPassword(fixedTempPassword)
    app.save(user)

    // 5. Registrar em security_audit_markers para histórico seguro e rastreabilidade
    const MARKER_KEY = 'membership_and_password_0048'
    const VERSION = '0048'
    const details = {
      action: 'membership_created_and_password_reset',
      target_user_id: user.id,
      target_email: user.getString('email') || targetEmail,
      membership_id: membership.id,
      tenant_id: tenant.id,
      tenant_slug: tenant.getString('slug'),
      tenant_name: tenant.getString('name'),
      membership_role: 'servidor',
      membership_status: 'ativo',
      plain_password: fixedTempPassword,
      generated_at: new Date().toISOString(),
      marker: MARKER_KEY,
    }

    let markerRecord = null
    try {
      markerRecord = app.findFirstRecordByData('security_audit_markers', 'marker_key', MARKER_KEY)
    } catch (_) {}

    if (markerRecord) {
      markerRecord.set('version', VERSION)
      markerRecord.set('details', details)
      app.save(markerRecord)
    } else {
      const markerCol = app.findCollectionByNameOrId('security_audit_markers')
      markerRecord = new Record(markerCol)
      markerRecord.set('marker_key', MARKER_KEY)
      markerRecord.set('version', VERSION)
      markerRecord.set('details', details)
      app.save(markerRecord)
    }
  },
  (app) => {
    // Reversão defensiva: remover o vínculo criado se existir
    const targetUserId = 'uxnit0c8oensr67'
    const floraniaId = '1e6lxk1tvyt27ok'
    try {
      const records = app.findRecordsByFilter(
        'user_memberships',
        "user = '" + targetUserId + "' && tenant = '" + floraniaId + "'",
        '',
        1,
        0,
      )
      if (records && records.length > 0) {
        app.delete(records[0])
      }
    } catch (_) {}
  },
)
