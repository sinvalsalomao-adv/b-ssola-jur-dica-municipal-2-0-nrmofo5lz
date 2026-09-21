/**
 * Testes automatizados da API de Integração com Bot (Hermes) v0.0.109:
 * Modelo Atualizado:
 * - Apenas o superadmin gera chaves: uma chave mestra por prefeitura
 * - A API aceita o cabeçalho X-Acting-User (e-mail ou ID do usuário no Bússola)
 * - Aplicação de permissões ao vivo no banco:
 *   * Chave mestra sem X-Acting-User -> 401
 *   * Com X-Acting-User admin -> visão completa da prefeitura
 *   * Com X-Acting-User comum -> estritamente o que é dele + 403 nas visões gerais
 *   * X-Acting-User de outro tenant -> negado (403)
 *   * Hermes desativado (hermes_enabled = false) -> 403 HERMES_DISABLED
 *   * Isolamento rigoroso entre prefeituras
 */

export interface BotIntegrationTestResult {
  passed: boolean
  total: number
  failedCount: number
  results: {
    testName: string
    passed: boolean
    error?: string
  }[]
}

export function runBotIntegrationTests(): BotIntegrationTestResult {
  const results: { testName: string; passed: boolean; error?: string }[] = []

  function assert(testName: string, condition: boolean, errorMsg?: string) {
    if (condition) {
      results.push({ testName, passed: true })
    } else {
      results.push({
        testName,
        passed: false,
        error: errorMsg || 'Assertion failed',
      })
    }
  }

  // Modelagem para simulação em memória
  interface MockTenant {
    id: string
    name: string
    hermes_enabled: boolean
  }

  interface MockMasterKey {
    id: string
    tenant: string
    key_hash: string
    status: 'ativa' | 'revogada'
    name: string
  }

  interface MockUser {
    id: string
    email: string
    name: string
    role: 'superadmin' | 'user'
    status: 'ativo' | 'inativo'
  }

  interface MockMembership {
    id: string
    user: string
    tenant: string
    role: 'admin' | 'servidor' | 'superadmin'
    status: 'ativo' | 'pendente'
  }

  interface MockProject {
    id: string
    tenant: string
    titulo: string
    coluna_kanban: string
    priority: string
    prazo: string | null
    responsible_user: string | null
  }

  interface MockDfd {
    id: string
    tenant: string
    titulo: string
    status: string
    responsible_user: string | null
  }

  // Tenants fictícios
  const mockTenants: Record<string, MockTenant> = {
    tenant_sao_jose: { id: 'tenant_sao_jose', name: 'São José', hermes_enabled: true },
    tenant_rio_claro: { id: 'tenant_rio_claro', name: 'Rio Claro', hermes_enabled: true },
    tenant_desativado: {
      id: 'tenant_desativado',
      name: 'Prefeitura Sem Hermes',
      hermes_enabled: false,
    },
  }

  // Usuários fictícios
  const mockUsers: MockUser[] = [
    {
      id: 'usr_admin_sj',
      email: 'admin@saojose.gov.br',
      name: 'Admin SJ',
      role: 'user',
      status: 'ativo',
    },
    {
      id: 'usr_servidor_sj',
      email: 'servidor@saojose.gov.br',
      name: 'Servidor SJ',
      role: 'user',
      status: 'ativo',
    },
    {
      id: 'usr_admin_rc',
      email: 'admin@rioclaro.gov.br',
      name: 'Admin RC',
      role: 'user',
      status: 'ativo',
    },
    {
      id: 'usr_inativo_sj',
      email: 'inativo@saojose.gov.br',
      name: 'Inativo SJ',
      role: 'user',
      status: 'inativo',
    },
  ]

  // Vínculos
  const mockMemberships: MockMembership[] = [
    { id: 'm1', user: 'usr_admin_sj', tenant: 'tenant_sao_jose', role: 'admin', status: 'ativo' },
    {
      id: 'm2',
      user: 'usr_servidor_sj',
      tenant: 'tenant_sao_jose',
      role: 'servidor',
      status: 'ativo',
    },
    { id: 'm3', user: 'usr_admin_rc', tenant: 'tenant_rio_claro', role: 'admin', status: 'ativo' },
    {
      id: 'm4',
      user: 'usr_inativo_sj',
      tenant: 'tenant_sao_jose',
      role: 'servidor',
      status: 'ativo',
    },
  ]

  // Chaves Mestras por prefeitura
  const KEY_MESTRA_SJ_RAW = 'bjm_master_key_sao_jose_11111111'
  const KEY_MESTRA_RC_RAW = 'bjm_master_key_rio_claro_22222222'
  const KEY_MESTRA_DESATIVADO_RAW = 'bjm_master_key_desativado_33333333'
  const KEY_REVOGADA_RAW = 'bjm_master_key_revogada_44444444'

  function simpleHash(val: string): string {
    let hash = 0
    for (let i = 0; i < val.length; i++) {
      hash = (hash << 5) - hash + val.charCodeAt(i)
      hash |= 0
    }
    return 'hash_' + hash
  }

  const mockDbKeys: MockMasterKey[] = [
    {
      id: 'k_sj',
      tenant: 'tenant_sao_jose',
      key_hash: simpleHash(KEY_MESTRA_SJ_RAW),
      status: 'ativa',
      name: 'Chave Mestra São José',
    },
    {
      id: 'k_rc',
      tenant: 'tenant_rio_claro',
      key_hash: simpleHash(KEY_MESTRA_RC_RAW),
      status: 'ativa',
      name: 'Chave Mestra Rio Claro',
    },
    {
      id: 'k_desat',
      tenant: 'tenant_desativado',
      key_hash: simpleHash(KEY_MESTRA_DESATIVADO_RAW),
      status: 'ativa',
      name: 'Chave Mestra Desativada',
    },
    {
      id: 'k_rev',
      tenant: 'tenant_sao_jose',
      key_hash: simpleHash(KEY_REVOGADA_RAW),
      status: 'revogada',
      name: 'Chave Mestra Anterior Revogada',
    },
  ]

  const mockProjects: MockProject[] = [
    {
      id: 'pSJ1',
      tenant: 'tenant_sao_jose',
      titulo: 'Reforma do Fórum São José',
      coluna_kanban: 'Ideação',
      priority: 'Alta',
      prazo: '2025-05-10',
      responsible_user: 'usr_admin_sj',
    },
    {
      id: 'pSJ2',
      tenant: 'tenant_sao_jose',
      titulo: 'Aquisição de TI São José',
      coluna_kanban: 'Elaborar DFD',
      priority: 'Média',
      prazo: '2025-05-15',
      responsible_user: 'usr_servidor_sj',
    },
    {
      id: 'pRC1',
      tenant: 'tenant_rio_claro',
      titulo: 'Construção de Escola Rio Claro',
      coluna_kanban: 'Ideação',
      priority: 'Alta',
      prazo: '2025-06-01',
      responsible_user: 'usr_admin_rc',
    },
  ]

  const mockDfds: MockDfd[] = [
    {
      id: 'dfdSJ1',
      tenant: 'tenant_sao_jose',
      titulo: 'DFD Fórum',
      status: 'em_elaboracao',
      responsible_user: 'usr_admin_sj',
    },
    {
      id: 'dfdSJ2',
      tenant: 'tenant_sao_jose',
      titulo: 'DFD TI',
      status: 'em_elaboracao',
      responsible_user: 'usr_servidor_sj',
    },
    {
      id: 'dfdRC1',
      tenant: 'tenant_rio_claro',
      titulo: 'DFD Escola',
      status: 'em_elaboracao',
      responsible_user: 'usr_admin_rc',
    },
  ]

  // Simulador do pipeline da API com modelo de Chave Mestra + X-Acting-User
  function executeBotApi(
    method: string,
    route: string,
    headers: Record<string, string>,
    query: Record<string, string> = {},
  ) {
    if (method !== 'GET') {
      return { status: 405, body: { code: 405, error: 'METHOD_NOT_ALLOWED' } }
    }

    // Rotas públicas / diagnóstico
    if (route === '/backend/v1/bot') {
      return {
        status: 200,
        body: {
          status: 'ok',
          sistema: 'Bússola Jurídica Municipal 2.0',
          version: '0.0.109',
          auth_model: 'tenant_master_key_with_acting_user',
          ping: '/backend/v1/bot/ping',
        },
      }
    }

    if (route === '/backend/v1/bot/ping') {
      return {
        status: 200,
        body: { status: 'ok', message: 'Bot Read API is active and healthy', version: '0.0.109' },
      }
    }

    // 1. Validar Chave Mestra
    const authHeader = headers['authorization'] || ''
    const apiKeyHeader = headers['x-api-key'] || ''
    let token = ''
    if (apiKeyHeader) {
      token = apiKeyHeader
    } else if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim()
    }

    if (!token) {
      return { status: 401, body: { code: 401, error: 'UNAUTHORIZED', message: 'Chave ausente.' } }
    }

    const hashed = simpleHash(token)
    const keyRec = mockDbKeys.find((k) => k.key_hash === hashed)
    if (!keyRec) {
      return { status: 401, body: { code: 401, error: 'INVALID_KEY', message: 'Chave inválida.' } }
    }

    if (keyRec.status !== 'ativa') {
      return { status: 403, body: { code: 403, error: 'KEY_REVOKED', message: 'Chave revogada.' } }
    }

    const tenantRec = mockTenants[keyRec.tenant]
    if (!tenantRec) {
      return { status: 404, body: { code: 404, error: 'TENANT_NOT_FOUND' } }
    }

    // 2. Validar Hermes Habilitado na prefeitura
    if (!tenantRec.hermes_enabled) {
      return {
        status: 403,
        body: {
          code: 403,
          error: 'HERMES_DISABLED',
          message: 'Integração Hermes desativada para esta prefeitura.',
        },
      }
    }

    // 3. Validar X-Acting-User (obrigatório em todos os endpoints autenticados)
    const rawActingUser = (headers['x-acting-user'] || headers['x_acting_user'] || '').trim()
    if (!rawActingUser) {
      return {
        status: 401,
        body: {
          code: 401,
          error: 'ACTING_USER_REQUIRED',
          message: 'Cabeçalho X-Acting-User ausente.',
        },
      }
    }

    // Resolver usuário por ID ou e-mail
    const userRec = mockUsers.find(
      (u) => u.id === rawActingUser || u.email.toLowerCase() === rawActingUser.toLowerCase(),
    )
    if (!userRec || userRec.status === 'inativo') {
      return {
        status: 403,
        body: {
          code: 403,
          error: 'ACTING_USER_NOT_FOUND',
          message: 'Usuário operador não encontrado ou inativo.',
        },
      }
    }

    // 4. Validar vínculo com a prefeitura da chave mestra (NENHUM dado cruza prefeituras)
    const membership = mockMemberships.find(
      (m) => m.user === userRec.id && m.tenant === tenantRec.id && m.status === 'ativo',
    )
    if (!membership) {
      return {
        status: 403,
        body: {
          code: 403,
          error: 'ACTING_USER_TENANT_MISMATCH',
          message: 'Usuário não possui vínculo ativo com esta prefeitura.',
        },
      }
    }

    const isAdmin = membership.role === 'admin' || membership.role === 'superadmin'

    // Rota /backend/v1/bot/info
    if (route === '/backend/v1/bot/info') {
      return {
        status: 200,
        body: {
          status: 'ok',
          sistema: 'Bússola Jurídica Municipal 2.0',
          versao: '0.0.109',
          municipio: { id: tenantRec.id, nome: tenantRec.name, hermes_enabled: true },
          chave_mestra: { tipo: 'chave_mestra_prefeitura' },
          usuario_operador: {
            id: userRec.id,
            email: userRec.email,
            papel_no_municipio: membership.role,
            is_admin_ou_superior: isAdmin,
          },
          escopo: {
            modo: isAdmin ? 'municipal_completo' : 'pessoal_estrito',
          },
        },
      }
    }

    // Rota /backend/v1/bot/projects
    if (route === '/backend/v1/bot/projects') {
      let filtered = mockProjects.filter((p) => p.tenant === tenantRec.id)
      if (!isAdmin) {
        filtered = filtered.filter((p) => p.responsible_user === userRec.id)
      }
      if (query.coluna) {
        filtered = filtered.filter((p) => p.coluna_kanban === query.coluna)
      }
      if (query.prioridade) {
        filtered = filtered.filter((p) => p.priority === query.prioridade)
      }
      return {
        status: 200,
        body: {
          total: filtered.length,
          escopo: isAdmin ? 'todos_do_municipio' : 'meus_projetos',
          projetos: filtered,
        },
      }
    }

    // Rota /backend/v1/bot/projects/summary (Exclusivo Admin)
    if (route === '/backend/v1/bot/projects/summary') {
      if (!isAdmin) {
        return {
          status: 403,
          body: {
            code: 403,
            error: 'FORBIDDEN',
            message: 'Visões agregadas restritas a administradores.',
          },
        }
      }
      const filtered = mockProjects.filter((p) => p.tenant === tenantRec.id)
      const porColuna: Record<string, number> = {}
      for (const p of filtered) {
        porColuna[p.coluna_kanban] = (porColuna[p.coluna_kanban] || 0) + 1
      }
      return {
        status: 200,
        body: { total_projetos: filtered.length, contagem_por_coluna: porColuna },
      }
    }

    // Rota /backend/v1/bot/users (Exclusivo Admin)
    if (route === '/backend/v1/bot/users') {
      if (!isAdmin) {
        return {
          status: 403,
          body: {
            code: 403,
            error: 'FORBIDDEN',
            message: 'Listagem geral de usuários restrita a administradores.',
          },
        }
      }
      const filteredMems = mockMemberships.filter((m) => m.tenant === tenantRec.id)
      return { status: 200, body: { total: filteredMems.length, usuarios: filteredMems } }
    }

    // Rota /backend/v1/bot/dfds/{id}
    if (route.startsWith('/backend/v1/bot/dfds/')) {
      const id = route.split('/').pop()
      const dfd = mockDfds.find((d) => d.id === id)
      if (!dfd || dfd.tenant !== tenantRec.id) {
        return { status: 404, body: { code: 404, error: 'NOT_FOUND' } }
      }
      if (!isAdmin && dfd.responsible_user !== userRec.id) {
        return { status: 404, body: { code: 404, error: 'NOT_FOUND' } }
      }
      return { status: 200, body: dfd }
    }

    return { status: 404, body: { code: 404, error: 'ROUTE_NOT_FOUND' } }
  }

  // --- SUÍTE DE TESTES ---

  // 1. Chave mestra sem autenticação => 401 UNAUTHORIZED
  try {
    const res = executeBotApi('GET', '/backend/v1/bot/projects', {})
    const errBody = res.body as { error?: string }
    assert(
      'Autenticação: Chave mestra ausente rejeitada com 401',
      res.status === 401 && errBody.error === 'UNAUTHORIZED',
    )
  } catch (e) {
    assert('Autenticação: Chave mestra ausente rejeitada com 401', false, String(e))
  }

  // 2. Chave mestra inválida => 401 INVALID_KEY
  try {
    const res = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: 'Bearer bjm_chave_invalida_999',
      'x-acting-user': 'admin@saojose.gov.br',
    })
    const errBody = res.body as { error?: string }
    assert(
      'Autenticação: Chave mestra inválida rejeitada com 401',
      res.status === 401 && errBody.error === 'INVALID_KEY',
    )
  } catch (e) {
    assert('Autenticação: Chave mestra inválida rejeitada com 401', false, String(e))
  }

  // 3. Chave mestra revogada => 403 KEY_REVOKED
  try {
    const res = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_REVOGADA_RAW}`,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    const errBody = res.body as { error?: string }
    assert(
      'Autenticação: Chave mestra revogada rejeitada com 403',
      res.status === 403 && errBody.error === 'KEY_REVOKED',
    )
  } catch (e) {
    assert('Autenticação: Chave mestra revogada rejeitada com 403', false, String(e))
  }

  // 4. Chave mestra válida SEM cabeçalho X-Acting-User => 401 ACTING_USER_REQUIRED
  try {
    const res = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
    })
    const errBody = res.body as { error?: string }
    assert(
      'Identidade: Chave mestra sem X-Acting-User retorna 401 ACTING_USER_REQUIRED',
      res.status === 401 && errBody.error === 'ACTING_USER_REQUIRED',
    )
  } catch (e) {
    assert('Identidade: Chave mestra sem X-Acting-User retorna 401', false, String(e))
  }

  // 5. Integração Hermes desativada na prefeitura => 403 HERMES_DISABLED
  try {
    const res = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_DESATIVADO_RAW}`,
      'x-acting-user': 'qualquer@email.com',
    })
    const errBody = res.body as { error?: string }
    assert(
      'Hermes Desativado: Retorna 403 HERMES_DISABLED quando hermes_enabled=false',
      res.status === 403 && errBody.error === 'HERMES_DISABLED',
    )
  } catch (e) {
    assert('Hermes Desativado: Retorna 403 HERMES_DISABLED', false, String(e))
  }

  // 6. X-Acting-User de OUTRO município => 403 ACTING_USER_TENANT_MISMATCH (nenhum dado cruza prefeituras)
  try {
    // Chave mestra é de São José, mas X-Acting-User é admin de Rio Claro
    const resMismatch = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'admin@rioclaro.gov.br',
    })
    const errBody = resMismatch.body as { error?: string }
    assert(
      'Isolamento: X-Acting-User de outro município é negado com 403',
      resMismatch.status === 403 && errBody.error === 'ACTING_USER_TENANT_MISMATCH',
    )
  } catch (e) {
    assert('Isolamento: X-Acting-User de outro município negado', false, String(e))
  }

  // 7. X-Acting-User inexistente ou inativo => 403 ACTING_USER_NOT_FOUND
  try {
    const resInexistente = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'fantasma@prefeitura.gov.br',
    })
    assert('Identidade: X-Acting-User inexistente retorna 403', resInexistente.status === 403)
  } catch (e) {
    assert('Identidade: X-Acting-User inexistente retorna 403', false, String(e))
  }

  // 8. Com X-Acting-User Admin -> Visão COMPLETA da prefeitura
  try {
    const resAdmin = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    const body = resAdmin.body as any
    const projs = body.projetos as MockProject[]
    assert(
      'RBAC: X-Acting-User Admin vê todos os projetos da prefeitura',
      resAdmin.status === 200 &&
        body.escopo === 'todos_do_municipio' &&
        projs.length === 2 &&
        projs.every((p) => p.tenant === 'tenant_sao_jose'),
    )
  } catch (e) {
    assert('RBAC: X-Acting-User Admin vê todos os projetos', false, String(e))
  }

  // 9. Com X-Acting-User Servidor Comum -> SÓ O DELE
  try {
    const resComum = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'servidor@saojose.gov.br',
    })
    const body = resComum.body as any
    const projs = body.projetos as MockProject[]
    assert(
      'RBAC: X-Acting-User Comum vê estritamente os projetos onde é responsável',
      resComum.status === 200 &&
        body.escopo === 'meus_projetos' &&
        projs.length === 1 &&
        projs[0].id === 'pSJ2' &&
        projs[0].responsible_user === 'usr_servidor_sj',
    )
  } catch (e) {
    assert('RBAC: X-Acting-User Comum vê só o dele', false, String(e))
  }

  // 10. Com X-Acting-User Servidor Comum -> 403 em visões gerais (/projects/summary)
  try {
    const resSummaryForbidden = executeBotApi('GET', '/backend/v1/bot/projects/summary', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'servidor@saojose.gov.br',
    })
    assert(
      'RBAC: Servidor comum recebe 403 Forbidden em /projects/summary',
      resSummaryForbidden.status === 403 && (resSummaryForbidden.body as any).error === 'FORBIDDEN',
    )
  } catch (e) {
    assert('RBAC: Servidor comum recebe 403 em /projects/summary', false, String(e))
  }

  // 11. Com X-Acting-User Admin -> /projects/summary acessado normalmente
  try {
    const resSummaryAdmin = executeBotApi('GET', '/backend/v1/bot/projects/summary', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    assert(
      'RBAC: Admin municipal acessa /projects/summary com sucesso',
      resSummaryAdmin.status === 200 && (resSummaryAdmin.body as any).total_projetos === 2,
    )
  } catch (e) {
    assert('RBAC: Admin municipal acessa /projects/summary', false, String(e))
  }

  // 12. Com X-Acting-User Servidor Comum -> 403 em listagem de usuários (/users)
  try {
    const resUsersForbidden = executeBotApi('GET', '/backend/v1/bot/users', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'servidor@saojose.gov.br',
    })
    assert(
      'RBAC: Servidor comum recebe 403 Forbidden em /users',
      resUsersForbidden.status === 403 && (resUsersForbidden.body as any).error === 'FORBIDDEN',
    )
  } catch (e) {
    assert('RBAC: Servidor comum recebe 403 em /users', false, String(e))
  }

  // 13. Servidor Comum tentando ver DFD alheio -> 404 (não vaza existência)
  try {
    const resDfdAlheio = executeBotApi('GET', '/backend/v1/bot/dfds/dfdSJ1', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'servidor@saojose.gov.br',
    })
    assert(
      'RBAC: Servidor comum tentando ver DFD não atribuído recebe 404 Not Found',
      resDfdAlheio.status === 404,
    )
  } catch (e) {
    assert('RBAC: Servidor comum recebe 404 para DFD alheio', false, String(e))
  }

  // 14. Suporte a X-Acting-User por ID de usuário além de e-mail
  try {
    const resById = executeBotApi('GET', '/backend/v1/bot/info', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'usr_admin_sj',
    })
    const body = resById.body as any
    assert(
      'Identidade: X-Acting-User aceita ID de usuário com sucesso',
      resById.status === 200 && body.usuario_operador?.id === 'usr_admin_sj',
    )
  } catch (e) {
    assert('Identidade: X-Acting-User aceita ID de usuário', false, String(e))
  }

  // 15. Header X-API-Key com chave mestra funciona normalmente
  try {
    const resXApiKey = executeBotApi('GET', '/backend/v1/bot/projects', {
      'x-api-key': KEY_MESTRA_SJ_RAW,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    assert(
      'Compatibilidade: Header X-API-Key autentica com chave mestra',
      resXApiKey.status === 200,
    )
  } catch (e) {
    assert('Compatibilidade: Header X-API-Key', false, String(e))
  }

  // 16. Métodos de escrita continuam rejeitados com 405 (somente leitura)
  try {
    const resPost = executeBotApi('POST', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    assert('Somente Leitura: POST rejeitado com 405 Method Not Allowed', resPost.status === 405)
  } catch (e) {
    assert('Somente Leitura: POST rejeitado', false, String(e))
  }

  // 17. Isolamento intransponível entre prefeituras
  try {
    const resSJ = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_SJ_RAW}`,
      'x-acting-user': 'admin@saojose.gov.br',
    })
    const projsSJ = (resSJ.body as any).projetos as MockProject[]
    const leakSJ = projsSJ.some((p) => p.tenant !== 'tenant_sao_jose')

    const resRC = executeBotApi('GET', '/backend/v1/bot/projects', {
      authorization: `Bearer ${KEY_MESTRA_RC_RAW}`,
      'x-acting-user': 'admin@rioclaro.gov.br',
    })
    const projsRC = (resRC.body as any).projetos as MockProject[]
    const leakRC = projsRC.some((p) => p.tenant !== 'tenant_rio_claro')

    assert(
      'Isolamento: Chave mestra e X-Acting-User garantem segregação estrita por município',
      !leakSJ && !leakRC && projsSJ.length === 2 && projsRC.length === 1,
    )
  } catch (e) {
    assert('Isolamento: Segregação estrita por município', false, String(e))
  }

  const failedCount = results.filter((r) => !r.passed).length

  return {
    passed: failedCount === 0,
    total: results.length,
    failedCount,
    results,
  }
}
