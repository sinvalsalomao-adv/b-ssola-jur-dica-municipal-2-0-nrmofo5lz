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

    let invalidatedCount = 0

    for (let i = 0; i < seedEmails.length; i++) {
      const email = seedEmails[i]
      try {
        const user = app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (user) {
          // Gerar valor criptograficamente seguro e único para cada conta seed
          const secureRandomSecret =
            $security.randomString(32) +
            '!' +
            $security.sha256($security.randomString(16) + email + String(Date.now()))

          // Invalidar a senha conhecida usando valor aleatório que nunca é persistido em texto claro nem revelado
          user.setPassword(secureRandomSecret)

          // Rotacionar tokenKey para invalidar tokens JWT ativos
          user.set('tokenKey', $security.randomString(30))

          app.save(user)
          invalidatedCount++
        }
      } catch (_) {
        // Usuário não encontrado ou já tratado — ignorar silenciosamente
      }
    }

    console.log(
      'Migration 0024 executada com sucesso: ' +
        invalidatedCount +
        ' contas seed neutralizadas de forma segura e idempotente.',
    )
  },
  (app) => {
    // Reversão segura forward-only: não restaurar senhas conhecidas em hipótese alguma.
    // Em rollback, mantém senhas seguras ou gera novos valores aleatórios.
  },
)
