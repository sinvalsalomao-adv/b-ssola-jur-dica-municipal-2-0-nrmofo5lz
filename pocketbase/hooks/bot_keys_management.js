// Endpoints de Gerenciamento de Chaves de API para Integração de Bot (Hermes)
// Apenas usuários autenticados com privilégio de Admin no município ou Superadmin podem gerenciar.

// 1. Criar/Gerar nova chave de API para o município
routerAdd(
  'POST',
  '/backend/v1/bot-keys/create',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const requestedTenant = String(body.tenant || '').trim()
    const name = String(body.name || '').trim() || 'Chave Hermes Telegram'

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para geração de chave de integração.',
      })
    }

    // Validação de privilégios: superadmin ou admin ativo no tenant
    if (authRole !== 'superadmin') {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: requestedTenant }
      try {
        const adminMems = $app.findRecordsByFilter(
          'user_memberships',
          checkFilter,
          '',
          1,
          0,
          checkParams,
        )
        if (adminMems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Apenas Administradores do município podem gerar chaves de integração.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios no município.' })
      }
    }

    // Verificar se o tenant existe
    try {
      $app.findFirstRecordByData('tenants', 'id', requestedTenant)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    // Gerar chave segura: prefixo "bjm_" seguido por 32 caracteres aleatórios
    const rawRandom = $security.randomString(32)
    const rawApiKey = 'bjm_' + rawRandom
    const keyHash = $security.sha256(rawApiKey)
    const keyPrefix = rawApiKey.slice(0, 10) + '...'

    try {
      const col = $app.findCollectionByNameOrId('bot_api_keys')
      const rec = new Record(col)
      rec.set('tenant', requestedTenant)
      rec.set('name', name)
      rec.set('key_hash', keyHash)
      rec.set('key_prefix', keyPrefix)
      rec.set('status', 'ativa')
      rec.set('created_by', authId)
      $app.save(rec)

      return e.json(201, {
        id: rec.id,
        tenant: requestedTenant,
        name: rec.getString('name'),
        key_prefix: keyPrefix,
        raw_key: rawApiKey, // Retornada SOMENTE uma vez no create
        status: 'ativa',
        created: rec.getString('created'),
      })
    } catch (err) {
      $app.logger().error('Erro ao criar chave bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao criar chave de integração.' })
    }
  },
  $apis.requireAuth(),
)

// 2. Listar chaves do município (retorna apenas prefixo mascarado, nunca a chave crua)
routerAdd(
  'GET',
  '/backend/v1/bot-keys/list',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const query = e.requestInfo().query || {}
    const requestedTenant = String(query.tenant || '').trim()

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para consultar chaves.',
      })
    }

    if (authRole !== 'superadmin') {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: requestedTenant }
      try {
        const adminMems = $app.findRecordsByFilter(
          'user_memberships',
          checkFilter,
          '',
          1,
          0,
          checkParams,
        )
        if (adminMems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Apenas Administradores do município podem visualizar chaves.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios.' })
      }
    }

    try {
      const filter = 'tenant = {:tenantId}'
      const params = { tenantId: requestedTenant }
      const records = $app.findRecordsByFilter('bot_api_keys', filter, '-created', 100, 0, params)

      const items = []
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        items.push({
          id: r.id,
          tenant: r.getString('tenant'),
          name: r.getString('name'),
          key_prefix: r.getString('key_prefix'),
          status: r.getString('status'),
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

// 3. Revogar chave de API
routerAdd(
  'POST',
  '/backend/v1/bot-keys/revoke',
  (e) => {
    const auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    const authId = auth.id
    const authRole = auth.getString('role')
    const body = e.requestInfo().body || {}
    const keyId = String(body.id || body.keyId || '').trim()

    if (!keyId) {
      return e.json(400, { code: 400, message: 'ID da chave é obrigatório.' })
    }

    let keyRec = null
    try {
      keyRec = $app.findFirstRecordByData('bot_api_keys', 'id', keyId)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Chave de integração não encontrada.' })
    }

    const targetTenant = keyRec.getString('tenant')

    if (authRole !== 'superadmin') {
      const checkFilter =
        "user = {:userId} && tenant = {:tenantId} && role = 'admin' && status = 'ativo'"
      const checkParams = { userId: authId, tenantId: targetTenant }
      try {
        const adminMems = $app.findRecordsByFilter(
          'user_memberships',
          checkFilter,
          '',
          1,
          0,
          checkParams,
        )
        if (adminMems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Você não possui permissão para revogar chaves deste município.',
          })
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios.' })
      }
    }

    try {
      keyRec.set('status', 'revogada')
      $app.save(keyRec)
      return e.json(200, {
        success: true,
        id: keyRec.id,
        status: 'revogada',
        message: 'Chave revogada com sucesso.',
      })
    } catch (err) {
      $app.logger().error('Erro ao revogar chave bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao revogar chave.' })
    }
  },
  $apis.requireAuth(),
)
