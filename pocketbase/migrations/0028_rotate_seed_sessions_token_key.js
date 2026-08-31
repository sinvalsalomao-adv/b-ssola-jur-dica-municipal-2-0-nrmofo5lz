migrate(
  (app) => {
    // Lista de identificadores das 10 contas criadas pela migration histórica 0005
    const seedEmails = [
      'sinvalsalomao@gmail.com',
      'admin1@florania.gov.br',
      'servidor1@florania.gov.br',
      'servidor2@florania.gov.br',
      'admin1@tangara.gov.br',
      'servidor1@tangara.gov.br',
      'servidor2@tangara.gov.br',
      'admin1@parazinho.gov.br',
      'servidor1@parazinho.gov.br',
      'servidor2@parazinho.gov.br',
    ]

    // Transação atômica para garantir que qualquer falha antes ou durante txApp.save
    // acione rollback imediato sem expor segredos ou tokens
    app.runInTransaction((txApp) => {
      // 1. Verificação de idempotência persistente via platform_settings
      let platformSettings = null
      try {
        const records = txApp.findRecordsByFilter('platform_settings', '', '-created', 1, 0)
        if (records.length > 0) {
          platformSettings = records[0]
        }
      } catch (_) {}

      // Verificar se o marcador de rotação da migration 0028 já foi registrado
      if (platformSettings) {
        try {
          const rawLimits = platformSettings.get('stall_limits')
          let limitsObj = {}
          if (typeof rawLimits === 'string') {
            limitsObj = JSON.parse(rawLimits || '{}')
          } else if (rawLimits && typeof rawLimits === 'object') {
            limitsObj = rawLimits
          }
          if (limitsObj && limitsObj._seed_sessions_rotated_0028) {
            console.log(
              'Migration 0028: Marcador persistente detectado. Rotação de tokenKey já concluída previamente. Ignorando re-execução.',
            )
            return
          }
        } catch (_) {}
      }

      let rotatedCount = 0
      let notFoundCount = 0

      for (let i = 0; i < seedEmails.length; i++) {
        const email = seedEmails[i]
        let user = null

        try {
          user = txApp.findAuthRecordByEmail('_pb_users_auth_', email)
        } catch (findErr) {
          notFoundCount++
          console.log('Migration 0028: Conta seed não localizada no banco. Registro ignorado.')
          continue
        }

        if (user) {
          // Invalidação oficial de sessões/JWTs residuais:
          // refreshTokenKey() gera e define uma nova chave criptográfica tokenKey aleatória
          if (typeof user.refreshTokenKey === 'function') {
            user.refreshTokenKey()
          } else {
            // Equivalente oficial documentado do PocketBase para autogerar novo tokenKey
            user.set('tokenKey:autogenerate', '')
          }

          try {
            txApp.save(user)
            rotatedCount++
          } catch (saveErr) {
            console.log(
              'Migration 0028 erro: Falha ao salvar rotação de sessões para conta seed. Abortando transação.',
            )
            throw saveErr
          }
        }
      }

      // Registrar marcador persistente de conclusão idempotente
      if (platformSettings) {
        try {
          const rawLimits = platformSettings.get('stall_limits')
          let limitsObj = {}
          if (typeof rawLimits === 'string') {
            limitsObj = JSON.parse(rawLimits || '{}')
          } else if (rawLimits && typeof rawLimits === 'object') {
            limitsObj = rawLimits
          }
          limitsObj._seed_sessions_rotated_0028 = true
          limitsObj._seed_sessions_rotated_at = new Date().toISOString()
          platformSettings.set('stall_limits', limitsObj)
          txApp.save(platformSettings)
        } catch (setErr) {
          console.log(
            'Migration 0028 erro: Falha ao persistir marcador de idempotência. Abortando transação.',
          )
          throw setErr
        }
      }

      console.log(
        'Migration 0028 executada com sucesso: ' +
          rotatedCount +
          ' contas seed tiveram seus tokenKeys rotacionados (sessões/JWTs legados invalidados).',
      )
    })
  },
  (app) => {
    // Reversão segura forward-only: sessões rotacionadas não devem ser reabertas em rollback.
  },
)
