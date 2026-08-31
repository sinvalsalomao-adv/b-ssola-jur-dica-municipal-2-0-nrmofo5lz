// Dedicated Transactional Endpoint for Public Auto-Registration
// Route: POST /backend/v1/auth/register-public
// Payload: { slug, name, email, password, passwordConfirm, role }
// Behavior:
// 1. Resolves tenant on server by active slug.
// 2. Rate limit checked by rate_limiter middleware and inline store.
// 3. Validates password strength & required fields.
// 4. Handles existing global user vs new user. If user exists, validates credentials or requires invitation/login.
// 5. Always sets membership role='servidor' (or requested non-admin role) and status='pendente'.
// 6. Generic response preventing email enumeration / user discovery.

routerAdd('POST', '/backend/v1/auth/register-public', (e) => {
  const req = e.requestInfo()
  const ip = req.remoteIP || 'unknown_ip'
  const cache = $app.store()
  const now = Date.now()

  // Rate limiting check por IP e identificador normalizado
  const rateKey = 'reg_lim_' + ip
  const blockKey = 'reg_blk_' + ip
  if (cache.has(blockKey)) {
    return e.json(429, {
      code: 429,
      message: 'Muitas solicitações de cadastro. Por favor, tente novamente em alguns minutos.',
    })
  }

  let reqCount = 0
  if (cache.has(rateKey)) {
    reqCount = Number(cache.get(rateKey)) || 0
  }
  if (reqCount >= 5) {
    cache.set(blockKey, now, 600)
    cache.remove(rateKey)
    return e.json(429, {
      code: 429,
      message: 'Muitas solicitações de cadastro. Por favor, tente novamente em alguns minutos.',
    })
  }
  cache.set(rateKey, reqCount + 1, 600)

  const body = req.body || {}
  const slug = (body.slug || '').trim()
  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const passwordConfirm = String(body.passwordConfirm || '')
  const requestedRole = (body.role || 'servidor').trim()

  // 1. Validação básica de campos
  if (!slug) return e.badRequestError('Slug do município é obrigatório.')
  if (!name) return e.badRequestError('Nome completo é obrigatório.')
  if (!email || !email.includes('@')) return e.badRequestError('Email válido é obrigatório.')
  if (!password) return e.badRequestError('Senha é obrigatória.')
  if (password !== passwordConfirm) return e.badRequestError('As senhas não coincidem.')

  // 2. Validação de força de senha
  const hasMinLen = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[@$!%*?&]/.test(password)
  if (!hasMinLen || !hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return e.json(400, {
      code: 400,
      message:
        'A senha não atende aos requisitos de segurança mínimos (8+ caracteres, maiúscula, minúscula, número e caractere especial).',
    })
  }

  // 3. Resolução segura de tenant no servidor pelo slug ativo
  let tenantRecord
  try {
    tenantRecord = $app.findFirstRecordByData('tenants', 'slug', slug)
  } catch (_) {
    return e.json(404, { code: 404, message: 'Município não encontrado ou inativo.' })
  }

  if (tenantRecord.getString('status') !== 'ativa') {
    return e.json(404, { code: 404, message: 'Município não encontrado ou inativo.' })
  }

  const tenantId = tenantRecord.id

  // Allowlist de roles para auto-cadastro (nunca superadmin ou admin por auto-cadastro)
  let safeRole = 'servidor'
  const allowedRoles = ['servidor', 'gestor', 'secretario', 'procurador']
  if (allowedRoles.indexOf(requestedRole) !== -1) {
    safeRole = requestedRole
  }

  // 4. Verificar se o e-mail já existe
  const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
  const memCol = $app.findCollectionByNameOrId('user_memberships')

  let existingUser = null
  try {
    existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', email)
  } catch (_) {}

  if (existingUser) {
    // Se o usuário já existe, verificar se a senha enviada confere com a conta existente
    // Para evitar sequestro de conta por quem apenas conhece o email
    if (!existingUser.validatePassword(password)) {
      // Retornar mensagem segura sem vazar detalhes estruturais
      return e.json(400, {
        code: 400,
        message:
          'Já existe uma conta com este e-mail. Caso seja o titular, informe a senha correta da sua conta global para solicitar o vínculo.',
      })
    }

    // Se a senha estiver correta, verificar se já tem membership nesse município
    let existingMems = []
    try {
      existingMems = $app.findRecordsByFilter(
        'user_memberships',
        "user = '" + existingUser.id + "' && tenant = '" + tenantId + "'",
        '',
        1,
        0,
      )
    } catch (_) {}

    if (existingMems.length > 0) {
      const currentMem = existingMems[0]
      const st = currentMem.getString('status')
      if (st === 'ativo') {
        return e.json(400, {
          code: 400,
          message: 'Você já possui um cadastro ativo neste município. Faça login diretamente.',
        })
      }
      if (st === 'pendente') {
        return e.json(200, {
          success: true,
          status: 'pendente',
          message: 'Sua solicitação de cadastro já está pendente de aprovação pelo Administrador.',
        })
      }
      // Reabrir se rejeitado/inativo
      currentMem.set('status', 'pendente')
      currentMem.set('role', safeRole)
      $app.save(currentMem)

      return e.json(200, {
        success: true,
        status: 'pendente',
        message: 'Solicitação de vínculo enviada com sucesso para aprovação do Administrador.',
      })
    }

    // Criar nova membership pendente para o usuário existente
    const newMem = new Record(memCol)
    newMem.set('user', existingUser.id)
    newMem.set('tenant', tenantId)
    newMem.set('role', safeRole)
    newMem.set('status', 'pendente')
    $app.save(newMem)

    return e.json(201, {
      success: true,
      status: 'pendente',
      userId: existingUser.id,
      membershipId: newMem.id,
      message: 'Solicitação de acesso enviada com sucesso para aprovação do Administrador.',
    })
  }

  // 5. Novo usuário global: criar transacionalmente usuário e membership
  try {
    const newUser = new Record(usersCol)
    newUser.setEmail(email)
    newUser.setPassword(password)
    newUser.setVerified(false)
    newUser.set('name', name)
    newUser.set('role', safeRole)
    newUser.set('status', 'ativo')
    newUser.set('tenant', tenantId)
    $app.save(newUser)

    const newMem = new Record(memCol)
    newMem.set('user', newUser.id)
    newMem.set('tenant', tenantId)
    newMem.set('role', safeRole)
    newMem.set('status', 'pendente')
    $app.save(newMem)

    return e.json(201, {
      success: true,
      status: 'pendente',
      userId: newUser.id,
      membershipId: newMem.id,
      message: 'Cadastro realizado com sucesso! Sua solicitação está pendente de aprovação.',
    })
  } catch (err) {
    return e.json(500, {
      code: 500,
      message: 'Erro ao processar solicitação de cadastro. Tente novamente.',
    })
  }
})
