// Endpoints de Gerenciamento de Chaves de API para Integração de Bot (Hermes)
// Acesso RBAC: Superadmin global com município, Admin municipal ativo, ou Usuário Comum ativo no município.
// Cada chave emitida é estritamente vinculada ao usuário autenticado, ao município selecionado e armazena o snapshot do papel.

// 1. Criar/Gerar nova chave de API vinculada ao usuário autenticado e município
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
    var body = e.requestInfo().body || {}
    var requestedTenant = String(body.tenant || '').trim()
    var name = String(body.name || '').trim() || 'Chave Hermes Telegram'

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para geração de chave de integração.',
      })
    }

    // Verificar se o município existe e está ativo
    var tenantRec = null
    try {
      tenantRec = $app.findFirstRecordByData('tenants', 'id', requestedTenant)
    } catch (_) {
      return e.json(404, { code: 404, message: 'Município não encontrado.' })
    }

    // Validação de acesso RBAC no município:
    // (1) Se for superadmin: só pode gerar se tiver vínculo de membership ativo com o tenant
    // (Decisão do usuário: superadmin sem vínculo não deve ter chave de prefeitura nenhuma)
    // (2) Para qualquer outro usuário: precisa ter vínculo membership ativo no tenant
    var membershipRec = null
    var checkFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
    var checkParams = { userId: authId, tenantId: requestedTenant, status: 'ativo' }
    try {
      var mems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0, checkParams)
      if (mems.length > 0) {
        membershipRec = mems[0]
      }
    } catch (_) {}

    if (!membershipRec) {
      if (authRole === 'superadmin') {
        return e.json(403, {
          code: 403,
          message:
            'Superadministrador sem vínculo municipal ativo não pode emitir chave para este município.',
        })
      }
      return e.json(403, {
        code: 403,
        message:
          'Você não possui vínculo ativo com este município para gerar chaves de integração.',
      })
    }

    var effectiveRole = membershipRec.getString('role') || 'servidor'
    if (authRole === 'superadmin') {
      // Se for superadmin no auth mas tiver membership ativa no tenant, o papel no tenant é o da membership (ou admin)
      if (effectiveRole !== 'admin') {
        effectiveRole = 'admin'
      }
    }

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
      rec.set('role_snapshot', effectiveRole)
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
        role: effectiveRole,
        created: rec.getString('created'),
      })
    } catch (err) {
      $app.logger().error('Erro ao criar chave bot_api_keys', 'error', String(err))
      return e.json(500, { code: 500, message: 'Erro ao criar chave de integração.' })
    }
  },
  $apis.requireAuth(),
)

// 2. Listar chaves do município ou do usuário autenticado
// Admin vê todas as chaves do município; Servidor comum vê apenas as suas próprias chaves
routerAdd(
  'GET',
  '/backend/v1/bot-keys/list',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    var authId = auth.id
    var authRole = auth.getString('role')
    var query = e.requestInfo().query || {}
    var requestedTenant = String(query.tenant || '').trim()

    if (!requestedTenant) {
      return e.json(400, {
        code: 400,
        message: 'Parâmetro tenant é obrigatório para consultar chaves.',
      })
    }

    // Verificar membership ativa no tenant
    var isTenantAdmin = false
    if (authRole === 'superadmin') {
      // Superadmin tem privilégio de admin caso possua membership ativa
      var saFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
      var saParams = { userId: authId, tenantId: requestedTenant, status: 'ativo' }
      try {
        var saMems = $app.findRecordsByFilter('user_memberships', saFilter, '', 1, 0, saParams)
        if (saMems.length > 0) {
          isTenantAdmin = true
        }
      } catch (_) {}
    } else {
      var checkFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
      var checkParams = { userId: authId, tenantId: requestedTenant, status: 'ativo' }
      try {
        var mems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0, checkParams)
        if (mems.length === 0) {
          return e.json(403, {
            code: 403,
            message: 'Você não possui vínculo ativo com este município.',
          })
        }
        var mRole = mems[0].getString('role')
        if (mRole === 'admin') {
          isTenantAdmin = true
        }
      } catch (_) {
        return e.json(403, { code: 403, message: 'Erro ao validar privilégios.' })
      }
    }

    try {
      var filter = 'tenant = {:tenantId}'
      var params = { tenantId: requestedTenant }

      // Se não for admin do município, restringe estritamente às chaves emitidas por este usuário
      if (!isTenantAdmin) {
        filter += ' && user = {:userId}'
        params.userId = authId
      }

      var records = $app.findRecordsByFilter('bot_api_keys', filter, '-created', 100, 0, params)

      var items = []
      for (var i = 0; i < records.length; i++) {
        var r = records[i]
        var keyUserId = r.getString('user') || r.getString('created_by')
        var keyUserName = ''
        var keyUserEmail = ''
        if (keyUserId) {
          try {
            var uRec = $app.findFirstRecordByData('users', 'id', keyUserId)
            keyUserName = uRec.getString('name') || ''
            keyUserEmail = uRec.getString('email') || ''
          } catch (_) {}
        }

        items.push({
          id: r.id,
          tenant: r.getString('tenant'),
          name: r.getString('name'),
          key_prefix: r.getString('key_prefix'),
          status: r.getString('status'),
          user: keyUserId || null,
          user_name: keyUserName,
          user_email: keyUserEmail,
          role_snapshot: r.getString('role_snapshot') || null,
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
// Admin pode revogar qualquer chave do seu município; usuário comum pode revogar apenas as suas próprias
routerAdd(
  'POST',
  '/backend/v1/bot-keys/revoke',
  (e) => {
    var auth = e.auth
    if (!auth) {
      return e.json(401, { code: 401, message: 'Autenticação necessária.' })
    }

    var authId = auth.id
    var authRole = auth.getString('role')
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
    var keyOwnerId = keyRec.getString('user') || keyRec.getString('created_by')

    // Se o usuário atual for o dono da chave, ele tem permissão para revogar a sua própria
    var isOwner = keyOwnerId === authId

    // Caso não seja o dono, precisa ser admin ativo do município ou superadmin com vínculo
    if (!isOwner) {
      var isTenantAdmin = false
      var checkFilter = 'user = {:userId} && tenant = {:tenantId} && status = {:status}'
      var checkParams = { userId: authId, tenantId: targetTenant, status: 'ativo' }
      try {
        var mems = $app.findRecordsByFilter('user_memberships', checkFilter, '', 1, 0, checkParams)
        if (mems.length > 0) {
          if (authRole === 'superadmin' || mems[0].getString('role') === 'admin') {
            isTenantAdmin = true
          }
        }
      } catch (_) {}

      if (!isTenantAdmin) {
        return e.json(403, {
          code: 403,
          message: 'Você não possui permissão para revogar esta chave de integração.',
        })
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
