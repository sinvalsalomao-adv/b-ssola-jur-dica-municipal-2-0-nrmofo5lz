migrate(
  (app) => {
    // Lista de identificadores das contas criadas pela migration histórica 0005
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

    // Transação atômica para garantir que qualquer falha antes ou durante app.save
    // acione rollback imediato sem expor segredos
    app.runInTransaction((txApp) => {
      let invalidatedCount = 0
      let alreadyNeutralizedCount = 0

      for (let i = 0; i < seedEmails.length; i++) {
        const email = seedEmails[i]
        let user = null

        try {
          user = txApp.findAuthRecordByEmail('_pb_users_auth_', email)
        } catch (findErr) {
          // Se o usuário não existir no banco, registrar de forma segura sem vazar dados
          console.log('Migration 0024: Usuário seed não localizado no banco. Registro ignorado.')
          continue
        }

        if (user) {
          // Idempotência: verificar se a conta ainda aceita a credencial legada Skip@Pass
          // Se já não valida com a senha legada, a conta já se encontra neutralizada.
          const isLegacyPasswordActive = user.validatePassword('Skip@Pass')

          if (!isLegacyPasswordActive) {
            alreadyNeutralizedCount++
            continue
          }

          // Gerar credencial forte e aleatória compatível com os validadores do PocketBase (apenas alfanumérico e caracteres válidos)
          const secureRandomSecret = 'Sec' + $security.randomString(20) + '9Aa!'

          // Invalidar senha pelo método oficial do PocketBase (setPassword faz o hash seguro)
          user.setPassword(secureRandomSecret)

          try {
            txApp.save(user)
            invalidatedCount++
          } catch (saveErr) {
            // Log seguro sem expor senhas ou dados sensíveis, lançando erro para abortar a transação
            console.log(
              'Migration 0024 erro: Falha ao persistir neutralização de conta seed. Abortando transação: ' +
                (saveErr && saveErr.message ? saveErr.message : String(saveErr)),
            )
            throw saveErr
          }
        }
      }

      console.log(
        'Migration 0024 executada com sucesso: ' +
          invalidatedCount +
          ' contas neutralizadas nesta execução e ' +
          alreadyNeutralizedCount +
          ' contas previamente neutralizadas.',
      )
    })
  },
  (app) => {
    // Reversão segura forward-only: não restaurar senhas conhecidas em hipótese alguma.
    // Em rollback, mantém senhas seguras.
  },
)
