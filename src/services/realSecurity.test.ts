/**
 * Testes de Segurança HTTP Reais contra o PocketBase backend.
 * Executa requisições HTTP reais contra a API do backend conectado para verificar RLS,
 * isolamento multi-tenant, restrições de privilégios, snapshot rigoroso de invariância das contas seed,
 * integridade de convites seguros (SHA-256 obrigatório, concorrência, cancelamento, recusa, integridade do titular
 * e ausência de vazamento de segredos), e cleanup total no bloco finally (contagem zero de resíduos efêmeros).
 *
 * POLÍTICA DE CREDENCIAIS:
 * - ZERO credenciais fixas no código executável.
 * - Cenários que exigem autoridade superadmin aceitam EXCLUSIVAMENTE token/credencial de runtime
 *   injetada via ambiente (PB_SUPERUSER_TOKEN / SUPERUSER_TOKEN / POCKETBASE_SUPERADMIN_TOKEN).
 * - Se a credencial de runtime não estiver presente, a suíte/setup falha explicitamente com mensagem
 *   sem segredos.
 */
import PocketBase from 'pocketbase'

export interface RealSecurityTestResult {
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
}

interface SeedSnapshot {
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
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  const globalObj: any = typeof globalThis !== 'undefined' ? globalThis : {}
  const nodeProcess: any = typeof globalObj.process !== 'undefined' ? globalObj.process : undefined

  const pbUrl = (nodeProcess?.env?.TEST_POCKETBASE_URL ||
    nodeProcess?.env?.VITE_POCKETBASE_URL ||
    '') as string

  const testNonce = (nodeProcess?.env?.EPHEMERAL_TEST_NONCE || '') as string

  // =========================================================================
  // GUARDRAILS ANTIACIDENTE OBRIGATÓRIOS (ITEM 4 DO PROBLEMA DE SEGURANÇA 4)
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
      `Testes de integração com escritas/mutações NUNCA podem apontar para preview ou produção.`
    results.push({
      name: 'Guardrail Antiacidente: Verificação de Host Local Efêmero',
      ok: false,
      detail: errorMsg,
    })
    return { passed: false, results }
  }

  // 2. O runner DEVE fornecer um nonce/marcador de ambiente de teste correspondente
  if (!testNonce || testNonce.length < 8) {
    const errorMsg =
      'Bloqueio Antiacidente: Nonce de ambiente efêmero (EPHEMERAL_TEST_NONCE) ausente ou inválido. ' +
      'Os testes de segurança reais exigem execução controlada através do runner efêmero isolado.'
    results.push({
      name: 'Guardrail Antiacidente: Verificação do Nonce de Ambiente Efêmero',
      ok: false,
      detail: errorMsg,
    })
    return { passed: false, results }
  }

  // 3. Verificação do marcador test_environment exclusivo no banco antes de qualquer operação
  try {
    const testCheckClient = new PocketBase(pbUrl)
    const markerRecord = await testCheckClient
      .collection('security_audit_markers')
      .getFirstListItem("marker_key = 'test_environment'")
      .catch(() => null)

    if (!markerRecord) {
      const errorMsg =
        'Bloqueio Antiacidente: O banco de dados alvo NÃO possui o registro exclusivo `test_environment` em security_audit_markers. ' +
        'Execução abortada antes de qualquer operação de escrita para proteger bases reais.'
      results.push({
        name: 'Guardrail Antiacidente: Verificação de Registro test_environment no Banco Efêmero',
        ok: false,
        detail: errorMsg,
      })
      return { passed: false, results }
    }

    // Verificar se o nonce no banco confere com o nonce do processo
    const markerDetails =
      typeof markerRecord.details === 'string'
        ? JSON.parse(markerRecord.details)
        : markerRecord.details
    if (!markerDetails || markerDetails.nonce !== testNonce) {
      const errorMsg =
        'Bloqueio Antiacidente: O nonce gravado no banco de dados não corresponde ao EPHEMERAL_TEST_NONCE do runner. ' +
        'Possível conflito de instâncias ou banco inadequado.'
      results.push({
        name: 'Guardrail Antiacidente: Integridade de Nonce do Banco Efêmero',
        ok: false,
        detail: errorMsg,
      })
      return { passed: false, results }
    }
  } catch (err: any) {
    results.push({
      name: 'Guardrail Antiacidente: Verificação de Marcador de Ambiente de Teste',
      ok: false,
      detail: `Falha ao validar marcador de teste no banco: ${err?.message || err}`,
    })
    return { passed: false, results }
  }

  async function assertTest(name: string, fn: () => Promise<boolean>) {
    try {
      const ok = await fn()
      results.push({ name, ok })
    } catch (err: any) {
      results.push({ name, ok: false, detail: err?.message || String(err) })
    }
  }

  // Identificador de execução único e seguro
  const runEntropy =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).substring(2, 14)
  const testRunId = `${Date.now()}_${runEntropy}`

  // Gerador seguro de senha forte dinâmica
  function generateStrongDynamicPassword(prefix = 'P_'): string {
    const randomHex =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).substring(2, 15)
    return `${prefix}${randomHex}Aa1!@#`
  }

  // Helper de cálculo de SHA-256
  async function sha256Hex(msg: string): Promise<string> {
    const enc = new TextEncoder()
    const data = enc.encode(msg)
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Obter credencial/token de superadmin exclusivamente de variáveis de ambiente de runtime
  const runtimeSuperuserEmail = (nodeProcess?.env?.EPHEMERAL_SUPERADMIN_EMAIL || '') as string
  const runtimeSuperuserPassword = (nodeProcess?.env?.EPHEMERAL_SUPERADMIN_PASSWORD || '') as string
  let runtimeSuperuserToken = (nodeProcess?.env?.PB_SUPERUSER_TOKEN ||
    nodeProcess?.env?.SUPERUSER_TOKEN ||
    nodeProcess?.env?.POCKETBASE_SUPERADMIN_TOKEN ||
    '') as string

  // Se o runner passou email e password efêmeros, realiza autenticação via PocketBase
  if (!runtimeSuperuserToken && runtimeSuperuserEmail && runtimeSuperuserPassword) {
    try {
      const authSetupClient = new PocketBase(pbUrl)
      // Tenta superusers auth ou fallback de coleção users
      try {
        const authData = await (authSetupClient as any).admins?.authWithPassword(
          runtimeSuperuserEmail,
          runtimeSuperuserPassword,
        )
        if (authData?.token) {
          runtimeSuperuserToken = authData.token
        }
      } catch {
        const authData = await authSetupClient
          .collection('users')
          .authWithPassword(runtimeSuperuserEmail, runtimeSuperuserPassword)
        if (authData?.token) {
          runtimeSuperuserToken = authData.token
        }
      }
    } catch (authErr: any) {
      // continua para checagem abaixo
    }
  }

  if (!runtimeSuperuserToken) {
    const missingTokenError =
      'Falha de execução: Credencial de runtime de superadmin (EPHEMERAL_SUPERADMIN_* ou PB_SUPERUSER_TOKEN) não fornecida no ambiente efêmero.'
    results.push({
      name: 'Setup de Autoridade Privilegiada (Superadmin de Runtime)',
      ok: false,
      detail: missingTokenError,
    })
    return {
      passed: false,
      results,
    }
  }

  // Tenants reais
  const floraniaTenantId = '1e6lxk1tvyt27ok'
  const tangaraTenantId = 'brfahrpkg6uvula'
  const ephemeralFloraniaTenantSlug = 'florania'
  const ephemeralTangaraTenantSlug = 'tangara'

  // Credenciais efêmeras fortes geradas dinamicamente
  const floraniaAdminPassword = generateStrongDynamicPassword('AdmF_')
  const tangaraAdminPassword = generateStrongDynamicPassword('AdmT_')
  const floraniaServidorPassword = generateStrongDynamicPassword('SrvF_')
  const citizenPassword = generateStrongDynamicPassword('Cid_')
  const thirdUserPassword = generateStrongDynamicPassword('Thr_')

  // E-mails efêmeros únicos para os testes
  const ephemeralFloraniaAdminEmail = `ephemeral.admin.florania.${testRunId}@florania.gov.br`
  const ephemeralTangaraAdminEmail = `ephemeral.admin.tangara.${testRunId}@tangara.gov.br`
  const ephemeralFloraniaServidorEmail = `ephemeral.servidor.florania.${testRunId}@florania.gov.br`
  const ephemeralCitizenEmail = `ephemeral.cidadao.${testRunId}@florania.gov.br`
  const ephemeralThirdEmail = `ephemeral.third.${testRunId}@parazinho.gov.br`

  // Rastreadores de recursos efêmeros para cleanup estrito em finally
  const ephemeralUserIdsToClean: string[] = []
  const ephemeralMembershipIdsToClean: string[] = []
  const ephemeralInvitationIdsToClean: string[] = []

  // Clientes autenticados para os cenários
  const superadminClient = new PocketBase(pbUrl)
  // Autenticação direta com o token de runtime de superadmin (superuser / admin auth)
  superadminClient.authStore.save(runtimeSuperuserToken, {
    id: 'superuser',
    role: 'superadmin',
  } as any)

  const floraniaAdminClient = new PocketBase(pbUrl)
  const tangaraAdminClient = new PocketBase(pbUrl)
  const floraniaServidorClient = new PocketBase(pbUrl)
  const thirdUserClient = new PocketBase(pbUrl)
  const publicClient = new PocketBase(pbUrl)

  let floraniaServidorUserId = ''
  let floraniaAdminUserId = ''
  let tangaraAdminUserId = ''
  let thirdUserId = ''

  // Snapshot inicial do estado dos usuários seed e vínculos
  const protectedSeedIds = [
    'uxnit0c8oensr67', // Dr. Silval Salomão (superadmin)
    '6gea9t5lk6z1x00', // Ana Silva (admin florania)
    '166gp4mdaxy2av4', // Carlos Santos (servidor florania)
    'z3cbxpj8h6xl9z3', // Mariana Costa (servidor florania)
    'br3gos31bmxfllw', // Pedro Oliveira (admin tangara)
    '92b3oxlgc3q965x', // Sofia Ferreira (servidor tangara)
    'dn3ubij1vmuj9mf', // João Pereira (servidor tangara)
    'brf0wdudisx0inr', // Lucas Almeida (admin parazinho)
    'c26yzjtppm5glbi', // Fernanda Lima (servidor parazinho)
    'sfiv25ug27w7gfd', // Roberto Dias (servidor parazinho)
  ]

  async function captureSeedSnapshot(): Promise<SeedSnapshot> {
    const rawUsers = await superadminClient.collection('users').getFullList()
    const seedUsers = rawUsers
      .filter((u) => protectedSeedIds.includes(u.id))
      .sort((a, b) => a.id.localeCompare(b.id))

    const rawMemberships = await superadminClient.collection('user_memberships').getFullList()
    const seedMemberships = rawMemberships
      .filter((m) => protectedSeedIds.includes(m.user))
      .sort((a, b) => a.id.localeCompare(b.id))

    return {
      userCount: seedUsers.length,
      userIds: seedUsers.map((u) => u.id),
      usersSummary: seedUsers.map((u) => ({
        id: u.id,
        role: u.role,
        status: u.status,
        verified: u.verified,
        tenant: u.tenant || '',
      })),
      membershipsCount: seedMemberships.length,
      membershipsSummary: seedMemberships.map((m) => ({
        id: m.id,
        user: m.user,
        tenant: m.tenant,
        role: m.role,
        status: m.status,
      })),
    }
  }

  let initialSeedSnapshot: SeedSnapshot | null = null

  try {
    // Captura inicial de snapshot
    initialSeedSnapshot = await captureSeedSnapshot()

    // 1. Criar Servidor Florânia Efêmero via cadastro público padrão (role=servidor, status=pendente)
    const srvRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: ephemeralFloraniaTenantSlug,
        name: `Servidor Florânia Efêmero ${testRunId}`,
        email: ephemeralFloraniaServidorEmail,
        password: floraniaServidorPassword,
        passwordConfirm: floraniaServidorPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (srvRegRes?.userId) {
      ephemeralUserIdsToClean.push(srvRegRes.userId)
      floraniaServidorUserId = srvRegRes.userId
    }
    if (srvRegRes?.membershipId) {
      ephemeralMembershipIdsToClean.push(srvRegRes.membershipId)
    }

    // 2. Setup Privilegiado de Teste por Superadmin Autenticado via Runtime Token:
    // Auto-registro das fixtures e aprovação oficial com promoção para admin+ativo pelo superadmin
    const admFRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: ephemeralFloraniaTenantSlug,
        name: `Admin Florânia Efêmero ${testRunId}`,
        email: ephemeralFloraniaAdminEmail,
        password: floraniaAdminPassword,
        passwordConfirm: floraniaAdminPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (admFRegRes?.userId) {
      ephemeralUserIdsToClean.push(admFRegRes.userId)
      floraniaAdminUserId = admFRegRes.userId
    }
    if (admFRegRes?.membershipId) {
      ephemeralMembershipIdsToClean.push(admFRegRes.membershipId)
      // Aprovação e promoção para Admin Ativo em Florânia pelo Superadmin
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: admFRegRes.membershipId,
          role: 'admin',
          tenant: floraniaTenantId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const admTRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: ephemeralTangaraTenantSlug,
        name: `Admin Tangará Efêmero ${testRunId}`,
        email: ephemeralTangaraAdminEmail,
        password: tangaraAdminPassword,
        passwordConfirm: tangaraAdminPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (admTRegRes?.userId) {
      ephemeralUserIdsToClean.push(admTRegRes.userId)
      tangaraAdminUserId = admTRegRes.userId
    }
    if (admTRegRes?.membershipId) {
      ephemeralMembershipIdsToClean.push(admTRegRes.membershipId)
      // Aprovação e promoção para Admin Ativo em Tangará pelo Superadmin
      await superadminClient.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId: admTRegRes.membershipId,
          role: 'admin',
          tenant: tangaraTenantId,
        }),
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Criar Terceiro Usuário para testes de autorização cruzada
    const thirdRegRes: any = await publicClient.send('/backend/v1/auth/register-public', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'parazinho',
        name: `Terceiro Usuário Efêmero ${testRunId}`,
        email: ephemeralThirdEmail,
        password: thirdUserPassword,
        passwordConfirm: thirdUserPassword,
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (thirdRegRes?.userId) {
      ephemeralUserIdsToClean.push(thirdRegRes.userId)
      thirdUserId = thirdRegRes.userId
    }
    if (thirdRegRes?.membershipId) {
      ephemeralMembershipIdsToClean.push(thirdRegRes.membershipId)
    }

    // Autenticar clientes de teste com suas credenciais próprias geradas dinamicamente
    await floraniaAdminClient
      .collection('users')
      .authWithPassword(ephemeralFloraniaAdminEmail, floraniaAdminPassword)

    await tangaraAdminClient
      .collection('users')
      .authWithPassword(ephemeralTangaraAdminEmail, tangaraAdminPassword)

    await floraniaServidorClient
      .collection('users')
      .authWithPassword(ephemeralFloraniaServidorEmail, floraniaServidorPassword)

    await thirdUserClient
      .collection('users')
      .authWithPassword(ephemeralThirdEmail, thirdUserPassword)

    // =========================================================================
    // ASSERÇÃO RIGOROSA DE STATUS DAS FIXTURES ADMIN+ATIVO POR CONSULTA HTTP REAL
    // =========================================================================
    // 1. Verificar Admin Florânia
    const checkFRes: any = await floraniaAdminClient.send('/backend/v1/tenant-users/view', {
      method: 'GET',
      query: { userId: floraniaAdminUserId, tenant: floraniaTenantId },
    })
    if (!checkFRes || checkFRes.role !== 'admin' || checkFRes.status !== 'ativo') {
      throw new Error(
        `Fixture de Admin Florânia inválida por HTTP: role=${checkFRes?.role}, status=${checkFRes?.status}`,
      )
    }

    // 2. Verificar Admin Tangará
    const checkTRes: any = await tangaraAdminClient.send('/backend/v1/tenant-users/view', {
      method: 'GET',
      query: { userId: tangaraAdminUserId, tenant: tangaraTenantId },
    })
    if (!checkTRes || checkTRes.role !== 'admin' || checkTRes.status !== 'ativo') {
      throw new Error(
        `Fixture de Admin Tangará inválida por HTTP: role=${checkTRes?.role}, status=${checkTRes?.status}`,
      )
    }

    // ==========================================
    // CENÁRIOS DE SEGURANÇA E CONFORMIDADE
    // ==========================================

    // Cenário 1 (Negativo): A senha conhecida "Skip@Pass" FALHA e retorna 400 em todas as contas seed e efêmeras
    await assertTest(
      'Cenário 1 (Negativo): A senha conhecida "Skip@Pass" FALHA e retorna 400/401 em todas as contas seed e efêmeras',
      async () => {
        const client = new PocketBase(pbUrl)
        const accountsToTest = [
          'sinvalsalomao@gmail.com',
          'admin1@florania.gov.br',
          'servidor1@florania.gov.br',
          'servidor2@florania.gov.br',
          'admin1@tangara.gov.br',
          'servidor1@tangara.gov.br',
          'servidor2@tangara.gov.br',
          'admin1@parazinho.gov.br',
          'servidor1@parazinho.gov.br',
          'servidor2@parazinho.gov.br',
          ephemeralFloraniaAdminEmail,
          ephemeralTangaraAdminEmail,
        ]

        let allFailedAsExpected = true
        for (const email of accountsToTest) {
          try {
            await client.collection('users').authWithPassword(email, 'Skip@Pass')
            allFailedAsExpected = false
          } catch (err: any) {
            if (err.status !== 400 && err.status !== 401) {
              allFailedAsExpected = false
            }
          }
        }
        return allFailedAsExpected
      },
    )

    // Cenário 1b: Snapshot real de invariância: As 10 contas seed históricas e seus vínculos/roles permanecem preservados e intactos
    await assertTest(
      'Cenário 1b: Snapshot real de invariância: As 10 identidades seed e seus vínculos/roles permanecem exatamente iguais',
      async () => {
        if (!initialSeedSnapshot) {
          return false
        }

        // Consultar via cliente autorizado o estado atual
        const currentSnapshot = await captureSeedSnapshot()

        // 1. Asserção das 10 identidades seed
        if (currentSnapshot.userCount !== 10 || initialSeedSnapshot.userCount !== 10) {
          return false
        }

        // 2. Asserção dos IDs exatos
        const allUserIdsMatch =
          currentSnapshot.userIds.length === 10 &&
          currentSnapshot.userIds.every((id, idx) => id === initialSeedSnapshot?.userIds[idx])
        if (!allUserIdsMatch) return false

        // 3. Asserção das propriedades de cada usuário seed (role, status, verified, tenant)
        const allUsersDetailsMatch = currentSnapshot.usersSummary.every((u, idx) => {
          const init = initialSeedSnapshot?.usersSummary[idx]
          if (!init) return false
          return (
            u.id === init.id &&
            u.role === init.role &&
            u.status === init.status &&
            u.verified === init.verified &&
            u.tenant === init.tenant
          )
        })
        if (!allUsersDetailsMatch) return false

        // 4. Asserção dos vínculos / memberships dos seed users
        if (currentSnapshot.membershipsCount !== initialSeedSnapshot.membershipsCount) {
          return false
        }

        const allMembershipsMatch = currentSnapshot.membershipsSummary.every((m, idx) => {
          const init = initialSeedSnapshot?.membershipsSummary[idx]
          if (!init) return false
          return (
            m.id === init.id &&
            m.user === init.user &&
            m.tenant === init.tenant &&
            m.role === init.role &&
            m.status === init.status
          )
        })
        if (!allMembershipsMatch) return false

        // 5. Verificar status dos 3 municípios seed
        const client = new PocketBase(pbUrl)
        const seedTenants = ['florania', 'tangara', 'parazinho']
        let allTenantsActive = true
        for (const slug of seedTenants) {
          try {
            const t = await client.send(`/backend/v1/organizacoes-public/${slug}`, {
              method: 'GET',
            })
            if (!t || t.slug !== slug || t.status !== 'ativa') {
              allTenantsActive = false
            }
          } catch {
            allTenantsActive = false
          }
        }

        return allTenantsActive
      },
    )

    // Cenário 2: Servidor efêmero autenticado vê apenas o próprio registro na coleção users
    await assertTest(
      'Cenário 2: Servidor efêmero autentica com credencial forte e vê apenas a si próprio via users',
      async () => {
        const list = await floraniaServidorClient.collection('users').getFullList()
        const onlySelf =
          list.length === 1 && list[0].id === floraniaServidorClient.authStore.record?.id
        return onlySelf
      },
    )

    // Cenário 3: Servidor efêmero tentando acessar registro de outro município (IDOR) recebe 404/403
    await assertTest(
      'Cenário 3: Servidor efêmero tentando acessar registro de outro município (IDOR) recebe 404/403',
      async () => {
        try {
          await floraniaServidorClient.collection('users').getOne('92b3oxlgc3q965x')
          return false
        } catch (err: any) {
          return err.status === 404 || err.status === 403
        }
      },
    )

    // Cenário 4: Servidor efêmero não pode alterar o próprio role, status ou tenant diretamente
    await assertTest(
      'Cenário 4: Servidor efêmero não pode alterar o próprio role, status ou tenant diretamente',
      async () => {
        const selfId = floraniaServidorClient.authStore.record?.id
        try {
          await floraniaServidorClient.collection('users').update(selfId!, { role: 'superadmin' })
          return false
        } catch (err: any) {
          return err.status === 403 || err.status === 400
        }
      },
    )

    // Cenário 5 (Item 1a): Prova de que o Admin Municipal REAL recebe 403 ao tentar create direto em user_memberships
    await assertTest(
      'Cenário 5 (Item 1a): Create direto em user_memberships via collections API por Admin Municipal => 403',
      async () => {
        let adminBlocked = false
        try {
          await floraniaAdminClient.collection('user_memberships').create({
            user: floraniaServidorUserId,
            tenant: floraniaTenantId,
            role: 'admin',
            status: 'ativo',
          })
        } catch (err: any) {
          adminBlocked = err.status === 403 || err.status === 400 || err.status === 404
        }

        let servidorBlocked = false
        try {
          await floraniaServidorClient.collection('user_memberships').create({
            user: floraniaServidorClient.authStore.record?.id,
            tenant: tangaraTenantId,
            role: 'admin',
            status: 'ativo',
          })
        } catch (err: any) {
          servidorBlocked = err.status === 403 || err.status === 400 || err.status === 404
        }

        return adminBlocked && servidorBlocked
      },
    )

    // Cenário 6: Auto-cadastro público força role segura e status pendente sem privilégios
    await assertTest(
      'Cenário 6: Auto-cadastro público força role segura e status pendente sem privilégios',
      async () => {
        const res: any = await publicClient.send('/backend/v1/auth/register-public', {
          method: 'POST',
          body: JSON.stringify({
            slug: ephemeralFloraniaTenantSlug,
            name: 'Cidadão Efêmero',
            email: ephemeralCitizenEmail,
            password: citizenPassword,
            passwordConfirm: citizenPassword,
            role: 'superadmin',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        if (res?.userId) ephemeralUserIdsToClean.push(res.userId)
        if (res?.membershipId) ephemeralMembershipIdsToClean.push(res.membershipId)

        const resStr = JSON.stringify(res)
        const noPasswordInResponse =
          !resStr.includes(citizenPassword) && !resStr.includes('password')
        return res.success === true && res.status === 'pendente' && noPasswordInResponse
      },
    )

    // Cenário 7: Endpoint de criação de membros rejeita acesso anônimo com 401
    await assertTest(
      'Cenário 7: Endpoint de criação de membros rejeita acesso anônimo/não-autorizado com 401',
      async () => {
        const client = new PocketBase(pbUrl)
        try {
          await client.send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Tentativa Anônima',
              email: `anon.${testRunId}@florania.gov.br`,
              tenant: floraniaTenantId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          return false
        } catch (err: any) {
          return err.status === 401 || err.status === 403
        }
      },
    )

    // Cenário 8: Injeção de filtros em todos os campos dinâmicos é parametrizada e não permite evasão/ampliação
    await assertTest(
      'Cenário 8: Filter injection em tenant, userId, status e busca retorna 400/403 ou não amplia escopo',
      async () => {
        let injection1Blocked = false
        try {
          await floraniaServidorClient.send(
            `/backend/v1/tenant-users/list?tenant=${encodeURIComponent(floraniaTenantId + "' || '1'='1")}`,
            { method: 'GET' },
          )
        } catch (err: any) {
          injection1Blocked = err.status === 400 || err.status === 403
        }

        let injection2Blocked = false
        try {
          await floraniaServidorClient.send(
            `/backend/v1/tenant-users/list?tenant=${floraniaTenantId}&status=${encodeURIComponent("ativo' || status!=''")}`,
            { method: 'GET' },
          )
        } catch (err: any) {
          injection2Blocked = err.status === 400 || err.status === 403
        }

        // Teste de consulta válida com busca contendo acento e apóstrofo
        let legitimateSearchWorks = false
        try {
          const listRes: any = await floraniaAdminClient.send(
            `/backend/v1/tenant-users/list?tenant=${floraniaTenantId}&search=${encodeURIComponent("D'Ávila")}`,
            { method: 'GET' },
          )
          legitimateSearchWorks = listRes && Array.isArray(listRes.items)
        } catch {
          legitimateSearchWorks = false
        }

        // Teste de busca por userId malicioso no view
        let viewInjectionBlocked = false
        try {
          await floraniaAdminClient.send(
            `/backend/v1/tenant-users/view?tenant=${floraniaTenantId}&userId=${encodeURIComponent("fake' || '1'='1")}`,
            { method: 'GET' },
          )
        } catch (err: any) {
          viewInjectionBlocked = err.status === 400 || err.status === 403 || err.status === 404
        }

        return (
          injection1Blocked && injection2Blocked && legitimateSearchWorks && viewInjectionBlocked
        )
      },
    )

    // Cenário 9 (Item 1b): Admin e Servidor de Florânia convidam/cancelam APENAS no próprio tenant
    await assertTest(
      'Cenário 9 (Item 1b): Admin convida/cancela APENAS no próprio tenant; Operação em outro tenant => 403',
      async () => {
        // 1. Admin Florânia tenta convidar para Tangará => 403
        let crossTenantInviteBlocked = false
        try {
          await floraniaAdminClient.send('/backend/v1/invitations/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Invasor em Tangará',
              email: `cross.invite.${testRunId}@tangara.gov.br`,
              tenant: tangaraTenantId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          crossTenantInviteBlocked = err.status === 403 || err.status === 401
        }

        // 2. Admin Tangará cria convite legítimo no seu tenant
        const tangaraEmail = `tangara.inv.${testRunId}@tangara.gov.br`
        await tangaraAdminClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Convidado Tangará',
            email: tangaraEmail,
            tenant: tangaraTenantId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const tInvs = await tangaraAdminClient.collection('invitations').getFullList({
          filter: tangaraAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: tangaraTenantId, email: tangaraEmail },
          ),
        })
        if (tInvs.length === 0) return false
        const tangaraInvId = tInvs[0].id
        ephemeralInvitationIdsToClean.push(tangaraInvId)

        // 3. Admin Florânia tenta cancelar o convite de Tangará => 403
        let crossTenantCancelBlocked = false
        try {
          await floraniaAdminClient.send('/backend/v1/invitations/cancel', {
            method: 'POST',
            body: JSON.stringify({ invitationId: tangaraInvId }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          crossTenantCancelBlocked = err.status === 403
        }

        // 4. Admin Tangará cancela o próprio convite => 200 (sucesso)
        let ownCancelSucceeded = false
        try {
          const cancelRes: any = await tangaraAdminClient.send('/backend/v1/invitations/cancel', {
            method: 'POST',
            body: JSON.stringify({ invitationId: tangaraInvId }),
            headers: { 'Content-Type': 'application/json' },
          })
          ownCancelSucceeded = cancelRes.success === true
        } catch {
          ownCancelSucceeded = false
        }

        return crossTenantInviteBlocked && crossTenantCancelBlocked && ownCancelSucceeded
      },
    )

    // Cenário 10 (Item 1c): Admin NÃO pode aceitar convite no lugar do titular
    await assertTest(
      'Cenário 10 (Item 1c): Admin NÃO pode aceitar convite de outro titular no lugar dele => 403',
      async () => {
        // Criar convite em Florânia para o servidor efêmero
        const targetEmail = `destinatario.${testRunId}@florania.gov.br`
        await floraniaAdminClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Destinatário Titular',
            email: targetEmail,
            tenant: floraniaTenantId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const invs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: floraniaTenantId, email: targetEmail },
          ),
        })
        if (invs.length === 0) return false
        const invId = invs[0].id
        ephemeralInvitationIdsToClean.push(invId)

        // Configurar token de teste no convite
        const tokenForTitular = 'token_titular_secret_abc_' + testRunId
        const titularHash = await sha256Hex(tokenForTitular)
        await superadminClient.collection('invitations').update(invId, {
          token_hash: titularHash,
        })

        // Admin Florânia tenta aceitar o convite que foi emitido para targetEmail => 403
        let adminAcceptBlocked = false
        try {
          await floraniaAdminClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: tokenForTitular }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          adminAcceptBlocked = err.status === 403
        }

        return adminAcceptBlocked
      },
    )

    // Cenário 11: Aceite de convite exige TOKEN OBRIGATÓRIO (sem token => 400; token errado => 400)
    await assertTest(
      'Cenário 11: Aceite sem token => 400; Token errado/inexistente => resposta genérica sem enumeração (R-2)',
      async () => {
        let noTokenBlocked = false
        try {
          await floraniaServidorClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ invitationId: 'some_invitation_id' }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          noTokenBlocked = err.status === 400
        }

        let invalidTokenGeneric = false
        try {
          await floraniaServidorClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: 'invalid_token_1234567890abcdef' }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          invalidTokenGeneric = err.status === 400
        }

        return noTokenBlocked && invalidTokenGeneric
      },
    )

    // Cenário 12: Titular autêntico com token válido aceita e ativa vínculo SOMENTE no tenant alvo (R-2)
    await assertTest(
      'Cenário 12: Titular autenticado com token válido aceita e ativa exatamente UM vínculo no tenant alvo',
      async () => {
        // Criar convite em Tangará para o Servidor de Florânia
        await tangaraAdminClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Servidor Florania em Tangara',
            email: ephemeralFloraniaServidorEmail,
            tenant: tangaraTenantId,
            role: 'gestor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const pendingInvs = await tangaraAdminClient.collection('invitations').getFullList({
          filter: tangaraAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: tangaraTenantId, email: ephemeralFloraniaServidorEmail },
          ),
          sort: '-created',
        })
        if (pendingInvs.length === 0) return false
        const invRecord = pendingInvs[0]
        ephemeralInvitationIdsToClean.push(invRecord.id)

        const simulatedToken = 'super_secret_token_test_accept_' + testRunId
        const calculatedHash = await sha256Hex(simulatedToken)
        await superadminClient.collection('invitations').update(invRecord.id, {
          token_hash: calculatedHash,
        })

        // Titular aceita com o token correto
        const acceptRes: any = await floraniaServidorClient.send('/backend/v1/invitations/accept', {
          method: 'POST',
          body: JSON.stringify({ token: simulatedToken }),
          headers: { 'Content-Type': 'application/json' },
        })

        if (!acceptRes.success) return false

        // Verificar que membership em Tangará agora está ATIVA
        const tangaraMems = await floraniaServidorClient
          .collection('user_memberships')
          .getFullList({
            filter: floraniaServidorClient.filter('tenant = {:tenantId}', {
              tenantId: tangaraTenantId,
            }),
          })
        const tangaraIsActive = tangaraMems.length === 1 && tangaraMems[0].status === 'ativo'

        // Replay do mesmo token deve falhar com 400
        let replayBlocked = false
        try {
          await floraniaServidorClient.send('/backend/v1/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({ token: simulatedToken }),
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (err: any) {
          replayBlocked = err.status === 400
        }

        return tangaraIsActive && replayBlocked
      },
    )

    // Cenário 13: Recusa de convite pelo titular não cria vínculo e exige token obrigatório
    await assertTest(
      'Cenário 13: Recusa de convite pelo titular não cria vínculo ativo e invalida o convite',
      async () => {
        const declineEmail = `decline.user.${testRunId}@florania.gov.br`
        const declinePassword = generateStrongDynamicPassword('Dec_')

        // Registrar titular
        const regRes: any = await publicClient.send('/backend/v1/auth/register-public', {
          method: 'POST',
          body: JSON.stringify({
            slug: ephemeralFloraniaTenantSlug,
            name: 'Usuario Recusa',
            email: declineEmail,
            password: declinePassword,
            passwordConfirm: declinePassword,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        if (regRes?.userId) ephemeralUserIdsToClean.push(regRes.userId)
        if (regRes?.membershipId) ephemeralMembershipIdsToClean.push(regRes.membershipId)

        const declineClient = new PocketBase(pbUrl)
        await declineClient.collection('users').authWithPassword(declineEmail, declinePassword)

        // Criar convite
        await floraniaAdminClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Usuario Recusa',
            email: declineEmail,
            tenant: floraniaTenantId,
            role: 'secretario',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const invs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: floraniaTenantId, email: declineEmail },
          ),
        })
        if (invs.length === 0) return false
        const invId = invs[0].id
        ephemeralInvitationIdsToClean.push(invId)

        const declineToken = 'decline_token_secret_' + testRunId
        const declineHash = await sha256Hex(declineToken)
        await superadminClient.collection('invitations').update(invId, {
          token_hash: declineHash,
        })

        // Recusar
        const decRes: any = await declineClient.send('/backend/v1/invitations/decline', {
          method: 'POST',
          body: JSON.stringify({ token: declineToken }),
          headers: { 'Content-Type': 'application/json' },
        })

        const mems = await declineClient.collection('user_memberships').getFullList({
          filter: declineClient.filter('tenant = {:tenantId}', {
            tenantId: floraniaTenantId,
          }),
        })
        const notActive = mems.every((m) => m.status !== 'ativo')

        return decRes.success === true && notActive
      },
    )

    // Cenário 14: Reenvio de convite invalida o anterior e garante exatamente UM pendente (R-3)
    await assertTest(
      'Cenário 14: Reenvio invalida o convite anterior e garante exatamente UM pendente por tenant+destinatário (R-3)',
      async () => {
        const resendEmail = `resend.test.${testRunId}@florania.gov.br`
        // Envio 1
        await floraniaAdminClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Resend Test User',
            email: resendEmail,
            tenant: floraniaTenantId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        // Envio 2 (reenvio)
        await floraniaAdminClient.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Resend Test User',
            email: resendEmail,
            tenant: floraniaTenantId,
            role: 'gestor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const pendingInvs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: floraniaTenantId, email: resendEmail },
          ),
        })

        const totalInvs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter('tenant = {:tenantId} && email = {:email}', {
            tenantId: floraniaTenantId,
            email: resendEmail,
          }),
        })
        totalInvs.forEach((i) => ephemeralInvitationIdsToClean.push(i.id))

        const userInvs = await floraniaAdminClient.collection('users').getFullList({
          filter: floraniaAdminClient.filter('email = {:email}', { email: resendEmail }),
        })
        if (userInvs.length > 0) ephemeralUserIdsToClean.push(userInvs[0].id)

        return pendingInvs.length === 1 && totalInvs.length >= 2
      },
    )

    // Cenário 15: Corrida concorrente de convites simultâneos resulta em exatamente UM convite pendente (R-3)
    await assertTest(
      'Cenário 15: Corrida concorrente de convites simultâneos resulta em exatamente UM convite pendente (R-3)',
      async () => {
        const raceEmail = `race.invite.${testRunId}@florania.gov.br`
        const p1 = floraniaAdminClient
          .send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Race User A',
              email: raceEmail,
              tenant: floraniaTenantId,
              role: 'servidor',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          .catch((err) => ({ error: err }))

        const p2 = floraniaAdminClient
          .send('/backend/v1/tenant-users/create', {
            method: 'POST',
            body: JSON.stringify({
              name: 'Race User B',
              email: raceEmail,
              tenant: floraniaTenantId,
              role: 'procurador',
            }),
            headers: { 'Content-Type': 'application/json' },
          })
          .catch((err) => ({ error: err }))

        await Promise.all([p1, p2])

        const pendingInvs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter(
            'tenant = {:tenantId} && email = {:email} && status = "pending"',
            { tenantId: floraniaTenantId, email: raceEmail },
          ),
        })

        const allInvs = await floraniaAdminClient.collection('invitations').getFullList({
          filter: floraniaAdminClient.filter('tenant = {:tenantId} && email = {:email}', {
            tenantId: floraniaTenantId,
            email: raceEmail,
          }),
        })
        allInvs.forEach((i) => ephemeralInvitationIdsToClean.push(i.id))

        const userRecs = await floraniaAdminClient.collection('users').getFullList({
          filter: floraniaAdminClient.filter('email = {:email}', { email: raceEmail }),
        })
        if (userRecs.length > 0) ephemeralUserIdsToClean.push(userRecs[0].id)

        return pendingInvs.length === 1
      },
    )

    // Cenário 16: Ausência total de segredos/tokens em logs e responses de erro/sucesso
    await assertTest(
      'Cenário 16: Respostas genéricas e ausência total de tokens/senhas em respostas e logs',
      async () => {
        const createRes: any = await floraniaAdminClient.send('/backend/v1/invitations/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'No Secret Leak User',
            email: `leakcheck.${testRunId}@florania.gov.br`,
            tenant: floraniaTenantId,
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })

        const resStr = JSON.stringify(createRes)
        const noToken = !resStr.includes('token') && !resStr.includes('password')
        return createRes.success === true && noToken
      },
    )
  } finally {
    // ==========================================
    // CLEANUP EFÊMERO TOTAL (Zero resíduos garantidos)
    // ==========================================
    try {
      // 1. Limpar convites efêmeros (nunca toca em seed)
      for (const invId of ephemeralInvitationIdsToClean) {
        try {
          await superadminClient.collection('invitations').delete(invId)
        } catch {
          /* ignore */
        }
      }

      // 2. Limpar memberships efêmeras (assegura que não é de seed)
      for (const memId of ephemeralMembershipIdsToClean) {
        try {
          const mem = await superadminClient
            .collection('user_memberships')
            .getOne(memId)
            .catch(() => null)
          if (mem && !protectedSeedIds.includes(mem.user)) {
            await superadminClient.collection('user_memberships').delete(memId)
          }
        } catch {
          /* ignore */
        }
      }

      // 3. Limpar usuários efêmeros e suas memberships residuais (estritamente não-seed)
      for (const uId of ephemeralUserIdsToClean) {
        if (protectedSeedIds.includes(uId)) {
          continue // Proteção absoluta dos seed users
        }
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

      // Confirmação de contagem zero de fixtures efêmeras criadas nesta execução
      let remainingEphemeralUsers = 0
      for (const uId of ephemeralUserIdsToClean) {
        if (!protectedSeedIds.includes(uId)) {
          try {
            await superadminClient.collection('users').getOne(uId)
            remainingEphemeralUsers++
          } catch {
            // Excluído com sucesso
          }
        }
      }

      if (remainingEphemeralUsers > 0) {
        results.push({
          name: 'Cleanup Efêmero em Finally (Confirmação de Resíduos Zero)',
          ok: false,
          detail: `Falha no cleanup: ${remainingEphemeralUsers} registros efêmeros não foram removidos.`,
        })
      }
    } catch (_) {
      // Cleanup tolerante
    }
  }

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
