// Endpoints de Gerenciamento de Chaves de API Mestras do Hermes
// Regra de Negócio Atualizada:
// - APENAS o superadmin gera e revoga chaves.
// - UMA chave mestra por prefeitura (tenant). Gerar nova revoga a anterior automaticamente.
// - O segredo bruto aparece UMA única vez na criação.
// - Requer que hermes_enabled seja true no município. Se false, bloqueia com 403 HERMES_DISABLED.

// 1. Criar/Gerar nova chave mestra para a prefeitura (exclusivo Superadmin)
routerAdd(
  'POST',
  '/backend/v1/bot-keys/create',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    var authId = auth.id
    var authRole = auth.getString('role')
    if (authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        error: 'FORBIDDEN',
        message:
          'Apenas superadministradores podem gerar chaves mestras de integração para prefeituras.',
      })
    }

    var body = e.requestInfo().body || {}
    var requestedTenant = String(body.tenant || '').trim()
    var name = String(body.name || '').trim() || 'Chave Mestra Hermes'

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para geração de chave de integração.',
      })
    }

    // Verificar se o município existe e se Hermes está ativado
    var tenantRec = null
    try {
      tenantRec = $app.findFirstRecordByData('tenants', 'id', requestedTenant)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    if (!tenantRec.getBool('hermes_enabled')) {
      return e.json(403, {
        code: 403,
        error: 'HERMES_DISABLED',
        message: 'A integração Hermes está desativada para esta prefeitura.',
      })
    }

    // Revogar qualquer chave anterior ativa deste tenant (regra: UMA chave mestra por prefeitura)
    var filterOld = "tenant = {:tenantId} && status = 'ativa'"
    var paramsOld = { tenantId: requestedTenant }
    try {
      var oldKeys = $app.findRecordsByFilter('bot_api_keys', filterOld, '', 50, 0, paramsOld)
      for (var k = 0; k < oldKeys.length; k++) {
        var oldK = oldKeys[k]
        oldK.set('status', 'revogada')
        $app.save(oldK)
      }
    } catch (_) {}

    // Gerar chave segura: prefixo "bjm_" seguido por 32 caracteres aleatórios
    var rawRandom = $security.randomString(32)
    var rawApiKey = 'bjm_' + rawRandom
    var keyHash = $security.sha256(rawApiKey)
    var keyPrefix = rawApiKey.slice(0, 10) + '...'

    try {
      var col = $app.findCollectionByNameOrId('bot_api_keys')
      var rec = new Record(col)
      rec.set('tenant', requestedTenant)
      rec.set('name', name)
      rec.set('key_hash', keyHash)
      rec.set('key_prefix', keyPrefix)
      rec.set('status', 'ativa')
      rec.set('created_by', authId)
      rec.set('user', authId)
      rec.set('role_snapshot', 'superadmin')
      $app.save(rec)

      return e.json(201, {
        id: rec.id,
        tenant: requestedTenant,
        tenant_name: tenantRec.getString('name'),
        name: rec.getString('name'),
        key_prefix: keyPrefix,
        raw_key: rawApiKey, // Retornada SOMENTE uma vez no create
        status: 'ativa',
        user: authId,
        user_name: auth.getString('name') || auth.getString('email'),
        role: 'superadmin',
        created: rec.getString('created'),
      })
    } catch (err) {
      $app.logger().error('Erro ao criar chave bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao criar chave de integração.' })
    }
  },
  $apis.requireAuth(),
)

// 2. Listar chaves do município (Apenas Superadmin)
routerAdd(
  'GET',
  '/backend/v1/bot-keys/list',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    var authRole = auth.getString('role')
    if (authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        error: 'FORBIDDEN',
        message: 'Apenas o superadministrador tem acesso à gestão de chaves mestras de integração.',
      })
    }

    var query = e.requestInfo().query || {}
    var requestedTenant = String(query.tenant || '').trim()

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para consultar chaves.',
      })
    }

    // Verificar se o município existe
    var tenantRec = null
    try {
      tenantRec = $app.findFirstRecordByData('tenants', 'id', requestedTenant)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    if (!tenantRec.getBool('hermes_enabled')) {
      return e.json(403, {
        code: 403,
        error: 'HERMES_DISABLED',
        message: 'A integração Hermes está desativada para esta prefeitura.',
      })
    }

    try {
      var filter = 'tenant = {:tenantId}'
      var params = { tenantId: requestedTenant }
      var records = $app.findRecordsByFilter('bot_api_keys', filter, '-created', 50, 0, params)

      var items = []
      for (var i = 0; i < records.length; i++) {
        var r = records[i]
        items.push({
          id: r.id,
          tenant: r.getString('tenant'),
          name: r.getString('name'),
          key_prefix: r.getString('key_prefix'),
          status: r.getString('status'),
          user: r.getString('user') || r.getString('created_by'),
          role_snapshot: r.getString('role_snapshot') || 'superadmin',
          last_used_at: r.getString('last_used_at') || null,
          created: r.getString('created'),
          updated: r.getString('updated'),
        })
      }

      return e.json(200, items)
    } catch (err) {
      $app.logger().error('Erro ao listar bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao listar chaves.' })
    }
  },
  $apis.requireAuth(),
)

// 3. Revogar chave de API mestra (Apenas Superadmin)
routerAdd(
  'POST',
  '/backend/v1/bot-keys/revoke',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    var authRole = auth.getString('role')
    if (authRole !== 'superadmin') {
      return e.json(403, {
        code: 403,
        error: 'FORBIDDEN',
        message: 'Apenas o superadministrador pode revogar chaves mestras de integração.',
      })
    }

    var body = e.requestInfo().body || {}
    var keyId = String(body.id || body.keyId || '').trim()

    if (!keyId) {
      return e.json(400, { code: 400, message: 'ID da chave é obrigatório.' })
    }

    var keyRec = null
    try {
      keyRec = $app.findFirstRecordByData('bot_api_keys', 'id', keyId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Chave de integração não encontrada.' })
    }

    var targetTenant = keyRec.getString('tenant')
    var tenantRec = null
    try {
      tenantRec = $app.findFirstRecordByData('tenants', 'id', targetTenant)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    if (!tenantRec.getBool('hermes_enabled')) {
      return e.json(403, {
        code: 403,
        error: 'HERMES_DISABLED',
        message: 'A integração Hermes está desativada para esta prefeitura.',
      })
    }

    try {
      keyRec.set('status', 'revogada')
      $app.save(keyRec)
      return e.json(200, {
        success: true,
        id: keyRec.id,
        status: 'revogada',
        message: 'Chave mestra revogada com sucesso.',
      })
    } catch (err) {
      $app.logger().error('Erro ao revogar chave bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao revogar chave.' })
    }
  },
  $apis.requireAuth(),
)
