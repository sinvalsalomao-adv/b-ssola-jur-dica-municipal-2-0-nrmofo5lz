migrate(
  (app) => {
    const targetEmail = 'sinvalsalomao@gmail.com'
    let user = null

    try {
      user = app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
    } catch (err) {
      throw new Error(
        'Usuário superadmin não encontrado para o e-mail ' +
          targetEmail +
          ': ' +
          (err && err.message ? err.message : String(err)),
      )
    }

    if (!user) {
      throw new Error('Usuário superadmin não encontrado para o e-mail ' + targetEmail)
    }

    // Gerador de senha temporária segura em runtime (24 caracteres)
    // Atende a política de password_policy.js: min 8, maiúscula, minúscula, número e símbolo (@$!%*?&#)
    const upperChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
    const lowerChars = 'abcdefghijkmnpqrstuvwxyz'
    const numberChars = '23456789'
    const specialChars = '@$!%*?&#'
    const allChars = upperChars + lowerChars + numberChars + specialChars

    // Garante no mínimo 2 de cada categoria requerida
    let pwChars = []
    for (let i = 0; i < 2; i++) {
      pwChars.push(upperChars.charAt(Math.floor(Math.random() * upperChars.length)))
      pwChars.push(lowerChars.charAt(Math.floor(Math.random() * lowerChars.length)))
      pwChars.push(numberChars.charAt(Math.floor(Math.random() * numberChars.length)))
      pwChars.push(specialChars.charAt(Math.floor(Math.random() * specialChars.length)))
    }

    // Completa até 24 caracteres com bytes pseudoaleatórios
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

    const pw = pwChars.join('')

    // Aplica no registro de usuário utilizando a API do PocketBase
    user.setPassword(pw)
    user.set('password', pw)
    user.set('passwordConfirm', pw)

    app.save(user)

    // Log para captura nos logs do backend e entrega ao usuário
    console.log('SUPERADMIN_TEMP_PASSWORD:' + pw)
  },
  (app) => {
    // Reversão segura forward-only: No-op defensivo
  },
)
