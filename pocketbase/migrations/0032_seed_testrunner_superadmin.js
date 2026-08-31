migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const memCol = app.findCollectionByNameOrId('user_memberships')

    // 1. Localizar ou criar a conta de superadmin dedicada de teste
    const testSuperEmail = 'testrunner.superadmin@bussola.local'
    let testSuperRec = null
    try {
      testSuperRec = app.findAuthRecordByEmail('_pb_users_auth_', testSuperEmail)
    } catch (_) {
      testSuperRec = new Record(users)
      testSuperRec.setEmail(testSuperEmail)
      testSuperRec.setPassword('TestRunnerSuperAdmin2026!#$Pass')
      testSuperRec.setVerified(true)
      testSuperRec.set('name', 'TestRunner Superadmin')
      testSuperRec.set('role', 'superadmin')
      testSuperRec.set('status', 'ativo')
      app.save(testSuperRec)
    }

    if (testSuperRec) {
      testSuperRec.setPassword('TestRunnerSuperAdmin2026!#$Pass')
      testSuperRec.set('role', 'superadmin')
      testSuperRec.set('status', 'ativo')
      testSuperRec.setVerified(true)
      app.save(testSuperRec)
    }
  },
  (app) => {
    try {
      const testSuperRec = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'testrunner.superadmin@bussola.local',
      )
      if (testSuperRec) {
        app.delete(testSuperRec)
      }
    } catch (_) {}
  },
)
