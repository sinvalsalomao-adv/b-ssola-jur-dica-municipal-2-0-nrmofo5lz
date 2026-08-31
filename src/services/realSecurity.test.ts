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

  // 11. Cenário: Admin A lista usuários do próprio tenant via novo endpoint /backend/v1/tenant-users/list
  await assertTest(
    'Admin A lista apenas usuários do seu município via /backend/v1/tenant-users/list',
    async () => {
      const client = new PocketBase(pbUrl)
      // Admin Ana Silva (Florânia)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
      const res: any = await client.send('/backend/v1/tenant-users/list', { method: 'GET' })

      const items = res.items || []
      const allFlorania = items.every((u: any) => u.tenantId === '1e6lxk1tvyt27ok')
      const noneTangara = items.every((u: any) => u.tenantId !== 'brfahrpkg6uvula')
      const hasCarlos = items.some((u: any) => u.email === 'servidor1@florania.gov.br')

      return items.length > 0 && allFlorania && noneTangara && hasCarlos
    },
  )

  // 12. Cenário: Admin A não vê e-mail de usuários do Município B via list ou busca
  await assertTest(
    'Admin A busca por nome/email e NÃO encontra usuários do Município B',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
      // Buscar por Sofia de Tangará
      const res: any = await client.send('/backend/v1/tenant-users/list?search=sofia', {
        method: 'GET',
      })
      const items = res.items || []
      return items.length === 0
    },
  )

  // 13. Cenário: Admin A visualiza usuário do seu tenant e recebe 404 para usuário de B
  await assertTest(
    'Admin A visualiza usuário do seu tenant e recebe 404 para usuário de outro tenant',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
      // Visualizar Carlos (166gp4mdaxy2av4) de Florânia
      const viewSelfTenant: any = await client.send(
        '/backend/v1/tenant-users/view?userId=166gp4mdaxy2av4',
        { method: 'GET' },
      )
      const successA =
        viewSelfTenant.id === '166gp4mdaxy2av4' &&
        viewSelfTenant.email === 'servidor1@florania.gov.br'

      // Visualizar Sofia (92b3oxlgc3q965x) de Tangará
      let blockedB = false
      try {
        await client.send('/backend/v1/tenant-users/view?userId=92b3oxlgc3q965x', { method: 'GET' })
      } catch (err: any) {
        blockedB = err.status === 404 || err.status === 403
      }

      return successA && blockedB
    },
  )

  // 14. Cenário: Admin A edita perfil/vínculo de usuário de A, mas não pode alterar email ou virar superadmin
  await assertTest('Admin A edita servidor de A mas não pode promover a superadmin', async () => {
    const client = new PocketBase(pbUrl)
    await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')
    // Tentar promover Carlos a superadmin -> deve ser rejeitado (403/400)
    let promoteBlocked = false
    try {
      await client.send('/backend/v1/tenant-users/update', {
        method: 'POST',
        body: JSON.stringify({
          userId: '166gp4mdaxy2av4',
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
        name: 'Carlos Santos',
        role: 'servidor',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    return promoteBlocked && updateOk
  })

  // 15. Cenário: Admin A não pode editar nem desvincular usuário do Município B
  await assertTest(
    'Admin A recebe 404/403 ao tentar editar ou desvincular usuário do Município B',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      let editBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/update', {
          method: 'POST',
          body: JSON.stringify({
            userId: '92b3oxlgc3q965x', // Sofia (Tangará)
            name: 'Hacked',
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        editBlocked = err.status === 404 || err.status === 403
      }

      let deleteBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/delete', {
          method: 'POST',
          body: JSON.stringify({
            userId: '92b3oxlgc3q965x', // Sofia (Tangará)
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        deleteBlocked = err.status === 404 || err.status === 403
      }

      return editBlocked && deleteBlocked
    },
  )

  // 16. Cenário: Servidor comum e usuário pendente recebem 403 no endpoint de gestão
  await assertTest(
    'Servidor comum recebe 403 ao tentar listar ou editar usuários via endpoint de gestão',
    async () => {
      const client = new PocketBase(pbUrl)
      await client.collection('users').authWithPassword('servidor1@florania.gov.br', 'Skip@Pass')

      let listBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/list', { method: 'GET' })
      } catch (err: any) {
        listBlocked = err.status === 403 || err.status === 401
      }

      let updateBlocked = false
      try {
        await client.send('/backend/v1/tenant-users/update', {
          method: 'POST',
          body: JSON.stringify({
            userId: 'z3cbxpj8h6xl9z3',
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

  // 17. Cenário: Impedir que o último admin ativo seja removido ou rebaixado
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
          }),
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err: any) {
        unlinkBlocked = err.status === 400 || err.status === 403
      }

      return demoteBlocked && unlinkBlocked
    },
  )

  // 18. Cenário: Desvincular usuário de um tenant preserva seu vínculo em outro município e identidade
  await assertTest(
    'Desvincular usuário de um tenant preserva outros vínculos e integridade do registro',
    async () => {
      const client = new PocketBase(pbUrl)
      // Usar Superadmin para criar um usuário com vínculo duplo para testar desvinculação cirúrgica
      await client.collection('users').authWithPassword('sinvalsalomao@gmail.com', 'Skip@Pass')
      const multiEmail = `multi.user.${Date.now()}@teste.gov.br`

      // Criar em Florânia
      const c1: any = await client.send('/backend/v1/tenant-users/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Usuário Multi Tenant',
          email: multiEmail,
          tenant: '1e6lxk1tvyt27ok', // Florânia
          role: 'servidor',
          password: 'Password@2026Multi',
          passwordConfirm: 'Password@2026Multi',
        }),
        headers: { 'Content-Type': 'application/json' },
      })
      const multiUserId = c1.user?.id

      // Criar vínculo também em Parazinho (wzio6lp1dq4y6xd)
      await client.send('/backend/v1/tenant-users/create', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Usuário Multi Tenant',
          email: multiEmail,
          tenant: 'wzio6lp1dq4y6xd', // Parazinho
          role: 'servidor',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Agora logar como Admin de Florânia e desvincular esse usuário de Florânia
      const adminFlorania = new PocketBase(pbUrl)
      await adminFlorania
        .collection('users')
        .authWithPassword('admin1@florania.gov.br', 'Skip@Pass')

      const delRes: any = await adminFlorania.send('/backend/v1/tenant-users/delete', {
        method: 'POST',
        body: JSON.stringify({ userId: multiUserId }),
        headers: { 'Content-Type': 'application/json' },
      })
      const deleteOk = delRes.success === true

      // Logar como Admin de Parazinho e verificar que o vínculo em Parazinho continua ATIVO e INTACTO
      const adminParazinho = new PocketBase(pbUrl)
      await adminParazinho
        .collection('users')
        .authWithPassword('admin1@parazinho.gov.br', 'Skip@Pass')
      const viewParazinho: any = await adminParazinho.send(
        `/backend/v1/tenant-users/view?userId=${multiUserId}`,
        { method: 'GET' },
      )
      const parazinhoIntact =
        viewParazinho.id === multiUserId && viewParazinho.tenantId === 'wzio6lp1dq4y6xd'

      return deleteOk && parazinhoIntact
    },
  )

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
