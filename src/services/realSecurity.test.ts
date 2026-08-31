/**
 * Testes de Segurança HTTP Reais contra o PocketBase backend.
 * Executa requisições HTTP reais contra a API do backend conectado para verificar RLS,
 * isolamento de PII, restrições de permissões, proteção de rotas e integridade multi-tenant.
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
    // Todos os registros retornados devem ser exclusivamente do tenant 1e6lxk1tvyt27ok ou do próprio usuário
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

  // 6.1 Cenário: Servidor A tentando criar membership com role=admin e status=ativo em outro tenant (CRIT-1 direto) recebe 403/400/404
  await assertTest(
    'CRIT-1: Servidor A não pode criar membership com role=admin e status=ativo em outro tenant',
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

  // 6.2 Cenário: CRIT-2: Listagem/Update de users entre tenants vazando PII retorna 403/404
  await assertTest(
    'CRIT-2: Listagem/Update direto de users entre tenants bloqueado sem vazamento de PII',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')
      // Tentativa de getOne em outro usuário
      let idorBlocked = false
      try {
        await client.collection('users').getOne('92b3oxlgc3q965x')
      } catch (err: any) {
        idorBlocked = err.status === 404 || err.status === 403
      }

      // Tentativa de update direto em outro usuário
      let updateBlocked = false
      try {
        await client.collection('users').update('92b3oxlgc3q965x', { name: 'Compromised' })
      } catch (err: any) {
        updateBlocked = err.status === 404 || err.status === 403 || err.status === 400
      }

      return idorBlocked && updateBlocked
    },
  )

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
          role: 'superadmin', // Tentativa maliciosa de se registrar como superadmin
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      return res.success === true && res.status === 'pendente'
    },
  )

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
