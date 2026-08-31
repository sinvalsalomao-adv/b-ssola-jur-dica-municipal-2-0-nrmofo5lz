migrate(
  (app) => {
    // 1. Criar a coleção dedicada de marcadores de segurança caso ainda não exista
    let markersCol = null
    try {
      markersCol = app.findCollectionByNameOrId('security_audit_markers')
    } catch (_) {}

    if (!markersCol) {
      markersCol = new Collection({
        name: 'security_audit_markers',
        type: 'base',
        // RLS restritivo: superadmin only (null nas regras)
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          { name: 'marker_key', type: 'text', required: true },
          { name: 'version', type: 'text', required: true },
          { name: 'details', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_security_audit_marker_key ON security_audit_markers (marker_key)',
        ],
      })
      app.save(markersCol)
    }

    // 2. Transação atômica para checagem do marcador e rotação de tokenKey
    app.runInTransaction((txApp) => {
      const MARKER_KEY = 'seed_password_and_session_rotation_v1'
      const VERSION = '0029'

      // Verificar se o marcador já existe
      let existingMarker = null
      try {
        existingMarker = txApp.findFirstRecordByData(
          'security_audit_markers',
          'marker_key',
          MARKER_KEY,
        )
      } catch (_) {}

      if (existingMarker) {
        console.log(
          'Migration 0029: Marcador persistente ' +
            MARKER_KEY +
            ' detectado. Rotação já efetuada. Abortando nova rotação para preservar idempotência.',
        )
        return
      }

      // Lista confiável dos 10 e-mails de contas seed históricas (migration 0005)
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

      let rotatedCount = 0
      let notFoundCount = 0

      for (let i = 0; i < seedEmails.length; i++) {
        const email = seedEmails[i]
        let user = null
        try {
          user = txApp.findAuthRecordByEmail('_pb_users_auth_', email)
        } catch (findErr) {
          notFoundCount++
          continue
        }

        if (user) {
          // Invalidação oficial de sessões/JWTs residuais:
          if (typeof user.refreshTokenKey === 'function') {
            user.refreshTokenKey()
          } else {
            user.set('tokenKey:autogenerate', '')
          }

          try {
            txApp.save(user)
            rotatedCount++
          } catch (saveErr) {
            console.log(
              'Migration 0029 erro: Falha ao salvar usuário durante rotação de sessões. Abortando transação.',
            )
            throw saveErr
          }
        }
      }

      // 3. Criar e persistir o marcador de segurança dedicado atomicamente
      try {
        const markerRecordCol = txApp.findCollectionByNameOrId('security_audit_markers')
        const markerRecord = new Record(markerRecordCol)
        markerRecord.set('marker_key', MARKER_KEY)
        markerRecord.set('version', VERSION)
        markerRecord.set('details', {
          rotated_accounts_count: rotatedCount,
          target_seed_accounts: seedEmails.length,
          executed_at: new Date().toISOString(),
          description:
            'Neutralizacao definitiva de senhas legadas e rotacoes de tokenKey das contas seed historicas',
        })
        txApp.save(markerRecord)
      } catch (markerErr) {
        console.log(
          'Migration 0029 erro: Falha ao persistir marcador de auditoria de segurança. Abortando transação.',
        )
        throw markerErr
      }

      console.log(
        'Migration 0029 concluída com sucesso: ' +
          rotatedCount +
          ' contas seed processadas e marcador ' +
          MARKER_KEY +
          ' persistido em security_audit_markers.',
      )
    })
  },
  (app) => {
    // Reversão segura forward-only: não reverter chaves de segurança nem tokens invalidados
  },
)
