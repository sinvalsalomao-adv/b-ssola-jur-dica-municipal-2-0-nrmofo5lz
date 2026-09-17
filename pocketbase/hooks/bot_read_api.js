// API de Integração com Bot (Hermes): Endpoints somente leitura estruturados em JSON
// Autenticação exclusiva por Chave de API de Município (Authorization: Bearer <chave> ou X-API-Key: <chave>)
// O município é estritamente derivado da chave — nenhum parâmetro de tenant externo é aceito.

// Helper local por rota para autenticação da chave e rate limit
// Endpoints:
// 1. GET /backend/v1/bot/info
// 2. GET /backend/v1/bot/projects
// 3. GET /backend/v1/bot/projects/summary
// 4. GET /backend/v1/bot/dfds
// 5. GET /backend/v1/bot/dfds/{id}
// 6. GET /backend/v1/bot/deadlines
// 7. GET /backend/v1/bot/users
// 8. GET /backend/v1/bot/notifications

// --- 1. BOT INFO & CONTEXT ---
routerAdd('GET', '/backend/v1/bot/info', (e) => {
  // Autenticação da chave
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, {
      code: 403,
      error: 'KEY_REVOKED',
      message: 'Esta chave de API foi revogada ou desativada.',
    })
  }

  // Rate limit: 60 requisições por minuto por chave
  const ip = e.remoteIP()
  const cache = $app.store()
  const rateKey = 'bot_rate_' + keyRecord.id
  let attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, {
      code: 429,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Limite de requisições excedido (máximo 60 por minuto). Aguarde um instante.',
    })
  }
  cache.set(rateKey, attempts + 1, 60)

  // Atualizar last_used_at
  try {
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  const tenantId = keyRecord.getString('tenant')
  let tenantRec = null
  try {
    tenantRec = $app.findFirstRecordByData('tenants', 'id', tenantId)
  } catch (_) {
    return e.json(404, {
      code: 404,
      error: 'TENANT_NOT_FOUND',
      message: 'Município associado à chave não encontrado.',
    })
  }

  return e.json(200, {
    status: 'ok',
    sistema: 'Bússola Jurídica Municipal 2.0',
    versao: '0.0.102',
    municipio: {
      id: tenantRec.id,
      nome: tenantRec.getString('name'),
      slug: tenantRec.getString('slug'),
      cnpj: tenantRec.getString('cnpj'),
      status: tenantRec.getString('status'),
    },
    chave: {
      nome: keyRecord.getString('name'),
      prefixo: keyRecord.getString('key_prefix'),
      criada_em: keyRecord.getString('created'),
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

// --- 2. LISTAR PROJETOS DO TENANT (COM FILTROS POR COLUNA, PRIORIDADE, RESPONSÁVEL) ---
routerAdd('GET', '/backend/v1/bot/projects', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message:
        'Chave de API ausente. Forneça o header Authorization: Bearer <chave> ou X-API-Key: <chave>.',
    })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, {
      code: 401,
      error: 'INVALID_KEY',
      message: 'Chave de API inválida ou não reconhecida.',
    })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, {
      code: 403,
      error: 'KEY_REVOKED',
      message: 'Esta chave de API foi revogada ou desativada.',
    })
  }

  // Rate limit
  const cache = $app.store()
  const rateKey = 'bot_rate_' + keyRecord.id
  let attempts = 0
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
  cache.set(rateKey, attempts + 1, 60)

  try {
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19)
    keyRecord.set('last_used_at', nowIso)
    $app.save(keyRecord)
  } catch (_) {}

  const tenantId = keyRecord.getString('tenant')
  const query = reqInfo.query || {}
  const coluna = String(query.coluna || query.column || '').trim()
  const prioridade = String(query.prioridade || query.priority || '').trim()
  const busca = String(query.busca || query.q || '')
    .trim()
    .toLowerCase()

  let filter = 'tenant = {:tenantId}'
  const params = { tenantId: tenantId }

  if (coluna) {
    filter += ' && coluna_kanban = {:coluna}'
    params.coluna = coluna
  }
  if (prioridade) {
    filter += ' && priority = {:prioridade}'
    params.prioridade = prioridade
  }

  try {
    const records = $app.findRecordsByFilter('projects', filter, '-created', 200, 0, params)
    const items = []

    for (let i = 0; i < records.length; i++) {
      const p = records[i]
      const titulo = p.getString('titulo') || ''
      const descricao = p.getString('descricao') || ''
      const objeto = p.getString('objeto') || ''

      if (busca) {
        const match =
          titulo.toLowerCase().indexOf(busca) !== -1 ||
          descricao.toLowerCase().indexOf(busca) !== -1 ||
          objeto.toLowerCase().indexOf(busca) !== -1
        if (!match) continue
      }

      const respId = p.getString('responsible_user')
      let respName = 'Não atribuído'
      let respEmail = ''
      if (respId) {
        try {
          const u = $app.findFirstRecordByData('users', 'id', respId)
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
      projetos: items,
    })
  } catch (err) {
    $app.logger().error('Erro ao consultar projetos bot', 'error', String(err))
    return e.json(500, { code: 500, error: 'QUERY_ERROR', message: 'Erro ao consultar projetos.' })
  }
})

// --- 3. RESUMO / CONTAGEM DO KANBAN POR COLUNA E PRIORIDADE ---
routerAdd('GET', '/backend/v1/bot/projects/summary', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, {
      code: 401,
      error: 'UNAUTHORIZED',
      message: 'Chave de API ausente.',
    })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave de API inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave de API revogada.' })
  }

  // Rate limit
  const cache = $app.store()
  const rateKey = 'bot_rate_' + keyRecord.id
  let attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, { code: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite excedido.' })
  }
  cache.set(rateKey, attempts + 1, 60)

  const tenantId = keyRecord.getString('tenant')
  const filter = 'tenant = {:tenantId}'
  const params = { tenantId: tenantId }

  try {
    const records = $app.findRecordsByFilter('projects', filter, '', 500, 0, params)

    const porColuna = {
      Ideação: 0,
      'Projeto Executivo': 0,
      'Elaborar DFD': 0,
      'Procedimentos Internos': 0,
      Execução: 0,
      'Prestação de Contas': 0,
      Marketing: 0,
    }

    const porPrioridade = {
      Alta: 0,
      Média: 0,
      Baixa: 0,
    }

    // Matriz cruzada coluna x prioridade
    const cruzado = {}
    const colunas = [
      'Ideação',
      'Projeto Executivo',
      'Elaborar DFD',
      'Procedimentos Internos',
      'Execução',
      'Prestação de Contas',
      'Marketing',
    ]
    for (let c = 0; c < colunas.length; c++) {
      cruzado[colunas[c]] = { Alta: 0, Média: 0, Baixa: 0 }
    }

    for (let i = 0; i < records.length; i++) {
      const col = records[i].getString('coluna_kanban')
      const prio = records[i].getString('priority')

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

// --- 4. LISTAR DFDS DO TENANT ---
routerAdd('GET', '/backend/v1/bot/dfds', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' })
  }

  const cache = $app.store()
  const rateKey = 'bot_rate_' + keyRecord.id
  let attempts = 0
  if (cache.has(rateKey)) {
    attempts = Number(cache.get(rateKey)) || 0
  }
  if (attempts >= 60) {
    return e.json(429, { code: 429, error: 'RATE_LIMIT_EXCEEDED', message: 'Limite excedido.' })
  }
  cache.set(rateKey, attempts + 1, 60)

  const tenantId = keyRecord.getString('tenant')
  const query = reqInfo.query || {}
  const statusFilter = String(query.status || '').trim()

  let filter = 'tenant = {:tenantId}'
  const params = { tenantId: tenantId }

  if (statusFilter) {
    filter += ' && status = {:status}'
    params.status = statusFilter
  }

  try {
    const records = $app.findRecordsByFilter('dfds', filter, '-created', 100, 0, params)
    const items = []

    for (let i = 0; i < records.length; i++) {
      const d = records[i]
      const respId = d.getString('responsible_user')
      let respName = 'Não atribuído'
      if (respId) {
        try {
          const u = $app.findFirstRecordByData('users', 'id', respId)
          respName = u.getString('name') || ''
        } catch (_) {}
      }

      const projId = d.getString('projeto_id')
      let projTitle = ''
      if (projId) {
        try {
          const p = $app.findFirstRecordByData('projects', 'id', projId)
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
      dfds: items,
    })
  } catch (err) {
    return e.json(500, { code: 500, error: 'DFD_ERROR', message: 'Erro ao listar DFDs.' })
  }
})

// --- 5. DETALHE DE UM DFD POR ID (APENAS DO TENANT) ---
routerAdd('GET', '/backend/v1/bot/dfds/{id}', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' })
  }

  const dfdId = e.request.pathValue('id')
  if (!dfdId) {
    return e.json(400, { code: 400, error: 'BAD_REQUEST', message: 'ID do DFD obrigatório.' })
  }

  let dfdRec = null
  try {
    dfdRec = $app.findFirstRecordByData('dfds', 'id', dfdId)
  } catch (_) {
    return e.json(404, { code: 404, error: 'NOT_FOUND', message: 'DFD não encontrado.' })
  }

  // ISOLAMENTO RIGOROSO: Garantir que o DFD pertence ao mesmo tenant da chave
  if (dfdRec.getString('tenant') !== keyRecord.getString('tenant')) {
    return e.json(404, {
      code: 404,
      error: 'NOT_FOUND',
      message: 'DFD não encontrado no município.',
    })
  }

  const respId = dfdRec.getString('responsible_user')
  let respName = 'Não atribuído'
  let respEmail = ''
  if (respId) {
    try {
      const u = $app.findFirstRecordByData('users', 'id', respId)
      respName = u.getString('name') || ''
      respEmail = u.getString('email') || ''
    } catch (_) {}
  }

  const projId = dfdRec.getString('projeto_id')
  let projInfo = null
  if (projId) {
    try {
      const p = $app.findFirstRecordByData('projects', 'id', projId)
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

// --- 6. CONSULTAR PRAZOS DO TENANT (VENCIDOS, DA SEMANA, PRÓXIMOS) ---
routerAdd('GET', '/backend/v1/bot/deadlines', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' })
  }

  const tenantId = keyRecord.getString('tenant')
  const filter = "tenant = {:tenantId} && prazo != ''"
  const params = { tenantId: tenantId }

  try {
    const projectsWithDeadlines = $app.findRecordsByFilter(
      'projects',
      filter,
      'prazo',
      300,
      0,
      params,
    )

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const next7DaysStr = next7Days.toISOString().slice(0, 10)

    const vencidos = []
    const daSemana = []
    const futuros = []

    for (let i = 0; i < projectsWithDeadlines.length; i++) {
      const p = projectsWithDeadlines[i]
      const prazo = p.getString('prazo').slice(0, 10)

      const respId = p.getString('responsible_user')
      let respName = 'Não atribuído'
      if (respId) {
        try {
          const u = $app.findFirstRecordByData('users', 'id', respId)
          respName = u.getString('name') || ''
        } catch (_) {}
      }

      const item = {
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
      total_com_prazo: projectsWithDeadlines.length,
      contagem_vencidos: vencidos.length,
      contagem_da_semana: daSemana.length,
      contagem_futuros: futuros.length,
      vencidos: vencidos,
      da_semana: daSemana,
      proximos: futuros,
    })
  } catch (err) {
    return e.json(500, { code: 500, error: 'DEADLINE_ERROR', message: 'Erro ao consultar prazos.' })
  }
})

// --- 7. CONSULTAR USUÁRIOS / SERVIDORES DO TENANT COM PAPÉIS ---
routerAdd('GET', '/backend/v1/bot/users', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' })
  }

  const tenantId = keyRecord.getString('tenant')
  const filter = 'tenant = {:tenantId}'
  const params = { tenantId: tenantId }

  try {
    const mems = $app.findRecordsByFilter('user_memberships', filter, '-created', 200, 0, params)
    const users = []

    for (let i = 0; i < mems.length; i++) {
      const m = mems[i]
      const uId = m.getString('user')
      let uRec = null
      try {
        uRec = $app.findFirstRecordByData('users', 'id', uId)
      } catch (_) {}

      if (!uRec) continue

      users.push({
        id: uRec.id,
        nome: uRec.getString('name') || '',
        email: uRec.getString('email') || '',
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
    return e.json(500, { code: 500, error: 'USERS_ERROR', message: 'Erro ao consultar usuários.' })
  }
})

// --- 8. CONSULTAR NOTIFICAÇÕES E ALERTAS DO TENANT ---
routerAdd('GET', '/backend/v1/bot/notifications', (e) => {
  const reqInfo = e.requestInfo()
  const rawAuthHeader = String(reqInfo.headers['authorization'] || '').trim()
  const rawApiKeyHeader = String(reqInfo.headers['x_api_key'] || '').trim()
  let rawKey = ''
  if (rawApiKeyHeader) {
    rawKey = rawApiKeyHeader
  } else if (rawAuthHeader) {
    if (rawAuthHeader.toLowerCase().indexOf('bearer ') === 0) {
      rawKey = rawAuthHeader.slice(7).trim()
    } else {
      rawKey = rawAuthHeader
    }
  }

  if (!rawKey) {
    return e.json(401, { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' })
  }

  const keyHash = $security.sha256(rawKey)
  let keyRecord = null
  try {
    keyRecord = $app.findFirstRecordByData('bot_api_keys', 'key_hash', keyHash)
  } catch (_) {
    return e.json(401, { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' })
  }

  if (keyRecord.getString('status') !== 'ativa') {
    return e.json(403, { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' })
  }

  const tenantId = keyRecord.getString('tenant')
  const query = reqInfo.query || {}
  const apenasNaoLidas = query.nao_lidas === 'true' || query.unread === 'true'
  const tipo = String(query.tipo || '').trim()

  let filter = 'tenant = {:tenantId}'
  const params = { tenantId: tenantId }

  if (apenasNaoLidas) {
    filter += ' && lida = false'
  }
  if (tipo) {
    filter += ' && tipo = {:tipo}'
    params.tipo = tipo
  }

  try {
    const notifs = $app.findRecordsByFilter('notifications', filter, '-created', 100, 0, params)
    const items = []

    for (let i = 0; i < notifs.length; i++) {
      const n = notifs[i]
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
