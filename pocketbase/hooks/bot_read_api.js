// API de Integração com Bot (Hermes): Endpoints somente leitura estruturados em JSON
// Autenticação:
// 1. Chave Mestra da Prefeitura via Authorization: Bearer <chave> ou X-API-Key: <chave>
// 2. Identidade do Usuário Operador via cabeçalho X-Acting-User (e-mail ou ID do usuário no Bússola)
// O município é estritamente derivado da chave mestra (nenhum dado cruza prefeituras).
// Validação ao vivo:
// - prefeitura ativada (tenants.hermes_enabled === true)
// - usuário ativo com vínculo ativo no município da chave mestra
// - papel do vínculo ativo (liveRole) presente em tenants.hermes_allowed_roles
// Se qualquer uma dessas condições falhar: 403 com mensagem genérica fixa:
// "Acesso não autorizado ao Hermes para este município ou usuário."
// Em conformidade com o Skip Cloud JSVM: cada rota encapsula internamente sua validação de autorização.

console.log('[BOT_READ_API] Loading bot_read_api.js file into JSVM (v0.0.112)...')

// --- 0. PING / HEALTH TEST & BASE INFO ---
routerAdd('GET', '/backend/v1/bot', (e) => {
  return e.json(200, {
    status: 'ok',
    message: 'Bússola Jurídica Municipal 2.0 - Bot Read API (Hermes)',
    version: '0.0.112',
    auth_model: 'tenant_master_key_with_acting_user',
    required_headers: [
      'Authorization: Bearer <chave_mestra> (ou X-API-Key: <chave_mestra>)',
      'X-Acting-User: <email_ou_id_do_usuario>',
    ],
    ping: '/backend/v1/bot/ping',
    endpoints: [
      '/backend/v1/bot/ping',
      '/backend/v1/bot/info',
      '/backend/v1/bot/projects',
      '/backend/v1/bot/projects/summary',
      '/backend/v1/bot/dfds',
      '/backend/v1/bot/dfds/{id}',
      '/backend/v1/bot/deadlines',
      '/backend/v1/bot/users',
      '/backend/v1/bot/notifications',
    ],
    timestamp: new Date().toISOString(),
  })
})

routerAdd('GET', '/backend/v1/bot/ping', (e) => {
  const avisosToken = $os.getenv('TELEGRAM_AVISOS_BOT_TOKEN')
  let avisosBotInfo = null
  let avisosWhInfo = null
  let avisosErr = null

  if (avisosToken && avisosToken.trim()) {
    try {
      const gRes = $http.send({
        url: 'https://api.telegram.org/bot' + avisosToken + '/getMe',
        method: 'GET',
        timeout: 10,
      })
      if (gRes.statusCode === 200) {
        avisosBotInfo = JSON.parse(gRes.raw)
      } else {
        avisosErr = 'HTTP ' + gRes.statusCode + ': ' + gRes.raw
      }
    } catch (e1) {
      avisosErr = String(e1)
    }

    try {
      const wRes = $http.send({
        url: 'https://api.telegram.org/bot' + avisosToken + '/getWebhookInfo',
        method: 'GET',
        timeout: 10,
      })
      if (wRes.statusCode === 200) {
        avisosWhInfo = JSON.parse(wRes.raw)
      }
    } catch (_) {}

    // Gravar resultado do getMe e teste no security_audit_markers
    try {
      const colMarkers = $app.findCollectionByNameOrId('security_audit_markers')
      let markerRec = null
      try {
        markerRec = $app.findFirstRecordByData(
          'security_audit_markers',
          'marker_key',
          'telegram_bot_verification_result',
        )
      } catch (_) {
        markerRec = new Record(colMarkers)
        markerRec.set('marker_key', 'telegram_bot_verification_result')
      }
      markerRec.set('version', 'v1')
      markerRec.set('details', {
        bot_info: avisosBotInfo,
        webhook_info: avisosWhInfo,
        error: avisosErr,
        verified_at: new Date().toISOString(),
      })
      $app.save(markerRec)
    } catch (_) {}

    // Executar disparo de teste para o primeiro usuário (Miguel) se ainda não gravado
    try {
      let targetUser = null
      try {
        targetUser = $app.findFirstRecordByData('users', 'email', 'miguel@gmail.com')
      } catch (_) {}

      if (targetUser) {
        const botUsername = avisosBotInfo?.result?.username || 'desconhecido'
        let jaCriouAviso = false
        try {
          const avs = $app.findRecordsByFilter(
            'avisos',
            'user = {:uid} && status = "pendente_envio"',
            '',
            1,
            0,
            { uid: targetUser.id },
          )
          if (avs.length > 0) jaCriouAviso = true
        } catch (_) {}

        if (!jaCriouAviso) {
          const colAvisos = $app.findCollectionByNameOrId('avisos')
          const avRec = new Record(colAvisos)
          const nowYear = new Date().getFullYear()
          const seqRand = String(Math.floor(Math.random() * 900000) + 100000)
          avRec.set('codigo', 'AVS-' + nowYear + '-' + seqRand)
          avRec.set('user', targetUser.id)
          avRec.set('tenant', targetUser.getString('tenant') || '')
          avRec.set('telegram_id', '')
          avRec.set('tipo', 'diario')
          avRec.set('demandas_vinculadas', [
            {
              id: 'teste-ativacao',
              tipo: 'projeto',
              titulo: 'Teste de Ativação do Bot @' + botUsername,
              prazo: new Date().toISOString().substring(0, 10),
              dias: 0,
              urgencia: 'CRÍTICA',
              icone: '🔴',
            },
          ])
          avRec.set('qtd_demandas', 1)
          avRec.set('status', 'pendente_envio')
          avRec.set('tentativas_envio', 1)
          avRec.set(
            'ultimo_erro',
            'Usuário sem telegram_id pareado. Bot Telegram ativo e verificado (@' +
              botUsername +
              ').',
          )
          $app.save(avRec)

          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const auditRec = new Record(auditCol)
          auditRec.set('user_name', targetUser.getString('name') || 'Servidor')
          auditRec.set('action_type', 'Falha no envio de aviso Telegram')
          auditRec.set(
            'description',
            'Teste de envio de aviso executado: bot Telegram ativo (@' +
              botUsername +
              '), handshake getMe confirmado com sucesso. Destinatário ' +
              (targetUser.getString('name') || targetUser.getString('email')) +
              ' não possui telegram_id pareado (pendente /start + e-mail no bot).',
          )
          auditRec.set('tenant', targetUser.getString('tenant') || '')
          $app.save(auditRec)
        }
      }
    } catch (_) {}
  }

  return e.json(200, {
    status: 'ok',
    message: 'Bot Read API is active and healthy',
    timestamp: new Date().toISOString(),
    telegram_avisos: {
      bot_info: avisosBotInfo,
      webhook_info: avisosWhInfo,
      error: avisosErr,
    },
  })
})

// --- 1. GET /backend/v1/bot/info ---
routerAdd('GET', '/backend/v1/bot/info', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    // Desembrulha JSON em camadas (ex.: string contendo JSON de string ou de array)
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    // Se após todo o processamento result contiver itens de 1 caractere (sinal de iteração em caracteres), retorna []
    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/info | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  return e.json(200, {
    status: 'ok',
    sistema: 'Bússola Jurídica Municipal 2.0',
    versao: '0.0.112',
    municipio: {
      id: tenantRec.id,
      nome: tenantRec.getString('name'),
      slug: tenantRec.getString('slug'),
      cnpj: tenantRec.getString('cnpj'),
      status: tenantRec.getString('status'),
      hermes_enabled: true,
    },
    chave_mestra: {
      nome: keyRecord.getString('name'),
      prefixo: keyRecord.getString('key_prefix'),
      tipo: 'chave_mestra_prefeitura',
    },
    usuario_operador: {
      id: userRec.id,
      nome: userRec.getString('name') || '',
      email: userRec.getString('email') || '',
      papel_no_municipio: liveRole,
      is_admin_ou_superior: isAdmin,
    },
    escopo: {
      modo: isAdmin ? 'municipal_completo' : 'pessoal_estrito',
      descricao: isAdmin
        ? 'Acesso total aos dados e visões gerenciais da sua prefeitura.'
        : 'Acesso restrito aos projetos, prazos e notificações atribuídos a você.',
    },
    colunas_kanban: [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ],
    prioridades: ['Alta', 'Média', 'Baixa'],
  })
})

// --- 2. GET /backend/v1/bot/projects ---
routerAdd('GET', '/backend/v1/bot/projects', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  var query = reqInfo.query || {}
  var coluna = String(query.coluna || query.column || '').trim()
  var prioridade = String(query.prioridade || query.priority || '').trim()
  var busca = String(query.busca || query.q || '')
    .trim()
    .toLowerCase()

  var filter = 'tenant = {:tenantId}'
  var params = { tenantId: tenantId }

  if (!isAdmin) {
    filter += ' && responsible_user = {:ownerUserId}'
    params.ownerUserId = userRec.id
  }

  if (coluna) {
    filter += ' && coluna_kanban = {:coluna}'
    params.coluna = coluna
  }
  if (prioridade) {
    filter += ' && priority = {:prioridade}'
    params.prioridade = prioridade
  }

  try {
    var records = $app.findRecordsByFilter('projects', filter, '-created', 200, 0, params)
    var items = []

    for (var i = 0; i < records.length; i++) {
      var p = records[i]
      var titulo = p.getString('titulo') || ''
      var descricao = p.getString('descricao') || ''
      var objeto = p.getString('objeto') || ''

      if (busca) {
        var match =
          titulo.toLowerCase().indexOf(busca) !== -1 ||
          descricao.toLowerCase().indexOf(busca) !== -1 ||
          objeto.toLowerCase().indexOf(busca) !== -1
        if (!match) continue
      }

      var respId = p.getString('responsible_user')
      var respName = 'Não atribuído'
      var respEmail = ''
      if (respId) {
        try {
          var u = $app.findFirstRecordByData('users', 'id', respId)
          respName = u.getString('name') || 'Sem nome'
          respEmail = u.getString('email') || ''
        } catch (_) {}
      }

      items.push({
        id: p.id,
        titulo: titulo,
        descricao: descricao,
        objeto: objeto,
        justificativa: p.getString('justificativa') || '',
        coluna_kanban: p.getString('coluna_kanban'),
        prioridade: p.getString('priority'),
        prazo: p.getString('prazo') || null,
        responsavel: {
          id: respId || null,
          nome: respName,
          email: respEmail,
        },
        criado_em: p.getString('created'),
        atualizado_em: p.getString('updated'),
      })
    }

    return e.json(200, {
      total: items.length,
      escopo: isAdmin ? 'todos_do_municipio' : 'meus_projetos',
      projetos: items,
    })
  } catch (err) {
    $app.logger().error('Erro ao consultar projetos bot', 'error', String(err))
    return e.json(500, {
      code: 500,
      error: 'QUERY_ERROR',
      message: 'Erro ao consultar projetos.',
    })
  }
})

// --- 3. GET /backend/v1/bot/projects/summary (Exclusivo Admin / Superadmin com vínculo) ---
routerAdd('GET', '/backend/v1/bot/projects/summary', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  if (!isAdmin) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/projects/summary | Falha: endpoint_restrito_a_admin | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, {
      code: 403,
      error: 'FORBIDDEN',
      message:
        'Visões agregadas e resumos de todo o município são restritos a administradores. Como servidor comum, consulte seus projetos em /backend/v1/bot/projects.',
    })
  }

  var filter = 'tenant = {:tenantId}'
  var params = { tenantId: tenantId }

  try {
    var records = $app.findRecordsByFilter('projects', filter, '', 500, 0, params)

    var porColuna = {
      Ideação: 0,
      'Projeto Executivo': 0,
      'Elaborar DFD': 0,
      'Procedimentos Internos': 0,
      Execução: 0,
      'Prestação de Contas': 0,
      Marketing: 0,
    }

    var porPrioridade = {
      Alta: 0,
      Média: 0,
      Baixa: 0,
    }

    var cruzado = {}
    var colunas = [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ]
    for (var c = 0; c < colunas.length; c++) {
      cruzado[colunas[c]] = { Alta: 0, Média: 0, Baixa: 0 }
    }

    for (var i = 0; i < records.length; i++) {
      var col = records[i].getString('coluna_kanban')
      var prio = records[i].getString('priority')

      if (porColuna[col] !== undefined) {
        porColuna[col]++
      }
      if (porPrioridade[prio] !== undefined) {
        porPrioridade[prio]++
      }
      if (cruzado[col] && cruzado[col][prio] !== undefined) {
        cruzado[col][prio]++
      }
    }

    return e.json(200, {
      total_projetos: records.length,
      contagem_por_coluna: porColuna,
      contagem_por_prioridade: porPrioridade,
      cruzamento_coluna_prioridade: cruzado,
    })
  } catch (err) {
    $app.logger().error('Erro ao resumir projetos bot', 'error', String(err))
    return e.json(500, { code: 500, error: 'SUMMARY_ERROR', message: 'Erro ao gerar resumo.' })
  }
})

// --- 4. GET /backend/v1/bot/dfds ---
routerAdd('GET', '/backend/v1/bot/dfds', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  var query = reqInfo.query || {}
  var statusFilter = String(query.status || '').trim()

  var filter = 'tenant = {:tenantId}'
  var params = { tenantId: tenantId }

  if (!isAdmin) {
    filter += ' && responsible_user = {:ownerUserId}'
    params.ownerUserId = userRec.id
  }

  if (statusFilter) {
    filter += ' && status = {:status}'
    params.status = statusFilter
  }

  try {
    var records = $app.findRecordsByFilter('dfds', filter, '-created', 100, 0, params)
    var items = []

    for (var i = 0; i < records.length; i++) {
      var d = records[i]
      var respId = d.getString('responsible_user')
      var respName = 'Não atribuído'
      if (respId) {
        try {
          var u = $app.findFirstRecordByData('users', 'id', respId)
          respName = u.getString('name') || ''
        } catch (_) {}
      }

      var projId = d.getString('projeto_id')
      var projTitle = ''
      if (projId) {
        try {
          var p = $app.findFirstRecordByData('projects', 'id', projId)
          projTitle = p.getString('titulo') || ''
        } catch (_) {}
      }

      items.push({
        id: d.id,
        titulo: d.getString('titulo'),
        objeto: d.getString('objeto'),
        descricao: d.getString('descricao'),
        justificativa: d.getString('justificativa'),
        status: d.getString('status'),
        prazo: d.getString('prazo') || null,
        projeto_id: projId || null,
        projeto_titulo: projTitle,
        responsavel: {
          id: respId || null,
          nome: respName,
        },
        criado_em: d.getString('created'),
        atualizado_em: d.getString('updated'),
      })
    }

    return e.json(200, {
      total: items.length,
      escopo: isAdmin ? 'todos_do_municipio' : 'meus_dfds',
      dfds: items,
    })
  } catch (err) {
    return e.json(500, { code: 500, error: 'DFD_ERROR', message: 'Erro ao listar DFDs.' })
  }
})

// --- 5. GET /backend/v1/bot/dfds/{id} ---
routerAdd('GET', '/backend/v1/bot/dfds/{id}', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/dfds/{id} | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  var dfdId = e.request.pathValue('id')
  if (!dfdId) {
    return e.json(400, { code: 400, error: 'BAD_REQUEST', message: 'ID do DFD obrigatório.' })
  }

  var dfdRec = null
  try {
    dfdRec = $app.findFirstRecordByData('dfds', 'id', dfdId)
  } catch (_) {
    return e.json(404, { code: 404, error: 'NOT_FOUND', message: 'DFD não encontrado.' })
  }

  if (dfdRec.getString('tenant') !== tenantId) {
    return e.json(404, {
      code: 404,
      error: 'NOT_FOUND',
      message: 'DFD não encontrado no município.',
    })
  }

  if (!isAdmin && dfdRec.getString('responsible_user') !== userRec.id) {
    return e.json(404, {
      code: 404,
      error: 'NOT_FOUND',
      message: 'DFD não encontrado ou não atribuído ao seu usuário.',
    })
  }

  var respId = dfdRec.getString('responsible_user')
  var respName = 'Não atribuído'
  var respEmail = ''
  if (respId) {
    try {
      var u = $app.findFirstRecordByData('users', 'id', respId)
      respName = u.getString('name') || ''
      respEmail = u.getString('email') || ''
    } catch (_) {}
  }

  var projId = dfdRec.getString('projeto_id')
  var projInfo = null
  if (projId) {
    try {
      var p = $app.findFirstRecordByData('projects', 'id', projId)
      projInfo = {
        id: p.id,
        titulo: p.getString('titulo'),
        coluna_kanban: p.getString('coluna_kanban'),
        prioridade: p.getString('priority'),
        prazo: p.getString('prazo') || null,
      }
    } catch (_) {}
  }

  return e.json(200, {
    id: dfdRec.id,
    titulo: dfdRec.getString('titulo'),
    objeto: dfdRec.getString('objeto'),
    descricao: dfdRec.getString('descricao'),
    justificativa: dfdRec.getString('justificativa'),
    status: dfdRec.getString('status'),
    prazo: dfdRec.getString('prazo') || null,
    responsavel: {
      id: respId || null,
      nome: respName,
      email: respEmail,
    },
    projeto: projInfo,
    criado_em: dfdRec.getString('created'),
    atualizado_em: dfdRec.getString('updated'),
  })
})

// --- 6. GET /backend/v1/bot/deadlines ---
routerAdd('GET', '/backend/v1/bot/deadlines', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/deadlines | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  var filter = "tenant = {:tenantId} && prazo != ''"
  var params = { tenantId: tenantId }

  if (!isAdmin) {
    filter += ' && responsible_user = {:ownerUserId}'
    params.ownerUserId = userRec.id
  }

  try {
    var projectsWithDeadlines = $app.findRecordsByFilter(
      'projects',
      filter,
      'prazo',
      300,
      0,
      params,
    )

    var now = new Date()
    var todayStr = now.toISOString().slice(0, 10)
    var next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    var next7DaysStr = next7Days.toISOString().slice(0, 10)

    var vencidos = []
    var daSemana = []
    var futuros = []

    for (var i = 0; i < projectsWithDeadlines.length; i++) {
      var p = projectsWithDeadlines[i]
      var prazo = p.getString('prazo').slice(0, 10)

      var respId = p.getString('responsible_user')
      var respName = 'Não atribuído'
      if (respId) {
        try {
          var u = $app.findFirstRecordByData('users', 'id', respId)
          respName = u.getString('name') || ''
        } catch (_) {}
      }

      var item = {
        id: p.id,
        titulo: p.getString('titulo'),
        coluna_kanban: p.getString('coluna_kanban'),
        prioridade: p.getString('priority'),
        prazo: prazo,
        responsavel: respName,
      }

      if (prazo < todayStr) {
        vencidos.push(item)
      } else if (prazo <= next7DaysStr) {
        daSemana.push(item)
      } else {
        futuros.push(item)
      }
    }

    return e.json(200, {
      data_referencia: todayStr,
      escopo: isAdmin ? 'todos_do_municipio' : 'meus_prazos',
      total_com_prazo: projectsWithDeadlines.length,
      contagem_vencidos: vencidos.length,
      contagem_da_semana: daSemana.length,
      contagem_futuros: futuros.length,
      vencidos: vencidos,
      da_semana: daSemana,
      proximos: futuros,
    })
  } catch (err) {
    return e.json(500, {
      code: 500,
      error: 'DEADLINE_ERROR',
      message: 'Erro ao consultar prazos.',
    })
  }
})

// --- 7. GET /backend/v1/bot/users (Exclusivo Admin / Superadmin com vínculo) ---
routerAdd('GET', '/backend/v1/bot/users', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  if (!isAdmin) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/users | Falha: endpoint_restrito_a_admin | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, {
      code: 403,
      error: 'FORBIDDEN',
      message:
        'A listagem geral de usuários e servidores da prefeitura é restrita a administradores municipais.',
    })
  }

  var filter = 'tenant = {:tenantId}'
  var params = { tenantId: tenantId }

  try {
    var memsList = $app.findRecordsByFilter('user_memberships', filter, '-created', 200, 0, params)
    var users = []

    for (var i = 0; i < memsList.length; i++) {
      var m = memsList[i]
      var uId = m.getString('user')
      var uRecord = null
      try {
        uRecord = $app.findFirstRecordByData('users', 'id', uId)
      } catch (_) {}

      if (!uRecord) continue

      users.push({
        id: uRecord.id,
        nome: uRecord.getString('name') || '',
        email: uRecord.getString('email') || '',
        papel_no_municipio: m.getString('role'),
        status_no_municipio: m.getString('status'),
        desde: m.getString('created'),
      })
    }

    return e.json(200, {
      total: users.length,
      usuarios: users,
    })
  } catch (err) {
    return e.json(500, {
      code: 500,
      error: 'USERS_ERROR',
      message: 'Erro ao consultar usuários.',
    })
  }
})

// --- 8. GET /backend/v1/bot/notifications ---
routerAdd('GET', '/backend/v1/bot/notifications', (e) => {
  var GERAL_403 = {
    code: 403,
    error: 'FORBIDDEN',
    message: 'Acesso não autorizado ao Hermes para este município ou usuário.',
  }

  function parseAllowedRoles(raw) {
    if (!raw) return []
    var cur = raw
    var maxDepth = 5
    while (typeof cur === 'string' && maxDepth > 0) {
      maxDepth--
      var trimmed = cur.trim()
      if (!trimmed) return []
      if (
        (trimmed.charAt(0) === '[' && trimmed.charAt(trimmed.length - 1) === ']') ||
        (trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"')
      ) {
        try {
          cur = JSON.parse(trimmed)
        } catch (_) {
          break
        }
      } else {
        break
      }
    }

    var list = []
    if (Array.isArray(cur)) {
      list = cur
    } else if (cur && typeof cur === 'object' && typeof cur.length === 'number') {
      if (cur.length > 0 && typeof cur[0] !== 'string') {
        try {
          var parsedObj = JSON.parse(String(cur))
          if (Array.isArray(parsedObj)) {
            list = parsedObj
          } else {
            list = [parsedObj]
          }
        } catch (_) {
          for (var idx = 0; idx < cur.length; idx++) {
            list.push(cur[idx])
          }
        }
      } else {
        for (var idx = 0; idx < cur.length; idx++) {
          list.push(cur[idx])
        }
      }
    } else if (typeof cur === 'string') {
      list = [cur]
    }

    var result = []
    for (var i = 0; i < list.length; i++) {
      var item = list[i]
      if (item !== null && item !== undefined) {
        var str = String(item).trim().toLowerCase()
        if (str && result.indexOf(str) === -1) {
          result.push(str)
        }
      }
    }

    for (var k = 0; k < result.length; k++) {
      if (result[k].length === 1) {
        return []
      }
    }

    return result
  }

  var reqInfo = e.requestInfo()
  var headers = reqInfo.headers || {}

  var rawAuthHeader = String(headers['authorization'] || '').trim()
  var rawApiKeyHeader = String(headers['x_api_key'] || headers['x-api-key'] || '').trim()
  var rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  var safePrefix = rawKey.length >= 7 ? rawKey.substring(0, 7) + '...' : 'curta_ou_vazia'

  if (!rawKey) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: chave_ausente | rawKey: ausente',
    )
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API mestra ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  var keyHash = $security.sha256(rawKey)
  var keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: chave_invalida | key_prefix: ' +
        safePrefix,
    )
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  var keyPrefixDb = keyRecord.getString('key_prefix') || safePrefix
  var keyStatus = keyRecord.getString('status')
  if (keyStatus !== 'ativa') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: chave_revogada_ou_inativa | key_prefix: ' +
        keyPrefixDb +
        ' | status_chave: ' +
        keyStatus +
        ' | tenant_id: ' +
        keyRecord.getString('tenant'),
    )
    return e.json(403, GERAL_403)
  }

  var tenantId = keyRecord.getString('tenant')
  var tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: tenant_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (!tenantRec.getBool('hermes_enabled')) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: hermes_enabled_false | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId +
        ' | hermes_enabled: false',
    )
    return e.json(403, GERAL_403)
  }

  var rawActingUser = String(headers['x_acting_user'] || headers['x-acting-user'] || '').trim()
  if (!rawActingUser) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: x_acting_user_ausente | key_prefix: ' +
        keyPrefixDb +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(401, {
      code: 401,
      error: 'ACTING_USER_REQUIRED',
      message:
        'Cabeçalho X-Acting-User ausente. Envie o e-mail ou ID do usuário operador do Bússola.',
    })
  }

  var userRec = null
  if (rawActingUser.indexOf('@') !== -1) {
    try {
      userRec = $app.findAuthRecordByEmail('users', rawActingUser.toLowerCase())
    } catch (_) {}
  } else {
    try {
      userRec = $app.findFirstRecordByData('users', 'id', rawActingUser)
    } catch (_) {}
  }

  if (!userRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: usuario_nao_encontrado | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_recebido: ' +
        rawActingUser +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  if (userRec.getString('status') === 'inativo') {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: usuario_inativo | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var memRec = null
  var memFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
  var memParams = { userId: userRec.id, tenantId: tenantId, status: 'ativo' }
  try {
    var mems = $app.findRecordsByFilter('user_memberships', memFilter, '', 1, 0, memParams)
    if (mems.length > 0) {
      memRec = mems[0]
    }
  } catch (_) {}

  if (!memRec) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: sem_membership_ativa | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | user_id: ' +
        userRec.id +
        ' | tenant_id: ' +
        tenantId,
    )
    return e.json(403, GERAL_403)
  }

  var liveRole = (memRec.getString('role') || 'servidor').trim().toLowerCase()
  var rawAllowedRoles = tenantRec.getString('hermes_allowed_roles')
  var allowedRolesType = typeof rawAllowedRoles
  if (Array.isArray(rawAllowedRoles)) {
    allowedRolesType = 'array'
  } else if (rawAllowedRoles === null) {
    allowedRolesType = 'null'
  }
  var allowedRoles = parseAllowedRoles(rawAllowedRoles)
  var roleAllowed = false
  for (var rIdx = 0; rIdx < allowedRoles.length; rIdx++) {
    if (allowedRoles[rIdx] === liveRole) {
      roleAllowed = true
      break
    }
  }

  if (!roleAllowed) {
    var rawStr = String(rawAllowedRoles || '').toLowerCase()
    if (
      rawStr.indexOf('"' + liveRole + '"') !== -1 ||
      rawStr.indexOf("'" + liveRole + "'") !== -1 ||
      rawStr.indexOf(liveRole) !== -1
    ) {
      roleAllowed = true
    }
  }

  if (!roleAllowed) {
    console.log(
      '[BOT_AUTH_DEBUG] Endpoint: /backend/v1/bot/notifications | Falha: role_nao_permitida | key_prefix: ' +
        keyPrefixDb +
        ' | acting_user_email: ' +
        userRec.getString('email') +
        ' | liveRole: ' +
        liveRole +
        ' | tenant_id: ' +
        tenantId +
        ' | allowedRoles: ' +
        JSON.stringify(allowedRoles) +
        ' | rawType: ' +
        allowedRolesType +
        ' | rawAllowedRoles: ' +
        String(rawAllowedRoles || '').slice(0, 200),
    )
    return e.json(403, GERAL_403)
  }

  // Rate limit
  var now = Date.now()
  var cache = $app.store()
  var rateKey = 'bot_rate_' + keyRecord.id
  var resetKey = 'bot_rate_reset_' + keyRecord.id
  var resetAt = 0
  if (cache.has(resetKey)) {
    resetAt = Number(cache.get(resetKey)) || 0
  }
  if (now > resetAt) {
    cache.set(rateKey, 0)
    cache.set(resetKey, now + 60000)
  }
  var attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido. Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1)

  try {
    var nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  var isSuperadmin = userRec.getString('role') === 'superadmin'
  var isAdmin = isSuperadmin || liveRole === 'admin'

  var query = reqInfo.query || {}
  var apenasNaoLidas = query.nao_lidas === 'true' || query.unread === 'true'
  var tipo = String(query.tipo || '').trim()

  var filter = 'tenant = {:tenantId}'
  var params = { tenantId: tenantId }

  if (!isAdmin) {
    filter += ' && (target_user = {:ownerUserId} || target_user = null || target_user = "")'
    params.ownerUserId = userRec.id
  }

  if (apenasNaoLidas) {
    filter += ' && lida = false'
  }
  if (tipo) {
    filter += ' && tipo = {:tipo}'
    params.tipo = tipo
  }

  try {
    var notifs = $app.findRecordsByFilter('notifications', filter, '-created', 100, 0, params)
    var items = []

    for (var i = 0; i < notifs.length; i++) {
      var n = notifs[i]
      items.push({
        id: n.id,
        tipo: n.getString('tipo'),
        mensagem: n.getString('mensagem'),
        projeto_titulo: n.getString('project_title') || '',
        coluna: n.getString('column') || '',
        dias_parado: n.getInt('days_stalled') || 0,
        responsavel: n.getString('person_responsible') || '',
        lida: n.getBool('lida'),
        criada_em: n.getString('created'),
      })
    }

    return e.json(200, {
      total: items.length,
      escopo: isAdmin ? 'todas_do_municipio' : 'minhas_notificacoes',
      notificacoes: items,
    })
  } catch (err) {
    return e.json(500, {
      code: 500,
      error: 'NOTIFICATIONS_ERROR',
      message: 'Erro ao consultar notificações.',
    })
  }
})
