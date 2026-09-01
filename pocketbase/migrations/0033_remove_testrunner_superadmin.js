migrate(
  (app) => {
    // 1. Localizar e remover/neutralizar com segurança a conta de superadmin de teste
    const testSuperEmail = 'testrunner.superadmin@bussola.local'
    let testSuperRec = null

    try {
      testSuperRec = app.findAuthRecordByEmail('_pb_users_auth_', testSuperEmail)
    } catch (_) {
      // Se não encontrado por email, busca por id ou filtro
      try {
        testSuperRec = app.findFirstRecordByData('users', 'email', testSuperEmail)
      } catch (_) {}
    }

    if (testSuperRec) {
      const testSuperId = testSuperRec.id

      // Segurança: Abortar/rejeitar se o ID ou email corresponder a qualquer usuário de produção ou seed real
      const protectedSeedUserIds = [
        'uxnit0c8oensr67', // Dr. Silval Salomão (superadmin histórico)
        '6gea9t5lk6z1x00', // Ana Silva (admin florania)
        '166gp4mdaxy2av4', // Carlos Santos (servidor florania)
        'z3cbxpj8h6xl9z3', // Mariana Costa (servidor florania)
        'br3gos31bmxfllw', // Pedro Oliveira (admin tangara)
        '92b3oxlgc3q965x', // Sofia Ferreira (servidor tangara)
        'dn3ubij1vmuj9mf', // João Pereira (servidor tangara)
        'brf0wdudisx0inr', // Lucas Almeida (admin parazinho)
        'c26yzjtppm5glbi', // Fernanda Lima (servidor parazinho)
        'sfiv25ug27w7gfd', // Roberto Dias (servidor parazinho)
      ]

      if (protectedSeedUserIds.indexOf(testSuperId) !== -1) {
        throw new Error(
          'ABORT: Tentativa indevida de exclusão de usuário seed histórico protegido.',
        )
      }

      // Remover quaisquer fixtures efêmeras criadas exclusivamente vinculadas a este usuário de teste
      try {
        const mems = app.findRecordsByFilter(
          'user_memberships',
          "user = '" + testSuperId.replace(/'/g, "\\'") + "'",
          '',
          100,
          0,
        )
        for (let i = 0; i < mems.length; i++) {
          app.delete(mems[i])
        }
      } catch (_) {}

      try {
        const invs = app.findRecordsByFilter(
          'invitations',
          "user = '" + testSuperId.replace(/'/g, "\\'") + "'",
          '',
          100,
          0,
        )
        for (let i = 0; i < invs.length; i++) {
          app.delete(invs[i])
        }
      } catch (_) {}

      // Tentar exclusão segura do registro do superadmin de teste
      let deleted = false
      try {
        app.delete(testSuperRec)
        deleted = true
      } catch (_) {
        // Se a exclusão física falhar, neutraliza completamente:
        // altera tokenKey (revoga todas as sessões), define senha aleatória criptografada e status inativo
        try {
          testSuperRec.refreshTokenKey()
          testSuperRec.setPassword($security.randomString(40))
          testSuperRec.set('status', 'inativo')
          testSuperRec.set('role', 'servidor')
          testSuperRec.setVerified(false)
          app.save(testSuperRec)
        } catch (saveErr) {
          throw new Error('Falha crítica ao neutralizar conta de superadmin de teste: ' + saveErr)
        }
      }

      // Registrar marcador de auditoria de segurança persistente
      try {
        const markerCol = app.findCollectionByNameOrId('security_audit_markers')
        const marker = new Record(markerCol)
        marker.set('marker_key', 'testrunner_superadmin_removal_0033')
        marker.set('version', '0033')
        marker.set('details', {
          action: deleted ? 'deleted_testrunner_superadmin' : 'neutralized_testrunner_superadmin',
          target_email_hash: $security.sha256(testSuperEmail),
          executed_at: new Date().toISOString(),
          status: 'success',
        })
        app.save(marker)
      } catch (mErr) {
        // Marcador já existe ou log de segurança
      }
    }
  },
  (app) => {
    // Forward-only migration: No-op down migration
  },
)
