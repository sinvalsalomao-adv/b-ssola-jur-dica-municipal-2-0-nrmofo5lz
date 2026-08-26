// Password strength policy validation for create and update on users collection
// Required: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char (@$!%*?&)

onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const password = body.password

  if (password !== undefined && password !== null && String(password).length > 0) {
    const pwd = String(password)
    const hasMinLen = pwd.length >= 8
    const hasUpper = /[A-Z]/.test(pwd)
    const hasLower = /[a-z]/.test(pwd)
    const hasNumber = /[0-9]/.test(pwd)
    const hasSpecial = /[@$!%*?&]/.test(pwd)

    if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return e.json(400, {
        code: 400,
        message:
          'A senha não atende aos requisitos de segurança: deve ter no mínimo 8 caracteres, pelo menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial (@$!%*?&).',
        data: {
          password: {
            code: 'validation_password_strength',
            message:
              'A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial (@$!%*?&).',
          },
        },
      })
    }
  }

  return e.next()
}, 'users')

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  const password = body.password

  // Se uma nova senha for fornecida no update, validar requisitos
  if (password !== undefined && password !== null && String(password).length > 0) {
    const pwd = String(password)
    const hasMinLen = pwd.length >= 8
    const hasUpper = /[A-Z]/.test(pwd)
    const hasLower = /[a-z]/.test(pwd)
    const hasNumber = /[0-9]/.test(pwd)
    const hasSpecial = /[@$!%*?&]/.test(pwd)

    if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      return e.json(400, {
        code: 400,
        message:
          'A senha não atende aos requisitos de segurança: deve ter no mínimo 8 caracteres, pelo menos 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial (@$!%*?&).',
        data: {
          password: {
            code: 'validation_password_strength',
            message:
              'A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial (@$!%*?&).',
          },
        },
      })
    }
  }

  return e.next()
}, 'users')
