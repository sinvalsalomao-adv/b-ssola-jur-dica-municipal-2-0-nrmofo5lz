// Route: POST /backend/v1/tenant-users/cleanup-ephemeral
// Dedicated Authenticated Endpoint for Superadmin to Clean Up Ephemeral Test Records
// STRICT SECURITY CONSTRAINTS:
// 1. Only accessible by authenticated superadmin.
// 2. Accepts ephemeralUserIds, ephemeralMembershipIds, and ephemeralTenantIds.
// 3. Strictly blocks deletion of historical seed accounts (seed accounts defined in 0005/0024).
// 4. Returns deleted count and status.

routerAdd(
  'POST',
  '/backend/v1/tenant-users/cleanup-ephemeral',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authRole = auth.getString('role')
    if (authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        message: 'Apenas superadmin pode acionar cleanup de fixtures efêmeras.',
      })
    }

    const body = e.requestInfo().body || {}
    const userIds = Array.isArray(body.userIds) ? body.userIds : []
    const membershipIds = Array.isArray(body.membershipIds) ? body.membershipIds : []
    const tenantIds = Array.isArray(body.tenantIds) ? body.tenantIds : []

    // Seed account IDs invioláveis
    const protectedSeedUserIds = [
      'uxnit0c8oensr67',
      '6gea9t5lk6z1x00',
      '166gp4mdaxy2av4',
      'z3cbxpj8h6xl9z3',
      'br3gos31bmxfllw',
      '92b3oxlgc3q965x',
      'dn3ubij1vmuj9mf',
      'brf0wdudisx0inr',
      'c26yzjtppm5glbi',
      'sfiv25ug27w7gfd',
    ]

    const protectedSeedTenantIds = ['1e6lxk1tvyt27ok', 'brfahrpkg6uvula', 'wzio6lp1dq4y6xd']

    let deletedUsersCount = 0
    let deletedMembershipsCount = 0
    let deletedTenantsCount = 0

    $app.runInTransaction((txApp) => {
      // 1. Deletar memberships efêmeras
      for (let i = 0; i < membershipIds.length; i++) {
        const mId = String(membershipIds[i]).trim()
        if (!mId) continue
        try {
          const mRec = txApp.findFirstRecordByData('user_memberships', 'id', mId)
          if (mRec) {
            txApp.delete(mRec)
            deletedMembershipsCount++
          }
        } catch (_) {}
      }

      // 2. Deletar usuários efêmeros (garantindo que não sejam seed)
      for (let i = 0; i < userIds.length; i++) {
        const uId = String(userIds[i]).trim()
        if (!uId || protectedSeedUserIds.indexOf(uId) !== -1) continue
        try {
          const uRec = txApp.findFirstRecordByData('users', 'id', uId)
          if (uRec) {
            // Deletar qualquer membership residual desse usuário
            const escapedUId = uId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
            const remainingMems = txApp.findRecordsByFilter(
              'user_memberships',
              "user = '" + escapedUId + "'",
              '',
              100,
              0,
            )
            for (let j = 0; j < remainingMems.length; j++) {
              try {
                txApp.delete(remainingMems[j])
                deletedMembershipsCount++
              } catch (_) {}
            }

            txApp.delete(uRec)
            deletedUsersCount++
          }
        } catch (_) {}
      }

      // 3. Deletar tenants efêmeros (garantindo que não sejam seed)
      for (let i = 0; i < tenantIds.length; i++) {
        const tId = String(tenantIds[i]).trim()
        if (!tId || protectedSeedTenantIds.indexOf(tId) !== -1) continue
        try {
          const tRec = txApp.findFirstRecordByData('tenants', 'id', tId)
          if (tRec) {
            txApp.delete(tRec)
            deletedTenantsCount++
          }
        } catch (_) {}
      }
    })

    return e.json(200, {
      success: true,
      deletedUsersCount: deletedUsersCount,
      deletedMembershipsCount: deletedMembershipsCount,
      deletedTenantsCount: deletedTenantsCount,
    })
  },
  $apis.requireAuth(),
)
