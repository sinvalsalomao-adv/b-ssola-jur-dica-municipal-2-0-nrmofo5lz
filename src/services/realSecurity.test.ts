/**
 * Testes de Segurança HTTP Reais contra o PocketBase backend.
 * Executa requisições HTTP reais contra a API do backend conectado para verificar RLS,
 * isolamento de PII, restrições de permissões, proteção de rotas, injeção de filtros e integridade multi-tenant.
 */
import PocketBase from 'pocketbase'

export interface RealSecurityTestResult {
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
}

export async function runRealSecurityTests(): Promise<RealSecurityTestResult> {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []
  const pbUrl =
    (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.VITE_POCKETBASE_URL) ||
    'https://bussola-juridica-municipal-0e0e1.shrd00.internal.goskip.dev'

  async function assertTest(name: string, fn: () => Promise<boolean>) {
    try {
      const ok = await fn()
      results.push({ name, ok })
    } catch (err: any) {
      results.push({ name, ok: false, detail: err?.message || String(err) })
    }
  }

  // 1. Cenário: Servidor A não lista usuários nem lê e-mails de B
  await assertTest(
    'Servidor A não lista usuários de B e não tem acesso a outros usuários via users',
    async () => {
      const client = new PocketBase(pbUrl)
      // Servidor Carlos (Florânia)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')
      const list = await client.collection('users').getFullList()
      // Deve ver apenas a si próprio
      const onlySelf = list.length === 1 && list[0].id === client.authStore.record?.id
      return onlySelf
    },
  )

  // 2. Cenário: Servidor A tentando acessar registro de usuário de B via getOne
  await assertTest(
    'Servidor A tentando acessar usuário do Município B (IDOR) recebe 404/403',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')
      try {
        // ID do servidor Sofia de Tangará: 92b3oxlgc3q965x
        await client.collection('users').getOne('92b3oxlgc3q965x')
        return false // Não deveria conseguir ler
      } catch (err: any) {
        return err.status === 404 || err.status === 403
      }
    },
  )

  // 3. Cenário: Servidor tentando alterar o próprio role, status ou tenant
  await assertTest(
    'Servidor não pode alterar o próprio role, status ou tenant diretamente',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')
      const selfId = client.authStore.record?.id
      try {
        await client.collection('users').update(selfId!, { role: 'superadmin' })
        return false
      } catch (err: any) {
        // Rejeitado pelo user_security_guard (403)
        return err.status === 403 || err.status === 400
      }
    },
  )

  // 4. Cenário: Servidor não cria membership diretamente
  await assertTest(
    'Servidor não pode criar membership diretamente na coleção user_memberships',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')
      try {
        await client.collection('user_memberships').create({
          user: client.authStore.record?.id,
          tenant: 'brfahrpkg6uvula', // Tangará
          role: 'admin',
          status: 'ativo',
        })
        return false
      } catch (err: any) {
        return err.status === 403 || err.status === 400 || err.status === 404
      }
    },
  )

  // 5. Cenário: Admin A lista memberships do seu município e não de B
  await assertTest('Admin do Município A lista apenas memberships de A e não de B', async () => {
    const client = new PocketBase(pbUrl)
    // Admin Ana Silva de Florânia (1e6lxk1tvyt27ok)
    await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
    const mems = await client.collection('user_memberships').getFullList()
    const allBelongToFloraniaOrSelf = mems.every(
      (m: any) => m.tenant === '1e6lxk1tvyt27ok' || m.user === client.authStore.record?.id,
    )
    const noneFromTangara = mems.every((m: any) => m.tenant !== 'brfahrpkg6uvula')
    return allBelongToFloraniaOrSelf && noneFromTangara
  })

  // 6. Cenário: Admin A não cria membership no Município B nem se auto-promove em B
  await assertTest('Admin A não cria membership em B nem transfere vínculo para B', async () => {
    const client = new PocketBase(pbUrl)
    await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
    try {
      await client.collection('user_memberships').create({
        user: client.authStore.record?.id,
        tenant: 'brfahrpkg6uvula', // Tangará
        role: 'admin',
        status: 'ativo',
      })
      return false
    } catch (err: any) {
      return err.status === 403 || err.status === 400 || err.status === 404
    }
  })

  // 7. Cenário: Superadmin mantém acesso global
  await assertTest(
    'Superadmin mantém acesso global a listagem de users e memberships',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('sinvalsalomao@gmail.com', 'Skip@Pass')
      const users = await client.collection('users').getFullList()
      const mems = await client.collection('user_memberships').getFullList()
      return users.length > 5 && mems.length > 5
    },
  )

  // 8. Cenário: Endpoint /backend/v1/tenant-users/create cria vínculo seguro sem vazar senha
  await assertTest(
    'Endpoint /backend/v1/tenant-users/create cria usuário/vínculo seguro sem retorno de senha',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
      const uniqueEmail = `test.user.${Date.now()}@florania.gov.br`
      const res = await client.send('/backend/v1/tenant-users/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Usuário Teste Seguro',
          email: uniqueEmail,
          tenant: '1e6lxk1tvyt27ok',
          role: 'servidor',
          password: 'Password@2026Strong',
          passwordConfirm: 'Password@2026Strong',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const payload = JSON.stringify(res)
      const noPasswordLeak =
        !payload.includes('Password@2026Strong') && !payload.includes('password')
      const isSuccess = res.success === true && res.membership?.status === 'ativo'
      return noPasswordLeak && isSuccess
    },
  )

  // 9. Cenário: Admin A não pode criar usuário no endpoint em município alheio
  await assertTest(
    'Admin A não pode criar usuário em Município B via /backend/v1/tenant-users/create',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
      try {
        await client.send('/backend/v1/tenant-users/create', {
          method: 'POST',
          body: JSON.stringify({
            name: 'Hacker Attempt',
            email: `hacker.${Date.now()}@tangara.gov.br`,
            tenant: 'brfahrpkg6uvula', // Tangará
            role: 'admin',
            password: 'Password@2026Strong',
            passwordConfirm: 'Password@2026Strong',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
        return false
      } catch (err: any) {
        return err.status === 403 || err.status === 400
      }
    },
  )

  // 10. Cenário: Auto-cadastro público força role 'servidor' e status 'pendente'
  await assertTest(
    'Auto-cadastro público força role segura e status pendente sem privilégios',
    async () => {
      const client = new PocketBase(pbUrl)
      const uniqueEmail = `cidadao.${Date.now()}@florania.gov.br`
      const res = await client.send('/backend/v1/auth/register-public', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'florania',
          name: 'Cidadão Solicitante',
          email: uniqueEmail,
          password: 'Password@2026Cidadao',
          passwordConfirm: 'Password@2026Cidadao',
          role: 'superadmin',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      return res.success === true && res.status === 'pendente'
    },
  )

  // 11. Cenário: Admin A lista usuários do próprio tenant exigindo tenant explícito (R-1c)
  await assertTest(
    'Admin A lista apenas usuários do seu município via /backend/v1/tenant-users/list com tenant explícito',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      // Sem tenant explícito deve retornar 400 (R-1c)
      let noTenantBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/list', { method: 'GET' })
      } catch (err: any) {
        noTenantBlocked = err.status === 400
      }

      // Com tenant explícito de Florânia
      const res: any = await client.send('/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok', {
        method: 'GET',
      })
      const items = res.items || []
      const allFlorania = items.every((u: any) => u.tenantId === '1e6lxk1tvyt27ok')
      const noneTangara = items.every((u: any) => u.tenantId !== 'brfahrpkg6uvula')
      const hasCarlos = items.some((u: any) => u.email === 'servidor1@florania.gov.br')

      return noTenantBlocked && items.length > 0 && allFlorania && noneTangara && hasCarlos
    },
  )

  // 12. Cenário R-1d: Testes de Filter Injection no endpoint tenant-users/list
  await assertTest(
    'R-1d: Filter injection em tenant, userId, status e busca retorna 400 ou não amplia resultados',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      // Injeção 1: Malformed tenant parameter
      let injection1Blocked = false
      try {
        await client.send("/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok' || '1'='1", {
          method: 'GET',
        })
      } catch (err: any) {
        injection1Blocked = err.status === 400 || err.status === 403
      }

      // Injeção 2: Malformed status parameter
      let injection2Blocked = false
      try {
        await client.send(
          "/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok&status=ativo' || status!=''",
          { method: 'GET' },
        )
      } catch (err: any) {
        injection2Blocked = err.status === 400
      }

      // Injeção 3: Injeção na busca com aspas e operadores
      const searchRes: any = await client.send(
        "/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok&search=' OR 1=1 --",
        { method: 'GET' },
      )
      const searchItems = searchRes.items || []
      const injection3Safe = searchItems.length === 0 // Não deve retornar nada pois busca literal

      // Injeção 4: Injeção em userId no view
      let injection4Blocked = false
      try {
        await client.send(
          "/backend/v1/tenant-users/view?userId=166gp4mdaxy2av4' || '1'='1&tenant=1e6lxk1tvyt27ok",
          { method: 'GET' },
        )
      } catch (err: any) {
        injection4Blocked = err.status === 400 || err.status === 404
      }

      return injection1Blocked && injection2Blocked && injection3Safe && injection4Blocked
    },
  )

  // 13. Cenário: Admin A visualiza usuário de A com tenant explícito e recebe 403 ao tentar operar B (R-1c)
  await assertTest(
    'Admin A visualiza usuário de A com tenant explícito e recebe 403 ao tentar operar tenant B',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      // Visualizar Carlos com tenant explícito de Florânia
      const viewFlorania: any = await client.send(
        '/backend/v1/tenant-users/view?userId=166gp4mdaxy2av4&tenant=1e6lxk1tvyt27ok',
        { method: 'GET' },
      )
      const successA =
        viewFlorania.id === '166gp4mdaxy2av4' && viewFlorania.email === 'servidor1@florania.gov.br'

      // Tentativa de Admin A de consultar passando tenant B (Tangará) -> 403
      let blockedTenantB = false
      try {
        await client.send(
          '/backend/v1/tenant-users/view?userId=92b3oxlgc3q965x&tenant=brfahrpkg6uvula',
          { method: 'GET' },
        )
      } catch (err: any) {
        blockedTenantB = err.status === 403
      }

      return successA && blockedTenantB
    },
  )

  // 14. Cenário: Admin A edita perfil/vínculo de usuário de A com tenant explícito
  await assertTest(
    'Admin A edita servidor de A com tenant explícito mas não promove a superadmin',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      // Tentar promover Carlos a superadmin -> 403
      let promoteBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/update', {
          method: 'POST',
          body: JSON.stringify({
            userId: '166gp4mdaxy2av4',
            tenant: '1e6lxk1tvyt27ok',
            role: 'superadmin',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        promoteBlocked = err.status === 403 || err.status === 400
      }

      // Atualizar com role permitida (gestor) e nome
      const updateRes: any = await client.send('/backend/v1/tenant-users/update', {
        method: 'POST',
        body: JSON.stringify({
          userId: '166gp4mdaxy2av4',
          tenant: '1e6lxk1tvyt27ok',
          name: 'Carlos Santos Atualizado',
          role: 'gestor',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const updateOk = updateRes.success === true && updateRes.user?.role === 'gestor'

      // Restaurar para servidor
      await client.send('/backend/v1/tenant-users/update', {
        method: 'POST',
        body: JSON.stringify({
          userId: '166gp4mdaxy2av4',
          tenant: '1e6lxk1tvyt27ok',
          name: 'Carlos Santos',
          role: 'servidor',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      return promoteBlocked && updateOk
    },
  )

  // 15. Cenário R-1b: Endpoints de aprovação e rejeição de memberships com regras de segurança
  await assertTest(
    'R-1b: Endpoints /approve e /reject validam tenant, barram admin alheio e impedem autopromoção',
    async () => {
      const superClient = new PocketBase(pbUrl)
      await superClient.collection('users').authWithPassword('sinvalsalomao@gmail.com', 'Skip@Pass')

      // Criar usuário com solicitação pendente em Florânia
      const regRes: any = await superClient.send('/backend/v1/auth/register-public', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'florania',
          name: 'Candidato Florania',
          email: `candidato.${Date.now()}@florania.gov.br`,
          password: 'Password@2026Strong',
          passwordConfirm: 'Password@2026Strong',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Buscar a membership pendente criada
      const pendingList: any = await superClient.send(
        '/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok&status=pendente',
        { method: 'GET' },
      )
      const targetMem = (pendingList.items || []).find((i: any) => i.email.includes('candidato.'))
      if (!targetMem || !targetMem.membershipId) return false

      const membershipId = targetMem.membershipId

      // 1. Admin de Tangará tenta aprovar a membership de Florânia -> 403
      const adminTangara = new PocketBase(pbUrl)
      await adminTangara.collection('users').authWithPassword('admin1@tangara.gov.br', 'Skip@Pass')
      let tangaraBlocked = false
      try {
        await adminTangara.send('/backend/v1/tenant-users/approve', {
          method: 'POST',
          body: JSON.stringify({
            membershipId,
            tenant: '1e6lxk1tvyt27ok',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        tangaraBlocked = err.status === 403
      }

      // 2. Admin de Florânia aprova legitimamente com cargo gestor
      const adminFlorania = new PocketBase(pbUrl)
      await adminFlorania
        .collection('users')
        .authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      const approveRes: any = await adminFlorania.send('/backend/v1/tenant-users/approve', {
        method: 'POST',
        body: JSON.stringify({
          membershipId,
          tenant: '1e6lxk1tvyt27ok',
          role: 'gestor',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const approveOk = approveRes.success === true && approveRes.membership?.status === 'ativo'

      // 3. Admin de Florânia rejeita (inativa/rejeita) via endpoint de rejeição
      const rejectRes: any = await adminFlorania.send('/backend/v1/tenant-users/reject', {
        method: 'POST',
        body: JSON.stringify({
          membershipId,
          tenant: '1e6lxk1tvyt27ok',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const rejectOk = rejectRes.success === true && rejectRes.membership?.status === 'rejeitado'

      return tangaraBlocked && approveOk && rejectOk
    },
  )

  // 16. Cenário R-1c: Administrador Multi-Tenant gerencia Município A e Município B separadamente pelo tenantId explícito
  await assertTest(
    'R-1c: Admin multi-tenant gerencia A e B separadamente com base no tenantId explícito',
    async () => {
      const superClient = new PocketBase(pbUrl)
      await superClient.collection('users').authWithPassword('sinvalsalomao@gmail.com', 'Skip@Pass')

      // Criar ou garantir admin multi-tenant em Florânia e Parazinho
      const multiAdminEmail = `multi.admin.${Date.now()}@teste.gov.br`
      await superClient.send('/backend/v1/tenant-users/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Admin Multi Municipal',
          email: multiAdminEmail,
          tenant: '1e6lxk1tvyt27ok', // Florânia
          role: 'admin',
          password: 'Password@2026Multi',
          passwordConfirm: 'Password@2026Multi',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Vincular também em Parazinho (wzio6lp1dq4y6xd)
      await superClient.send('/backend/v1/tenant-users/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Admin Multi Municipal',
          email: multiAdminEmail,
          tenant: 'wzio6lp1dq4y6xd', // Parazinho
          role: 'admin',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Logar como esse Admin Multi-Tenant
      const multiClient = new PocketBase(pbUrl)
      await multiClient.collection('users').authWithPassword(multiAdminEmail, 'Password@2026Multi')

      // 1. Gerenciar Florânia explicitamente
      const listFlorania: any = await multiClient.send(
        '/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok',
        { method: 'GET' },
      )
      const okFlorania =
        (listFlorania.items || []).every((u: any) => u.tenantId === '1e6lxk1tvyt27ok') &&
        listFlorania.items.length > 0

      // 2. Gerenciar Parazinho explicitamente
      const listParazinho: any = await multiClient.send(
        '/backend/v1/tenant-users/list?tenant=wzio6lp1dq4y6xd',
        { method: 'GET' },
      )
      const okParazinho =
        (listParazinho.items || []).every((u: any) => u.tenantId === 'wzio6lp1dq4y6xd') &&
        listParazinho.items.length > 0

      // 3. Tentar operar Tangará (onde NÃO é admin) -> 403
      let tangaraBlocked = false
      try {
        await multiClient.send('/backend/v1/tenant-users/list?tenant=brfahrpkg6uvula', {
          method: 'GET',
        })
      } catch (err: any) {
        tangaraBlocked = err.status === 403
      }

      return okFlorania && okParazinho && tangaraBlocked
    },
  )

  // 17. Cenário: Servidor comum e usuário pendente recebem 403 no endpoint de gestão
  await assertTest(
    'Servidor comum recebe 403 ao tentar listar ou editar usuários via endpoint de gestão',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')

      let listBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/list?tenant=1e6lxk1tvyt27ok', { method: 'GET' })
      } catch (err: any) {
        listBlocked = err.status === 403 || err.status === 401
      }

      let updateBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/update', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'z3cbxpj8h6xl9z3',
            tenant: '1e6lxk1tvyt27ok',
            name: 'Attempt',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        updateBlocked = err.status === 403 || err.status === 401
      }

      return listBlocked && updateBlocked
    },
  )

  // 18. Cenário: Impedir que o último admin ativo seja removido ou rebaixado
  await assertTest(
    'Não é permitido desvincular ou rebaixar o único administrador ativo de um município',
    async () => {
      const client = new PocketBase(pbUrl)
      // Pedro Oliveira é o único admin ativo de Tangará (brfahrpkg6uvula)
      await client.collection('users').authWithPassword('admin1@tangara.gov.br', 'Skip@Pass')

      let demoteBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/update', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'br3gos31bmxfllw',
            tenant: 'brfahrpkg6uvula',
            role: 'servidor',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        demoteBlocked = err.status === 400 || err.status === 403
      }

      let unlinkBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/delete', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'br3gos31bmxfllw',
            tenant: 'brfahrpkg6uvula',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        unlinkBlocked = err.status === 400 || err.status === 403
      }

      return demoteBlocked && unlinkBlocked
    },
  )

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
