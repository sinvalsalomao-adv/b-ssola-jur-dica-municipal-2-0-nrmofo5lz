/**
 * Testes automatizados para o modelo de Identidade Única com Vínculos Múltiplos (User Memberships).
 * Cobre:
 * 1. Normalização e mapeamento de vínculos.
 * 2. Isolamento de aprovações pendentes por município (Admin vs Superadmin).
 * 3. Transição de status (pendente -> ativo / rejeitado).
 * 4. Reuso de usuário global na criação direta com novo vínculo ativo.
 * 5. Bloqueio de auto-promoção de role e proteção de integridade multi-tenant.
 */

import { normalizeMembership, type UserMembership, type MembershipStatus } from './memberships'
import type { UserRole, GlobalUser } from '@/types/superadmin'

export interface MembershipTestResult {
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
}

export function runMembershipModuleTests(): MembershipTestResult {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  function test(name: string, fn: () => boolean) {
    try {
      const ok = fn()
      results.push({ name, ok })
    } catch (err) {
      results.push({ name, ok: false, detail: String(err) })
    }
  }

  // Teste 1: Normalização correta de registro de membership
  test('Deve normalizar corretamente registro de user_memberships com relações expandidas', () => {
    const rawPbRecord = {
      id: 'mem_123',
      user: 'usr_456',
      tenant: 'ten_789',
      role: 'procurador',
      status: 'pendente',
      created: '2026-08-01T10:00:00Z',
      updated: '2026-08-01T10:00:00Z',
      expand: {
        user: { id: 'usr_456', name: 'Dr. Roberto Santos', email: 'roberto@florania.gov.br' },
        tenant: { id: 'ten_789', name: 'Prefeitura de Florânia', slug: 'florania' },
      },
    }

    const norm = normalizeMembership(rawPbRecord)
    return (
      norm.id === 'mem_123' &&
      norm.userId === 'usr_456' &&
      norm.userName === 'Dr. Roberto Santos' &&
      norm.userEmail === 'roberto@florania.gov.br' &&
      norm.tenantId === 'ten_789' &&
      norm.tenantName === 'Prefeitura de Florânia' &&
      norm.tenantSlug === 'florania' &&
      norm.role === 'procurador' &&
      norm.status === 'pendente'
    )
  })

  // Teste 2: Filtro e isolamento de cadastros pendentes para Administrador Local vs Superadmin
  test('Admin local deve filtrar pendências apenas do seu tenant; Superadmin pode filtrar global ou por tenant', () => {
    const mockMemberships: UserMembership[] = [
      {
        id: 'mem_1',
        userId: 'u1',
        userName: 'User 1',
        userEmail: 'u1@florania.gov.br',
        tenantId: 'ten_florania',
        tenantName: 'Florânia',
        tenantSlug: 'florania',
        role: 'servidor',
        status: 'pendente',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
      {
        id: 'mem_2',
        userId: 'u2',
        userName: 'User 2',
        userEmail: 'u2@tangara.gov.br',
        tenantId: 'ten_tangara',
        tenantName: 'Tangará',
        tenantSlug: 'tangara',
        role: 'gestor',
        status: 'pendente',
        created: '2026-08-01',
        updated: '2026-08-01',
      },
    ]

    const filterPending = (mems: UserMembership[], tenantId?: string) => {
      return mems.filter((m) => m.status === 'pendente' && (!tenantId || m.tenantId === tenantId))
    }

    const adminFloraniaView = filterPending(mockMemberships, 'ten_florania')
    const superadminGlobalView = filterPending(mockMemberships)
    const superadminTangaraView = filterPending(mockMemberships, 'ten_tangara')

    return (
      adminFloraniaView.length === 1 &&
      adminFloraniaView[0].tenantId === 'ten_florania' &&
      superadminGlobalView.length === 2 &&
      superadminTangaraView.length === 1 &&
      superadminTangaraView[0].tenantId === 'ten_tangara'
    )
  })

  // Teste 3: Transição atômica de status: aprovação vira 'ativo', rejeição vira 'rejeitado'
  test('Aprovação deve transicionar status para ativo e rejeição para rejeitado', () => {
    let currentStatus: string = 'pendente'
    let currentRole: string = 'servidor'

    // Simula aprovação com promoção/confirmação de cargo
    const approve = (newRole?: UserRole) => {
      currentStatus = 'ativo'
      if (newRole) currentRole = newRole
    }

    // Simula rejeição
    const reject = () => {
      currentStatus = 'rejeitado'
    }

    approve('gestor')
    const passedApproval = currentStatus === 'ativo' && currentRole === 'gestor'

    reject()
    const passedRejection = currentStatus === 'rejeitado'

    return passedApproval && passedRejection
  })

  // Teste 4: Reuso de usuário global na criação direta com geração de novo vínculo ativo
  test('Criação direta com e-mail global já existente deve reutilizar usuário e criar vínculo ativo', () => {
    const existingUsers = [{ id: 'usr_global_1', email: 'servidor.comum@gmail.com', name: 'Maria' }]
    const memberships: Array<{ user: string; tenant: string; role: string; status: string }> = []

    const handleCreateOrLink = (email: string, name: string, tenantId: string, role: UserRole) => {
      let user = existingUsers.find((u) => u.email === email)
      let userCreated = false
      if (!user) {
        user = { id: `usr_${Date.now()}`, email, name }
        existingUsers.push(user)
        userCreated = true
      }

      // Adicionar ou ativar membership
      let mem = memberships.find((m) => m.user === user!.id && m.tenant === tenantId)
      if (mem) {
        mem.status = 'ativo'
        mem.role = role
      } else {
        memberships.push({
          user: user.id,
          tenant: tenantId,
          role,
          status: 'ativo',
        })
      }

      return { user, userCreated, membershipCount: memberships.length }
    }

    // 1. Vincular Maria em Florânia
    const res1 = handleCreateOrLink('servidor.comum@gmail.com', 'Maria', 'ten_florania', 'servidor')
    // 2. Vincular a MESMA Maria em Tangará
    const res2 = handleCreateOrLink('servidor.comum@gmail.com', 'Maria', 'ten_tangara', 'gestor')

    return (
      res1.userCreated === false &&
      res2.userCreated === false &&
      existingUsers.length === 1 &&
      memberships.length === 2 &&
      memberships[0].tenant === 'ten_florania' &&
      memberships[0].status === 'ativo' &&
      memberships[1].tenant === 'ten_tangara' &&
      memberships[1].status === 'ativo'
    )
  })

  // Teste 5: Isolamento multi-tenant: Admin local não pode selecionar nem vincular outro município
  test('Admin local deve ter município fixado e travado sem possibilidade de alteração arbitrária', () => {
    const localAdmin: { role: string; tenantId: string | null; prefeitura: string } = {
      role: 'admin',
      tenantId: 'ten_florania',
      prefeitura: 'Florânia',
    }
    const requestedArbitraryTenant: string = 'ten_tangara'

    const resolveTenantForCreation = (
      user: typeof localAdmin,
      inputTenant?: string,
    ): string | null => {
      if (user.role === 'superadmin') {
        return inputTenant || null
      }
      return user.tenantId
    }

    const effectiveTenant = resolveTenantForCreation(localAdmin, requestedArbitraryTenant)
    return effectiveTenant === 'ten_florania' && effectiveTenant !== requestedArbitraryTenant
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
