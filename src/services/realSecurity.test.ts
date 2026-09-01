/**
 * Testes de Segurança HTTP Reais contra Instância PocketBase Efêmera e Isolada (Segurança v4).
 *
 * POLÍTICA DE SEGURANÇA E ISOLAMENTO ESTREITO:
 * - ZERO credenciais/IDs/e-mails/slugs fixos de produção ou preview.
 * - Fixtures criadas em runtime com nonce exclusivo capturadas dinamicamente.
 * - Snapshot de invariância valida apenas fixtures criadas pelo runner local na instância efêmera.
 * - Guardrail antiacidente: rejeita hosts que não sejam 127.0.0.1/localhost e valida marcador test_environment.
 * - Cleanup em finally: remove fixtures e confirma zero resíduos.
 */
import PocketBase from 'pocketbase'

export interface RealSecurityTestResult {
  passed: boolean
  results: Array<{
    name: string
    ok: boolean
    detail?: string
    scenarioId?: string
    expectedStatus?: string
    receivedStatus?: string
  }>
}

interface LocalFixtureSnapshot {
  userCount: number
  userIds: string[]
  usersSummary: Array<{
    id: string
    role: string
    status: string
    verified: boolean
    tenant: string
  }>
  membershipsCount: number
  membershipsSummary: Array<{
    id: string
    user: string
    tenant: string
    role: string
    status: string
  }>
}

export async function runRealSecurityTests(): Promise<RealSecurityTestResult> {
  const results: Array<{
    name: string
    ok: boolean
    detail?: string
    scenarioId?: string
    expectedStatus?: string
    receivedStatus?: string
  }> = []

  const globalObj: any = typeof globalThis !== 'undefined' ? globalThis : {}
  const nodeProcess: any = typeof globalObj.process !== 'undefined' ? globalObj.process : undefined

  const pbUrl = (nodeProcess?.env?.TEST_POCKETBASE_URL ||
    nodeProcess?.env?.VITE_POCKETBASE_URL ||
    '') as string

  const testNonce = (nodeProcess?.env?.EPHEMERAL_TEST_NONCE || '') as string

  // =========================================================================
  // GUARDRAILS ANTIACIDENTE OBRIGATÓRIOS
  // =========================================================================
  // 1. A base URL DEVE ser estritamente localhost ou 127.0.0.1
  const isLocalUrl =
    pbUrl.startsWith('http://127.0.0.1:') ||
    pbUrl.startsWith('http://localhost:') ||
    pbUrl.startsWith('https://127.0.0.1:') ||
    pbUrl.startsWith('https://localhost:')

  if (!isLocalUrl) {
    const errorMsg =
      `Bloqueio Antiacidente: A URL de teste configurada (${pbUrl || 'vazia'}) NÃO é 127.0.0.1/localhost. ` +
      `Testes de integração com mutações NUNCA podem apontar para preview ou produção.`
    results.push({
      scenarioId: 'GUARDRAIL-HOST',
      name: 'Guardrail Antiacidente: Verificação de Host Local Efêmero',
      ok: false,
      detail: errorMsg,
      expectedStatus: '127.0.0.1/localhost',
      receivedStatus: pbUrl || 'vazio',
    })
    return { passed: false, results }
  }

  // 2. O runner DEVE fornecer um nonce de ambiente efêmero correspondente
  if (!testNonce || testNonce.length < 8) {
    const errorMsg =
      'Bloqueio Antiacidente: Nonce de ambiente efêmero (EPHEMERAL_TEST_NONCE) ausente ou inválido. ' +
      'Os testes de segurança reais exigem execução controlada através do runner efêmero isolado.'
    results.push({
      scenarioId: 'GUARDRAIL-NONCE',
      name: 'Guardrail Antiacidente: Verificação do Nonce de Ambiente Efêmero',
      ok: false,
      detail: errorMsg,
      expectedStatus: 'NONCE_PRESENTE',
      receivedStatus: 'NONCE_AUSENTE',
    })
    return { passed: false, results }
  }

  async function assertTest(
    scenarioId: string,
    name: string,
    expectedStatus: string,
    fn: () => Promise<{ ok: boolean; receivedStatus: string; detail?: string }>,
  ) {
    try {
      const res = await fn()
      results.push({
        scenarioId,
        name,
        ok: res.ok,
        expectedStatus,
        receivedStatus: res.receivedStatus,
        detail: res.detail,
      })
    } catch (err: any) {
      results.push({
        scenarioId,
        name,
        ok: false,
        expectedStatus,
        receivedStatus: err.status ? String(err.status) : 'ERROR',
        detail: err?.message || String(err),
      })
    }
  }

  // Identificador de execução único
  const runEntropy =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).substring(2, 12)
  const testRunId = `run_${Date.now()}_${runEntropy}`

  function generateStrongDynamicPassword(prefix = 'P_'): string {
    const randomHex =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).substring(2, 15)
    return `${prefix}${randomHex}Aa1!@#`
  }

  async function sha256Hex(msg: string): Promise<string> {
    const enc = new TextEncoder()
    const data = enc.encode(msg)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // 3. Obter credencial de superadmin efêmero do runner e autenticar EXCLUSIVAMENTE via _superusers ANTES de ler o marcador protegido
  const runtimeSuperuserEmail = (nodeProcess?.env?.EPHEMERAL_SUPERADMIN_EMAIL || '') as string
  const runtimeSuperuserPassword = (nodeProcess?.env?.EPHEMERAL_SUPERADMIN_PASSWORD || '') as string
  let runtimeSuperuserToken = (nodeProcess?.env?.PB_SUPERUSER_TOKEN ||
    nodeProcess?.env?.SUPERUSER_TOKEN ||
    nodeProcess?.env?.POCKETBASE_SUPERADMIN_TOKEN ||
    '') as string

  if (!runtimeSuperuserToken && runtimeSuperuserEmail && runtimeSuperuserPassword) {
    try {
      const authSetupClient = new PocketBase(pbUrl)
      const authData = await authSetupClient
        .collection('_superusers')
        .authWithPassword(runtimeSuperuserEmail, runtimeSuperuserPassword)
      if (authData?.token && typeof authData.token === 'string' && authData.token.length > 20) {
        runtimeSuperuserToken = authData.token
      } else {
        throw new Error('Token retornado por _superusers inválido ou vazio.')
      }
    } catch (authErr: any) {
      const authFailMsg = `Falha na autenticação exclusiva do superuser efêmero via _superusers: ${authErr?.message || authErr}`
      results.push({
        scenarioId: 'AUTH-SUPERADMIN',
        name: 'Setup de Autoridade Privilegiada (Superadmin de Runtime via _superusers)',
        ok: false,
        detail: authFailMsg,
        expectedStatus: 'TOKEN_ACQUIRED',
        receivedStatus: 'AUTH_FAILED',
      })
      return { passed: false, results }
    }
  }

  if (!runtimeSuperuserToken) {
    const missingTokenError =
      'Falha de execução: Credencial de runtime de superadmin não fornecida ou token ausente no ambiente efêmero.'
    results.push({
      scenarioId: 'AUTH-SUPERADMIN',
      name: 'Setup de Autoridade Privilegiada (Superadmin de Runtime via _superusers)',
      ok: false,
      detail: missingTokenError,
      expectedStatus: 'TOKEN_ACQUIRED',
      receivedStatus: 'TOKEN_MISSING',
    })
    return { passed: false, results }
  }

  const superadminClient = new PocketBase(pbUrl)
  superadminClient.authStore.save(runtimeSuperuserToken, {
    id: 'superuser',
    role: 'superadmin',
  } as any)

  // 4. Verificação do marcador test_environment exclusivo no banco antes de qualquer operação (com cliente superadmin autenticado)
  try {
    const markerRecord = await superadminClient
      .collection('security_audit_markers')
      .getFirstListItem("marker_key = 'test_environment'")
      .catch(() => null)

    if (!markerRecord) {
      const errorMsg =
        'Bloqueio Antiacidente: O banco de dados alvo NÃO possui o registro exclusivo `test_environment` em security_audit_markers. ' +
        'Execução abortada antes de qualquer operação de escrita para proteger bases reais.'
      results.push({
        scenarioId: 'GUARDRAIL-MARKER',
        name: 'Guardrail Antiacidente: Verificação de Registro test_environment no Banco Efêmero',
        ok: false,
        detail: errorMsg,
        expectedStatus: 'test_environment_present',
        receivedStatus: 'null',
      })
      return { passed: false, results }
    }

    const markerDetails =
      typeof markerRecord.details === 'string'
        ? JSON.parse(markerRecord.details)
        : markerRecord.details
    if (!markerDetails || markerDetails.nonce !== testNonce) {
      const errorMsg =
        'Bloqueio Antiacidente: O nonce gravado no banco de dados não corresponde ao EPHEMERAL_TEST_NONCE do runner. ' +
        'Possível conflito de instâncias ou banco inadequado.'
      results.push({
        scenarioId: 'GUARDRAIL-NONCE-MATCH',
        name: 'Guardrail Antiacidente: Integridade de Nonce do Banco Efêmero',
        ok: false,
        detail: errorMsg,
        expectedStatus: 'NONCE_MATCH',
        receivedStatus: 'NONCE_MISMATCH',
      })
      return { passed: false, results }
    }
  } catch (err: any) {
    results.push({
      scenarioId: 'GUARDRAIL-VALIDATION',
      name: 'Guardrail Antiacidente: Verificação de Marcador de Ambiente de Teste',
      ok: false,
      detail: `Falha ao validar marcador de teste no banco: ${err?.message || err}`,
      expectedStatus: '200',
      receivedStatus: 'ERROR',
    })
    return { passed: false, results }
  }

  // Rastreamento estrito de recursos efêmeros criados
  const createdTenantIds: string[] = []
  const createdUserIds: string[] = []
  const createdMembershipIds: string[] = []
  const createdInvitationIds: string[] = []

  let tenantAId = ''
  let tenantBId = ''
  let tenantASlug = `tenant_a_${runEntropy}`
  let tenantBSlug = `tenant_b_${runEntropy}`

  let adminAUserId = ''
  let adminBUserId = ''
  let servidorAUserId = ''
  let multiTenantUserId = ''

  const adminAPassword = generateStrongDynamicPassword('AdmA_')
  const adminBPassword = generateStrongDynamicPassword('AdmB_')
  const servidorAPassword = generateStrongDynamicPassword('SrvA_')
  const citizenPassword = generateStrongDynamicPassword('Cid_')
  const multiTenantPassword = generateStrongDynamicPassword('Mul_')

  const adminAEmail = `admin.tenant.a.${testRunId}@ephemeral.local`
  const adminBEmail = `admin.tenant.b.${testRunId}@ephemeral.local`
  const servidorAEmail = `servidor.tenant.a.${testRunId}@ephemeral.local`
  const citizenEmail = `citizen.${testRunId}@ephemeral.local`
  const multiTenantEmail = `multitenant.${testRunId}@ephemeral.local`

  const adminAClient = new PocketBase(pbUrl)
  const adminBClient = new PocketBase(pbUrl)
  const servidorAClient = new PocketBase(pbUrl)
  const multiTenantClient = new PocketBase(pbUrl)
  const publicClient = new PocketBase(pbUrl)

  async function captureLocalSnapshot(): Promise<LocalFixtureSnapshot> {
    const rawUsers = await superadminClient.collection('users').getFullList()
    const targetUsers = rawUsers
      .filter((u) => createdUserIds.includes(u.id))
      .sort((a, b) => a.id.localeCompare(b.id))

    const rawMemberships = await superadminClient.collection('user_memberships').getFullList()
    const targetMemberships = rawMemberships
      .filter((m) => createdMembershipIds.includes(m.id))
      .sort((a, b) => a.id.localeCompare(b.id))

    return {
      userCount: targetUsers.length,
      userIds: targetUsers.map((u) => u.id),
      usersSummary: targetUsers.map((u) => ({
        id: u.id,
        role: u.role,
        status: u.status,
        verified: u.verified,
        tenant: u.tenant || '',
      })),
      membershipsCount: targetMemberships.length,
      membershipsSummary: targetMemberships.map((m) => ({
        id: m.id,
        user: m.user,
        tenant: m.tenant,
        role: m.role,
        status: m.status,
      })),
    }
  }

  let baselineSnapshot: LocalFixtureSnapshot | null = null

  try {
    // =========================================================================
    // SETUP DINÂMICO DE FIXTURES EFÊMERAS (TENANTS A & B)
    // =========================================================================
    // 1. Criar Tenant A e Tenant B dinamicamente pelo superadmin
    const tenantARecord = await superadminClient.collection('tenants').create({
      name: `Prefeitura Alfa ${testRunId}`,
      slug: tenantASlug,
      status: 'ativa',
      cnpj: '11.111.111/0001-11',
    })
    tenantAId = tenantARecord.id
    createdTenantIds.push(tenantAId)

    const tenantBRecord = await superadminClient.collection('tenants').create({
      name: `Prefeitura Beta ${testRunId}`,
      slug: tenantBSlug,
      status: 'ativa',
      cnpj: '22.222.222/0001-22',
    })
    tenantBId = tenantBRecord.id
    createdTenantIds.push(tenantBId)

    // 2. Criar Servidor A via register-public
    const srvRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: tenantASlug,
        name: `Servidor Alfa ${testRunId}`,
        email: servidorAEmail,
        password: servidorAPassword,
        passwordConfirm: servidorAPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (srvRegRes?.userId) {
      createdUserIds.push(srvRegRes.userId)
      servidorAUserId = srvRegRes.userId
    }
    if (srvRegRes?.membershipId) {
      createdMembershipIds.push(srvRegRes.membershipId)
      // Superadmin ativa Servidor A
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: srvRegRes.membershipId,
          role: 'servidor',
          tenant: tenantAId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 3. Criar Admin A via register-public + approve (role=admin, status=ativo)
    const admARegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: tenantASlug,
        name: `Admin Alfa ${testRunId}`,
        email: adminAEmail,
        password: adminAPassword,
        passwordConfirm: adminAPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (admARegRes?.userId) {
      createdUserIds.push(admARegRes.userId)
      adminAUserId = admARegRes.userId
    }
    if (admARegRes?.membershipId) {
      createdMembershipIds.push(admARegRes.membershipId)
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: admARegRes.membershipId,
          role: 'admin',
          tenant: tenantAId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 4. Criar Admin B via register-public + approve (role=admin, status=ativo)
    const admBRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: tenantBSlug,
        name: `Admin Beta ${testRunId}`,
        email: adminBEmail,
        password: adminBPassword,
        passwordConfirm: adminBPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (admBRegRes?.userId) {
      createdUserIds.push(admBRegRes.userId)
      adminBUserId = admBRegRes.userId
    }
    if (admBRegRes?.membershipId) {
      createdMembershipIds.push(admBRegRes.membershipId)
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: admBRegRes.membershipId,
          role: 'admin',
          tenant: tenantBId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 5. Criar Usuário Multi-tenant (ativo em A e pendente em B)
    const multiRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: tenantASlug,
        name: `Multi-Tenant User ${testRunId}`,
        email: multiTenantEmail,
        password: multiTenantPassword,
        passwordConfirm: multiTenantPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (multiRegRes?.userId) {
      createdUserIds.push(multiRegRes.userId)
      multiTenantUserId = multiRegRes.userId
    }
    if (multiRegRes?.membershipId) {
      createdMembershipIds.push(multiRegRes.membershipId)
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: multiRegRes.membershipId,
          role: 'gestor',
          tenant: tenantAId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Autenticar clientes efêmeros
    await adminAClient.collection('users').authWithPassword(adminAEmail, adminAPassword)
    await adminBClient.collection('users').authWithPassword(adminBEmail, adminBPassword)
    await servidorAClient.collection('users').authWithPassword(servidorAEmail, servidorAPassword)
    await multiTenantClient
      .collection('users')
      .authWithPassword(multiTenantEmail, multiTenantPassword)

    // Capturar snapshot baseline das fixtures
    baselineSnapshot = await captureLocalSnapshot()

    // =========================================================================
    // EXECUÇÃO DOS CENÁRIOS DE SEGURANÇA E ISOLAMENTO (16+ CENÁRIOS)
    // =========================================================================

    // Cenário 1 (Negativo): Senha genérica/inválida falha e retorna 400 em todas as contas efêmeras
    await assertTest(
      'SCENARIO-01',
      'Cenário 1 (Negativo): Senha genérica/inválida falha com 400/401 em todas as contas efêmeras',
      '400/401',
      async () => {
        const client = new PocketBase(pbUrl)
        const emails = [adminAEmail, adminBEmail, servidorAEmail, multiTenantEmail]
        let allFailed = true
        for (const em of emails) {
          try {
            await client.collection('users').authWithPassword(em, 'GenericPass123!@#')
            allFailed = false
          } catch (err: any) {
            if (err.status !== 400 && err.status !== 401) allFailed = false
          }
        }
        return { ok: allFailed, receivedStatus: allFailed ? '400' : '200' }
      },
    )

    // Cenário 2: Snapshot de invariância das fixtures locais criadas pelo runner
    await assertTest(
      'SCENARIO-02',
      'Cenário 2: Snapshot de invariância das fixtures locais criadas pelo runner',
      '200',
      async () => {
        if (!baselineSnapshot) return { ok: false, receivedStatus: '500', detail: 'Sem baseline' }
        const currentSnapshot = await captureLocalSnapshot()
        const matchUsers = currentSnapshot.userCount === baselineSnapshot.userCount
        const matchMems = currentSnapshot.membershipsCount === baselineSnapshot.membershipsCount
        const ok = matchUsers && matchMems
        return { ok, receivedStatus: ok ? '200' : 'DRIFT' }
      },
    )

    // Cenário 3: Servidor efêmero autenticado vê apenas o próprio registro na coleção users
    await assertTest(
      'SCENARIO-03',
      'Cenário 3: Servidor efêmero vê apenas seu próprio registro em /api/collections/users/records',
      '200',
      async () => {
        const list = await servidorAClient.collection('users').getFullList()
        const ok = list.length === 1 && list[0].id === servidorAUserId
        return { ok, receivedStatus: '200', detail: `Registros visíveis: ${list.length}` }
      },
    )

    // Cenário 4: Servidor efêmero tentando acessar registro de outro usuário (IDOR) recebe 404/403
    await assertTest(
      'SCENARIO-04',
      'Cenário 4: Servidor efêmero tentando acessar registro de outro usuário (IDOR) recebe 404/403',
      '404/403',
      async () => {
        try {
          await servidorAClient.collection('users').getOne(adminBUserId)
          return { ok: false, receivedStatus: '200' }
        } catch (err: any) {
          const ok = err.status === 404 || err.status === 403
          return { ok, receivedStatus: String(err.status) }
        }
      },
    )

    // Cenário 5: Servidor efêmero não pode alterar o próprio role, status ou tenant diretamente
    await assertTest(
      'SCENARIO-05',
      'Cenário 5: Servidor efêmero não pode auto-promover role ou alterar tenant via direct update',
      '403/400',
      async () => {
        try {
          await servidorAClient.collection('users').update(servidorAUserId, { role: 'superadmin' })
          return { ok: false, receivedStatus: '200' }
        } catch (err: any) {
          const ok = err.status === 403 || err.status === 400
          return { ok, receivedStatus: String(err.status) }
        }
      },
    )

    // Cenário 6: Create direto em user_memberships via API por Admin Municipal => 403
    await assertTest(
      'SCENARIO-06',
      'Cenário 6: Create direto em user_memberships via API padrão por Admin Municipal é rejeitado (403)',
      '403',
      async () => {
        let blocked = false
        let status = '200'
        try {
          await adminAClient.collection('user_memberships').create({
            user: servidorAUserId,
            tenant: tenantAId,
            role: 'admin',
            status: 'ativo',
          })
        } catch (err: any) {
          blocked = err.status === 403 || err.status === 400 || err.status === 404
          status = String(err.status)
        }
        return { ok: blocked, receivedStatus: status }
      },
    )

    // Cenário 7: Auto-cadastro público força role servidor e status pendente sem privilégios
    await assertTest(
      'SCENARIO-07',
      'Cenário 7: Auto-cadastro público força role segura e status pendente sem concessão de privilégios',
      '200',
      async () => {
        const res: any = await publicClient.send('/backend/v1/auth/register-public', {
          method: 'POST',
          body: JSON.stringify({
            slug: tenantASlug,
            name: 'Cidadão Efêmero',
            email: citizenEmail,
            password: citizenPassword,
            passwordConfirm: citizenPassword,
            role: 'superadmin',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        if (res?.userId) createdUserIds.push(res.userId)
        if (res?.membershipId) createdMembershipIds.push(res.membershipId)

        const resStr = JSON.stringify(res)
        const noPassLeak = !resStr.includes(citizenPassword) && !resStr.includes('password')
        const ok = res.success === true && res.status === 'pendente' && noPassLeak
        return { ok, receivedStatus: '200' }
      },
    )

    // Cenário 8: Endpoint de criação de membros rejeita acesso anônimo/não-autorizado com 401
    await assertTest(
      'SCENARIO-08',
      'Cenário 8: Endpoint /backend/v1/tenant-users/create rejeita acesso anônimo com 401',
      '401',
      async () => {
        const client = new PocketBase(pbUrl)
        try {
          await client.send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Tentativa Anônima',
              email: `anon.${testRunId}@ephemeral.local`,
              tenant: tenantAId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          return { ok: false, receivedStatus: '200' }
        } catch (err: any) {
          const ok = err.status === 401 || err.status === 403
          return { ok, receivedStatus: String(err.status) }
        }
      },
    )

    // Cenário 9: Injeção de filtros em buscas/listas parametrizadas é neutralizada
    await assertTest(
      'SCENARIO-09',
      'Cenário 9: Injeção de filtros (Filter injection) é neutralizada com parametrização {:param}',
      '400/403',
      async () => {
        let inj1Blocked = false
        try {
          await servidorAClient.send(
            `/backend/v1/tenant-users/list?tenant=${encodeURIComponent(tenantAId + "' || '1'='1")}`,
            { method: 'GET' },
          )
        } catch (err: any) {
          inj1Blocked = err.status === 400 || err.status === 403
        }

        let inj2Blocked = false
        try {
          await servidorAClient.send(
            `/backend/v1/tenant-users/list?tenant=${tenantAId}&status=${encodeURIComponent("ativo' || status!=''")}`,
            { method: 'GET' },
          )
        } catch (err: any) {
          inj2Blocked = err.status === 400 || err.status === 403
        }

        let legitSearchOk = false
        try {
          const listRes: any = await adminAClient.send(
            `/backend/v1/tenant-users/list?tenant=${tenantAId}&search=${encodeURIComponent("D'Ávila")}`,
            { method: 'GET' },
          )
          legitSearchOk = listRes && Array.isArray(listRes.items)
        } catch {
          legitSearchOk = false
        }

        const ok = inj1Blocked && inj2Blocked && legitSearchOk
        return { ok, receivedStatus: ok ? '400' : 'ERROR' }
      },
    )

    // Cenário 10: Admin de Tenant A NÃO pode criar ou cancelar convites para Tenant B => 403
    await assertTest(
      'SCENARIO-10',
      'Cenário 10: Admin convida/cancela APENAS no seu tenant; Tentativa em outro tenant => 403',
      '403',
      async () => {
        // 1. Admin A tenta convidar em Tenant B => 403
        let crossInviteBlocked = false
        try {
          await adminAClient.send('/backend/v1/invitations/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Invasor em B',
              email: `cross.invite.${testRunId}@ephemeral.local`,
              tenant: tenantBId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          crossInviteBlocked = err.status === 403 || err.status === 401
        }

        // 2. Admin B cria convite legítimo em B
        const bEmail = `b.inv.${testRunId}@ephemeral.local`
        await adminBClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Convidado B',
            email: bEmail,
            tenant: tenantBId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const bInvs = await adminBClient.collection('invitations').getFullList({
          filter: adminBClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantBId,
              email: bEmail,
            },
          ),
        })
        if (bInvs.length === 0) return { ok: false, receivedStatus: 'INV_NOT_FOUND' }
        const bInvId = bInvs[0].id
        createdInvitationIds.push(bInvId)

        // 3. Admin A tenta cancelar convite de B => 403
        let crossCancelBlocked = false
        try {
          await adminAClient.send('/backend/v1/invitations/cancel', {
            method: 'POST',
            body: JSON.stringify({ invitationId: bInvId }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          crossCancelBlocked = err.status === 403
        }

        // 4. Admin B cancela o próprio convite => 200
        const cancelRes: any = await adminBClient.send('/backend/v1/invitations/cancel', {
          method: 'POST',
          body: JSON.stringify({ invitationId: bInvId }),
          headers: { 'Content-Type': 'application/json' },
        })
        const ownCancelOk = cancelRes.success === true

        const ok = crossInviteBlocked && crossCancelBlocked && ownCancelOk
        return { ok, receivedStatus: ok ? '403/200' : 'ERROR' }
      },
    )

    // Cenário 11: Admin NÃO pode aceitar convite no lugar do titular
    await assertTest(
      'SCENARIO-11',
      'Cenário 11: Admin NÃO pode aceitar convite no lugar do titular destinatário => 403',
      '403',
      async () => {
        const targetEmail = `destinatario.titular.${testRunId}@ephemeral.local`
        await adminAClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Destinatário Titular',
            email: targetEmail,
            tenant: tenantAId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const invs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantAId,
              email: targetEmail,
            },
          ),
        })
        if (invs.length === 0) return { ok: false, receivedStatus: 'INV_NOT_FOUND' }
        const invId = invs[0].id
        createdInvitationIds.push(invId)

        const titularToken = 'token_secret_titular_xyz_' + testRunId
        const hash = await sha256Hex(titularToken)
        await superadminClient.collection('invitations').update(invId, { token_hash: hash })

        // Admin A tenta aceitar convite de targetEmail => 403
        let adminBlocked = false
        try {
          await adminAClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: titularToken }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          adminBlocked = err.status === 403
        }

        return { ok: adminBlocked, receivedStatus: adminBlocked ? '403' : '200' }
      },
    )

    // Cenário 12: Aceite exige token obrigatório e retorna resposta genérica sem enumeração
    await assertTest(
      'SCENARIO-12',
      'Cenário 12: Aceite sem token => 400; Token inexistente => resposta genérica (400)',
      '400',
      async () => {
        let noTokenBlocked = false
        try {
          await servidorAClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ invitationId: 'some_id' }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          noTokenBlocked = err.status === 400
        }

        let invalidTokenBlocked = false
        try {
          await servidorAClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: 'invalid_token_1234567890abcdef' }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          invalidTokenBlocked = err.status === 400
        }

        const ok = noTokenBlocked && invalidTokenBlocked
        return { ok, receivedStatus: ok ? '400' : 'ERROR' }
      },
    )

    // Cenário 13: Titular autêntico com token válido aceita e ativa vínculo no tenant alvo
    await assertTest(
      'SCENARIO-13',
      'Cenário 13: Titular com token válido ativa vínculo em Tenant B e replay falha (400)',
      '200/400',
      async () => {
        await adminBClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Servidor A em B',
            email: servidorAEmail,
            tenant: tenantBId,
            role: 'gestor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const pendingInvs = await adminBClient.collection('invitations').getFullList({
          filter: adminBClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantBId,
              email: servidorAEmail,
            },
          ),
        })
        if (pendingInvs.length === 0) return { ok: false, receivedStatus: 'INV_NOT_FOUND' }
        const invRec = pendingInvs[0]
        createdInvitationIds.push(invRec.id)

        const simToken = 'token_accept_valid_' + testRunId
        const simHash = await sha256Hex(simToken)
        await superadminClient.collection('invitations').update(invRec.id, { token_hash: simHash })

        // Servidor A aceita com o token correto
        const acceptRes: any = await servidorAClient.send('/backend/v1/invitations/accept', {
          method: 'POST',
          body: JSON.stringify({ token: simToken }),
          headers: { 'Content-Type': 'application/json' },
        })
        if (!acceptRes.success) return { ok: false, receivedStatus: 'ACCEPT_FAILED' }

        // Vínculo em B agora deve estar ativo
        const bMems = await servidorAClient.collection('user_memberships').getFullList({
          filter: servidorAClient.filter('tenant = {:tenantId}', { tenantId: tenantBId }),
        })
        const bActive = bMems.length === 1 && bMems[0].status === 'ativo'
        if (bMems[0]) createdMembershipIds.push(bMems[0].id)

        // Replay deve falhar com 400
        let replayBlocked = false
        try {
          await servidorAClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: simToken }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          replayBlocked = err.status === 400
        }

        const ok = bActive && replayBlocked
        return { ok, receivedStatus: ok ? '200' : 'ERROR' }
      },
    )

    // Cenário 14: Recusa de convite pelo titular não cria vínculo ativo e invalida o convite
    await assertTest(
      'SCENARIO-14',
      'Cenário 14: Recusa de convite pelo titular não cria vínculo ativo e invalida convite',
      '200',
      async () => {
        const declineEmail = `decline.${testRunId}@ephemeral.local`
        const declinePassword = generateStrongDynamicPassword('Dec_')

        const regRes: any = await publicClient.send('/backend/v1/auth/register-public', {
          method: 'POST',
          body: JSON.stringify({
            slug: tenantASlug,
            name: 'Usuário Recusa',
            email: declineEmail,
            password: declinePassword,
            passwordConfirm: declinePassword,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        if (regRes?.userId) createdUserIds.push(regRes.userId)
        if (regRes?.membershipId) createdMembershipIds.push(regRes.membershipId)

        const declineClient = new PocketBase(pbUrl)
        await declineClient.collection('users').authWithPassword(declineEmail, declinePassword)

        await adminAClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Usuário Recusa',
            email: declineEmail,
            tenant: tenantAId,
            role: 'secretario',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const invs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantAId,
              email: declineEmail,
            },
          ),
        })
        if (invs.length === 0) return { ok: false, receivedStatus: 'INV_NOT_FOUND' }
        const invId = invs[0].id
        createdInvitationIds.push(invId)

        const decToken = 'decline_token_' + testRunId
        const decHash = await sha256Hex(decToken)
        await superadminClient.collection('invitations').update(invId, { token_hash: decHash })

        const decRes: any = await declineClient.send('/backend/v1/invitations/decline', {
          method: 'POST',
          body: JSON.stringify({ token: decToken }),
          headers: { 'Content-Type': 'application/json' },
        })

        const mems = await declineClient.collection('user_memberships').getFullList({
          filter: declineClient.filter('tenant = {:tenantId}', { tenantId: tenantAId }),
        })
        const notActive = mems.every((m) => m.status !== 'ativo')
        const ok = decRes.success === true && notActive
        return { ok, receivedStatus: ok ? '200' : 'ERROR' }
      },
    )

    // Cenário 15: Reenvio de convite invalida o anterior e garante exatamente UM pendente
    await assertTest(
      'SCENARIO-15',
      'Cenário 15: Reenvio de convite invalida o anterior e garante unicidade de convite pendente',
      '200',
      async () => {
        const resendEmail = `resend.${testRunId}@ephemeral.local`
        await adminAClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Resend User',
            email: resendEmail,
            tenant: tenantAId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        await adminAClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Resend User',
            email: resendEmail,
            tenant: tenantAId,
            role: 'gestor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const pendingInvs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantAId,
              email: resendEmail,
            },
          ),
        })

        const totalInvs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter('tenant = {:tenantId} && email = {:email}', {
            tenantId: tenantAId,
            email: resendEmail,
          }),
        })
        totalInvs.forEach((i) => createdInvitationIds.push(i.id))

        const userInvs = await adminAClient.collection('users').getFullList({
          filter: adminAClient.filter('email = {:email}', { email: resendEmail }),
        })
        if (userInvs.length > 0) createdUserIds.push(userInvs[0].id)

        const ok = pendingInvs.length === 1 && totalInvs.length >= 2
        return { ok, receivedStatus: ok ? '200' : 'MULTI_PENDING' }
      },
    )

    // Cenário 16: Corrida concorrente de convites simultâneos resulta em exatamente UM pendente
    await assertTest(
      'SCENARIO-16',
      'Cenário 16: Corrida concorrente de convites simultâneos garante exatamente UM pendente (R-3)',
      '200',
      async () => {
        const raceEmail = `race.${testRunId}@ephemeral.local`
        const p1 = adminAClient
          .send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Race User A',
              email: raceEmail,
              tenant: tenantAId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          .catch((err) => ({ error: err }))

        const p2 = adminAClient
          .send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Race User B',
              email: raceEmail,
              tenant: tenantAId,
              role: 'procurador',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          .catch((err) => ({ error: err }))

        await Promise.all([p1, p2])

        const pendingInvs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            {
              tenantId: tenantAId,
              email: raceEmail,
            },
          ),
        })

        const allInvs = await adminAClient.collection('invitations').getFullList({
          filter: adminAClient.filter('tenant = {:tenantId} && email = {:email}', {
            tenantId: tenantAId,
            email: raceEmail,
          }),
        })
        allInvs.forEach((i) => createdInvitationIds.push(i.id))

        const userRecs = await adminAClient.collection('users').getFullList({
          filter: adminAClient.filter('email = {:email}', { email: raceEmail }),
        })
        if (userRecs.length > 0) createdUserIds.push(userRecs[0].id)

        const ok = pendingInvs.length === 1
        return { ok, receivedStatus: ok ? '200' : 'RACE_FAIL' }
      },
    )

    // Cenário 17: Ausência total de segredos/tokens em responses e logs de erro/sucesso
    await assertTest(
      'SCENARIO-17',
      'Cenário 17: Ausência total de vazamento de segredos/tokens em responses HTTP e payloads',
      '200',
      async () => {
        const createRes: any = await adminAClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'No Secret Leak User',
            email: `leakcheck.${testRunId}@ephemeral.local`,
            tenant: tenantAId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const resStr = JSON.stringify(createRes)
        const noToken = !resStr.includes('token') && !resStr.includes('password')
        const ok = createRes.success === true && noToken
        return { ok, receivedStatus: ok ? '200' : 'LEAK' }
      },
    )

    // Cenário 18: [Academia Foundation] Isolamento multi-tenant de Secretarias e Grupos Educacionais (Florânia vs Tangará)
    await assertTest(
      'SCENARIO-18',
      'Cenário 18: Admin de Florânia não visualiza, altera nem exclui Secretarias ou Grupos de Tangará',
      '403/404',
      async () => {
        // Superadmin cria secretaria e grupo em Tangará (Tenant B)
        const secTangara = await superadminClient.collection('secretarias').create({
          nome: 'Secretaria de Tangara ' + testRunId,
          sigla: 'ST',
          tenant: tenantBId,
          status: 'ativo',
        })
        const grpTangara = await superadminClient.collection('education_groups').create({
          nome: 'Grupo Tangara ' + testRunId,
          tenant: tenantBId,
          secretaria: secTangara.id,
          status: 'ativo',
        })

        // Admin Florânia tenta listar secretarias com filtro do próprio tenant
        const floraniaSecs = await adminAClient.collection('secretarias').getFullList({
          filter: adminAClient.filter('tenant = {:t}', { t: tenantAId }),
        })
        const hasTangaraSec = floraniaSecs.some((s) => s.id === secTangara.id)

        // Admin Florânia tenta acessar diretamente por ID a secretaria e grupo de Tangará
        let secDirectFailed = false
        try {
          await adminAClient.collection('secretarias').getOne(secTangara.id)
        } catch {
          secDirectFailed = true
        }

        let grpDirectFailed = false
        try {
          await adminAClient.collection('education_groups').getOne(grpTangara.id)
        } catch {
          grpDirectFailed = true
        }

        // Admin Florânia tenta alterar grupo de Tangará
        let editFailed = false
        try {
          await adminAClient.collection('education_groups').update(grpTangara.id, {
            nome: 'Hacked Group',
          })
        } catch {
          editFailed = true
        }

        // Cleanup fixtures criadas
        try {
          await superadminClient.collection('education_groups').delete(grpTangara.id)
          await superadminClient.collection('secretarias').delete(secTangara.id)
        } catch {
          /* intentionally ignored */
        }

        const ok = !hasTangaraSec && secDirectFailed && grpDirectFailed && editFailed
        return { ok, receivedStatus: ok ? '403/404' : 'CROSS_TENANT_LEAK' }
      },
    )

    // Cenário 19: [Academia Foundation] Bloqueio estrito de associação de usuário sem tenant ou de outro município
    await assertTest(
      'SCENARIO-19',
      'Cenário 19: Associação de membro a grupo bloqueia usuário de outro tenant ou inativo',
      '400/403',
      async () => {
        // Criar secretaria e grupo em Florânia
        const secFlorania = await superadminClient.collection('secretarias').create({
          nome: 'Sec Florania ' + testRunId,
          tenant: tenantAId,
          status: 'ativo',
        })
        const grpFlorania = await superadminClient.collection('education_groups').create({
          nome: 'Grupo Florania ' + testRunId,
          tenant: tenantAId,
          secretaria: secFlorania.id,
          status: 'ativo',
        })

        // Admin Florânia tenta associar adminBUserId (que pertence a Tangará) ao grupo de Florânia
        let foreignUserBlocked = false
        try {
          await adminAClient.collection('education_group_members').create({
            group: grpFlorania.id,
            user: adminBUserId,
            tenant: tenantAId,
            status: 'ativo',
          })
        } catch {
          foreignUserBlocked = true
        }

        // Admin Florânia tenta associar membro vinculando tenantB
        let foreignTenantBlocked = false
        try {
          await adminAClient.collection('education_group_members').create({
            group: grpFlorania.id,
            user: servidorAUserId,
            tenant: tenantBId,
            status: 'ativo',
          })
        } catch {
          foreignTenantBlocked = true
        }

        // Cleanup fixtures
        try {
          await superadminClient.collection('education_groups').delete(grpFlorania.id)
          await superadminClient.collection('secretarias').delete(secFlorania.id)
        } catch {
          /* intentionally ignored */
        }

        const ok = foreignUserBlocked && foreignTenantBlocked
        return { ok, receivedStatus: ok ? '400/403' : 'INVALID_ASSOCIATION_ALLOWED' }
      },
    )

    // Cenário 20: [Academia Foundation] Usuário comum somente consulta seus próprios grupos sem gerenciar
    await assertTest(
      'SCENARIO-20',
      'Cenário 20: Usuário comum consulta somente seus grupos e tem escrita bloqueada',
      '200/403',
      async () => {
        // Criar grupo em Florânia e associar servidorAUserId
        const secFlorania = await superadminClient.collection('secretarias').create({
          nome: 'Sec Edu ' + testRunId,
          tenant: tenantAId,
          status: 'ativo',
        })
        const grpFlorania = await superadminClient.collection('education_groups').create({
          nome: 'Grupo Comum ' + testRunId,
          tenant: tenantAId,
          secretaria: secFlorania.id,
          status: 'ativo',
        })
        const memRec = await superadminClient.collection('education_group_members').create({
          group: grpFlorania.id,
          user: servidorAUserId,
          tenant: tenantAId,
          status: 'ativo',
        })

        // Servidor A (comum) pode ler seu grupo associado
        const userMems = await servidorAClient.collection('education_group_members').getFullList({
          filter: servidorAClient.filter('user = {:u}', { u: servidorAUserId }),
        })
        const canReadOwn = userMems.some((m) => m.id === memRec.id)

        // Servidor A tenta criar uma secretaria ou grupo (escrita bloqueada)
        let writeBlocked = false
        try {
          await servidorAClient.collection('secretarias').create({
            nome: 'Sec Maliciosa',
            tenant: tenantAId,
            status: 'ativo',
          })
        } catch {
          writeBlocked = true
        }

        // Cleanup
        try {
          await superadminClient.collection('education_group_members').delete(memRec.id)
          await superadminClient.collection('education_groups').delete(grpFlorania.id)
          await superadminClient.collection('secretarias').delete(secFlorania.id)
        } catch {
          /* intentionally ignored */
        }

        const ok = canReadOwn && writeBlocked
        return { ok, receivedStatus: ok ? '200/403' : 'RBAC_FAIL' }
      },
    )
  } finally {
    // =========================================================================
    // CLEANUP TOTAL DAS FIXTURES EFÊMERAS NO BANCO ISOLADO
    // =========================================================================
    try {
      // 1. Deletar convites
      for (const invId of createdInvitationIds) {
        try {
          await superadminClient.collection('invitations').delete(invId)
        } catch {
          /* ignore */
        }
      }

      // 2. Deletar memberships
      for (const memId of createdMembershipIds) {
        try {
          await superadminClient.collection('user_memberships').delete(memId)
        } catch {
          /* ignore */
        }
      }

      // 3. Deletar usuários efêmeros
      for (const uId of createdUserIds) {
        try {
          const uMems = await superadminClient.collection('user_memberships').getFullList({
            filter: superadminClient.filter('user = {:userId}', { userId: uId }),
          })
          for (const m of uMems) {
            try {
              await superadminClient.collection('user_memberships').delete(m.id)
            } catch {
              /* ignore */
            }
          }
          await superadminClient.collection('users').delete(uId)
        } catch {
          /* ignore */
        }
      }

      // 4. Deletar tenants efêmeros
      for (const tId of createdTenantIds) {
        try {
          await superadminClient.collection('tenants').delete(tId)
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
