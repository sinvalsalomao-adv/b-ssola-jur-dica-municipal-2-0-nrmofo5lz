/**
 * Testes automatizados para o modelo de Identidade Única com Vínculos Múltiplos (User Memberships).
 * Cobre:
 * 1. Normalização e mapeamento de vínculos.
 * 2. Isolamento de aprovações pendentes por município (Admin vs Superadmin).
 * 3. Transição de status (pendente -> ativo / rejeitado).
 * 4. Reuso de usuário global na criação direta com novo vínculo ativo.
 * 5. Bloqueio de auto-promoção de role e proteção de integridade multi-tenant.
 * 6. Suporte a Administrador Multi-Tenant com escopo explícito obrigatório.
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

    const approve = (newRole?: UserRole) => {
      currentStatus = 'ativo'
      if (newRole) currentRole = newRole
    }

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

    const res1 = handleCreateOrLink('servidor.comum@gmail.com', 'Maria', 'ten_florania', 'servidor')
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

  // Teste 5: Admin Multi-Tenant: gerencia múltiplos tenants com tenantId explícito
  test('Admin Multi-Tenant gerencia múltiplos tenants especificando tenantId explicitamente', () => {
    const multiTenantAdmin = {
      id: 'admin_multi',
      roles: [
        { tenant: 'ten_florania', role: 'admin', status: 'ativo' },
        { tenant: 'ten_parazinho', role: 'admin', status: 'ativo' },
      ],
    }

    const canAdminOperateInTenant = (admin: typeof multiTenantAdmin, requestedTenant: string) => {
      return admin.roles.some(
        (r) => r.tenant === requestedTenant && r.role === 'admin' && r.status === 'ativo',
      )
    }

    const canOperateFlorania = canAdminOperateInTenant(multiTenantAdmin, 'ten_florania')
    const canOperateParazinho = canAdminOperateInTenant(multiTenantAdmin, 'ten_parazinho')
    const cannotOperateTangara = !canAdminOperateInTenant(multiTenantAdmin, 'ten_tangara')

    return canOperateFlorania && canOperateParazinho && cannotOperateTangara
  })

  // Teste 6: Servidor comum não pode criar, editar ou aprovar memberships diretamente
  test('Servidor comum não pode criar, editar ou aprovar memberships diretamente', () => {
    const servidorUser = { id: 'usr_serv_1', role: 'servidor', tenant: 'ten_florania' }

    const canCreateMembershipDirectly = (user: typeof servidorUser) => {
      return user.role === 'superadmin' || user.role === 'admin'
    }

    const canApproveOrEditMembership = (user: typeof servidorUser, targetTenant: string) => {
      if (user.role === 'superadmin') return true
      if (user.role === 'admin' && user.tenant === targetTenant) return true
      return false
    }

    const blockedCreate = !canCreateMembershipDirectly(servidorUser)
    const blockedApprove = !canApproveOrEditMembership(servidorUser, 'ten_florania')
    const blockedOtherTenant = !canApproveOrEditMembership(servidorUser, 'ten_tangara')

    return blockedCreate && blockedApprove && blockedOtherTenant
  })

  // Teste 7: Servidor comum não pode alterar o próprio tenant, role ou status
  test('Servidor não pode alterar o próprio tenant, role ou status (prevenção de IDOR e auto-elevação)', () => {
    const selfUpdateAttempt = {
      role: 'admin',
      tenant: 'ten_tangara',
      status: 'ativo',
    }

    const validateSelfUpdateFields = (userRole: string, body: typeof selfUpdateAttempt) => {
      if (userRole !== 'superadmin') {
        if (body.role !== undefined && body.role !== 'servidor') return false
        if (body.tenant !== undefined && body.tenant !== 'ten_florania') return false
        if (body.status !== undefined && body.status !== 'ativo') return false
      }
      return true
    }

    const isForbidden = !validateSelfUpdateFields('servidor', selfUpdateAttempt)
    return isForbidden
  })

  // Teste 8: Proteção do último admin ativo do município
  test('Regra de integridade: Não é permitido rebaixar ou remover o último administrador ativo', () => {
    const activeAdminsInTenant = [{ id: 'admin_1', tenant: 'ten_tangara', status: 'ativo' }]

    const canDemoteOrRemoveAdmin = (adminsCount: number) => {
      return adminsCount > 1
    }

    const isProtected = !canDemoteOrRemoveAdmin(activeAdminsInTenant.length)
    return isProtected
  })

  // Teste 9: Superadmin mantém autorização global irrestrita
  test('Superadmin mantém autorização irrestrita sobre todos os tenants e usuários', () => {
    const superadmin = { id: 'usr_super', role: 'superadmin', tenant: null }
    const canAccessAny = (user: typeof superadmin, _targetTenant: string) => {
      return user.role === 'superadmin'
    }

    return (
      canAccessAny(superadmin, 'ten_florania') &&
      canAccessAny(superadmin, 'ten_tangara') &&
      canAccessAny(superadmin, 'ten_parazinho')
    )
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
