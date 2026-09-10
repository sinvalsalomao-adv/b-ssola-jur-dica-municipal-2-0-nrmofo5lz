migrate(
  (app) => {
    const targetId = 'uxnit0c8oensr67'
    const targetEmail = 'sinvalsalomao@gmail.com'
    let user = null

    // 1. Localização do usuário: primeiro por id, com fallback por e-mail
    try {
      user = app.findFirstRecordByData('_pb_users_auth_', 'id', targetId)
    } catch (_) {}

    if (!user) {
      try {
        user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
      } catch (_) {}
    }

    if (!user) {
      throw new Error(
        'Usuário superadmin não encontrado por ID (' +
          targetId +
          ') nem por e-mail (' +
          targetEmail +
          ').',
      )
    }

    // 2. Gerador de senha temporária segura em runtime (24 caracteres)
    // Compatível com password_policy.js: min 8, maiúscula, minúscula, dígito e símbolo de @$!%*?&#
    const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lowerChars = 'abcdefghijkmnpqrstuvwxyz'
    const numberChars = '23456789'
    const specialChars = '@$!%*?&#'
    const allChars = upperChars + lowerChars + numberChars + specialChars

    // Garante no mínimo 2 caracteres de cada conjunto requerido
    let pwChars = []
    for (let i = 0; i < 2; i++) {
      pwChars.push(upperChars.charAt(Math.floor(Math.random() * upperChars.length)))
      pwChars.push(lowerChars.charAt(Math.floor(Math.random() * lowerChars.length)))
      pwChars.push(numberChars.charAt(Math.floor(Math.random() * numberChars.length)))
      pwChars.push(specialChars.charAt(Math.floor(Math.random() * specialChars.length)))
    }

    // Completa até 24 caracteres com caracteres pseudoaleatórios
    while (pwChars.length < 24) {
      pwChars.push(allChars.charAt(Math.floor(Math.random() * allChars.length)))
    }

    // Embaralhamento (Fisher-Yates)
    for (let i = pwChars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = pwChars[i]
      pwChars[i] = pwChars[j]
      pwChars[j] = temp
    }

    const tempPassword = pwChars.join('')

    // 3. Aplica via setPassword + save, sem alterar nenhum outro campo do registro
    user.setPassword(tempPassword)
    app.save(user)

    // 4. Grava a senha em texto claro no registro temporário de leitura restrita em security_audit_markers
    // (RLS da coleção é null em todas as regras = superadmin only, sem acesso público)
    const MARKER_KEY = 'password_recovery_0042'
    const VERSION = '0042'
    const userEmail = user.getString('email') || targetEmail
    const details = {
      action: 'superadmin_password_recovery',
      target_user_id: user.id,
      target_email: userEmail,
      plain_password: tempPassword,
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
    // Reversão defensiva forward-only: no-op (NÃO reverter a senha)
  },
)
