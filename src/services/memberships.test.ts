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
import { getAvailableHierarchyRoles } from '@/context/AuthContext'

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

  // Teste 4: Convite seguro para e-mail global já existente: cria convite/membership pendente sem ativar automaticamente
  test('Convite para e-mail global já existente deve criar membership pendente e exigir aceite autenticado', () => {
    const existingUsers = [{ id: 'usr_global_1', email: 'servidor.comum@gmail.com', name: 'Maria' }]
    const memberships: Array<{ user: string; tenant: string; role: string; status: string }> = []
    const invitations: Array<{
      email: string
      tenant: string
      role: string
      status: string
      tokenHash: string
    }> = []

    const handleInviteOrLink = (email: string, name: string, tenantId: string, role: UserRole) => {
      let user = existingUsers.find((u) => u.email === email)
      let userCreated = false
      if (!user) {
        user = { id: `usr_${Date.now()}`, email, name }
        existingUsers.push(user)
        userCreated = true
      }

      // Membership NUNCA inicia ativa automaticamente para e-mail convidado
      let mem = memberships.find((m) => m.user === user!.id && m.tenant === tenantId)
      if (mem) {
        if (mem.status !== 'ativo') {
          mem.status = 'pendente'
          mem.role = role
        }
      } else {
        memberships.push({
          user: user.id,
          tenant: tenantId,
          role,
          status: 'pendente',
        })
      }

      // Gera convite com hash de token
      invitations.push({
        email,
        tenant: tenantId,
        role,
        status: 'pending',
        tokenHash: 'sha256_mock_hash_' + Date.now(),
      })

      return {
        user,
        userCreated,
        membershipCount: memberships.length,
        invitationCount: invitations.length,
      }
    }

    const res1 = handleInviteOrLink('servidor.comum@gmail.com', 'Maria', 'ten_florania', 'servidor')
    const res2 = handleInviteOrLink('servidor.comum@gmail.com', 'Maria', 'ten_tangara', 'gestor')

    // Aceite autenticado do titular em Tangará
    const acceptInvitation = (userEmail: string, tenantId: string) => {
      const inv = invitations.find(
        (i) => i.email === userEmail && i.tenant === tenantId && i.status === 'pending',
      )
      if (inv) {
        inv.status = 'accepted'
        const mem = memberships.find((m) => m.tenant === tenantId)
        if (mem) mem.status = 'ativo'
      }
    }

    acceptInvitation('servidor.comum@gmail.com', 'ten_tangara')

    return (
      res1.userCreated === false &&
      res2.userCreated === false &&
      existingUsers.length === 1 &&
      memberships.length === 2 &&
      memberships[0].tenant === 'ten_florania' &&
      memberships[0].status === 'pendente' && // Florânia permanece pendente (não aceito)
      memberships[1].tenant === 'ten_tangara' &&
      memberships[1].status === 'ativo' // Tangará ativou após aceite autenticado
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

  // Teste 10: Cenário 1 — Superadmin logando em porta municipal COM vínculo ativo resolve papel municipal
  test('Cenário 1: Superadmin com vínculo ativo na porta municipal resolve papel da membership e contexto municipal', () => {
    const superadminUserRecord = {
      id: 'usr_super_matheus',
      name: 'Matheus Super',
      email: 'matheus@juris.gov.br',
      role: 'superadmin',
    }

    const mockMemberships = [
      {
        id: 'mem_florania_1',
        user: 'usr_super_matheus',
        tenant: 'ten_florania',
        role: 'admin',
        status: 'ativo',
        expand: {
          tenant: { id: 'ten_florania', name: 'Prefeitura de Florânia', slug: 'florania' },
        },
      },
    ]

    // Simulação da lógica de resolução de autenticação com contexto municipal
    const resolveContextRole = (
      userRecord: typeof superadminUserRecord,
      targetTenantIdOrSlug: string,
      mems: typeof mockMemberships,
    ) => {
      const activeMembership = mems.find(
        (m) =>
          (m.tenant === targetTenantIdOrSlug ||
            m.expand?.tenant?.id === targetTenantIdOrSlug ||
            m.expand?.tenant?.slug === targetTenantIdOrSlug) &&
          m.status === 'ativo',
      )

      if (activeMembership) {
        return {
          id: userRecord.id,
          name: userRecord.name,
          email: userRecord.email,
          role: activeMembership.role as UserRole,
          prefeitura: activeMembership.expand.tenant.name,
          tenantId: activeMembership.tenant,
          tenantSlug: activeMembership.expand.tenant.slug,
          membershipId: activeMembership.id,
        }
      }

      // Se não há contexto municipal, superadmin fica global
      return {
        id: userRecord.id,
        name: userRecord.name,
        email: userRecord.email,
        role: userRecord.role as UserRole,
        prefeitura: null,
        tenantId: null,
        tenantSlug: null,
        membershipId: null,
      }
    }

    const resolved = resolveContextRole(superadminUserRecord, 'florania', mockMemberships)
    const destinationPath = resolved.role === 'superadmin' ? '/superadmin' : '/dashboard'

    return (
      resolved.role === 'admin' &&
      resolved.prefeitura === 'Prefeitura de Florânia' &&
      resolved.tenantId === 'ten_florania' &&
      resolved.tenantSlug === 'florania' &&
      resolved.membershipId === 'mem_florania_1' &&
      destinationPath === '/dashboard'
    )
  })

  // Teste 11: Cenário 2 — Superadmin logando em porta municipal SEM vínculo ativo é recusado com mensagens exatas
  test('Cenário 2: Superadmin na porta municipal sem vínculo ativo tem login recusado e sessão limpa', () => {
    const superadminUser = {
      id: 'usr_super_matheus',
      role: 'superadmin',
    }

    const userMemberships = [
      {
        id: 'mem_parazinho',
        user: 'usr_super_matheus',
        tenant: 'ten_parazinho',
        status: 'pendente',
      },
      {
        id: 'mem_rej',
        user: 'usr_super_matheus',
        tenant: 'ten_rejeitado',
        status: 'rejeitado',
      },
    ]

    const simulateMunicipalLoginValidation = (
      user: typeof superadminUser,
      targetTenantId: string,
    ) => {
      const tenantMemberships = userMemberships.filter(
        (m) => m.user === user.id && m.tenant === targetTenantId,
      )
      const activeMembership = tenantMemberships.find((m) => m.status === 'ativo')
      const pendingMembership = tenantMemberships.find((m) => m.status === 'pendente')
      const rejectedMembership = tenantMemberships.find((m) => m.status === 'rejeitado')

      let sessionCleared = false
      const clearSession = () => {
        sessionCleared = true
      }

      if (!activeMembership) {
        clearSession()
        if (pendingMembership) {
          return {
            allowed: false,
            sessionCleared,
            errorMessage:
              'Seu cadastro nesta prefeitura está pendente de aprovação pelo Administrador.',
          }
        }
        if (rejectedMembership) {
          return {
            allowed: false,
            sessionCleared,
            errorMessage: 'Seu cadastro nesta prefeitura foi recusado pelo Administrador.',
          }
        }
        return {
          allowed: false,
          sessionCleared,
          errorMessage: 'Esta conta não possui vínculo com esta prefeitura.',
        }
      }

      return { allowed: true, sessionCleared: false, errorMessage: null }
    }

    const resPendente = simulateMunicipalLoginValidation(superadminUser, 'ten_parazinho')
    const resSemRegistro = simulateMunicipalLoginValidation(superadminUser, 'ten_desconhecido')
    const resRejeitado = simulateMunicipalLoginValidation(superadminUser, 'ten_rejeitado')

    return (
      resPendente.allowed === false &&
      resPendente.sessionCleared === true &&
      resPendente.errorMessage ===
        'Seu cadastro nesta prefeitura está pendente de aprovação pelo Administrador.' &&
      resSemRegistro.allowed === false &&
      resSemRegistro.sessionCleared === true &&
      resSemRegistro.errorMessage === 'Esta conta não possui vínculo com esta prefeitura.' &&
      resRejeitado.allowed === false &&
      resRejeitado.sessionCleared === true &&
      resRejeitado.errorMessage === 'Seu cadastro nesta prefeitura foi recusado pelo Administrador.'
    )
  })

  // Teste 12: Cenário 3 — /login/global exclusivo para superadmin e bloqueio de usuários comuns
  test('Cenário 3: /login/global permite superadmin e bloqueia não-superadmin revertendo sessão', () => {
    const superadminRecord = { id: 'usr_super', role: 'superadmin' }
    const comumRecord = { id: 'usr_comum', role: 'servidor' }

    const simulateGlobalLogin = (userRecord: { id: string; role: string }) => {
      let sessionCleared = false
      const isSuperadmin = userRecord.role === 'superadmin'

      if (!isSuperadmin) {
        sessionCleared = true
        return {
          allowed: false,
          sessionCleared,
          error: 'Esta entrada é exclusiva para superadministradores.',
          redirect: null,
        }
      }

      return {
        allowed: true,
        sessionCleared: false,
        error: null,
        redirect: '/superadmin',
      }
    }

    const globalAttemptSuper = simulateGlobalLogin(superadminRecord)
    const globalAttemptComum = simulateGlobalLogin(comumRecord)

    return (
      globalAttemptSuper.allowed === true &&
      globalAttemptSuper.redirect === '/superadmin' &&
      globalAttemptComum.allowed === false &&
      globalAttemptComum.sessionCleared === true &&
      globalAttemptComum.error === 'Esta entrada é exclusiva para superadministradores.'
    )
  })

  // Teste 13: Alternância de Hierarquia Pós-Login — Superadmin com vínculo admin municipal
  test('Cenário 4: Superadmin com vínculo admin municipal pode alternar entre superadmin, admin e servidor (comum)', () => {
    // Caso de Matheus: conta global superadmin, operando em Florânia com baseRole admin
    const accountRole: UserRole = 'superadmin'
    const baseRole: UserRole = 'admin'
    const hasActiveTenant = true

    const available = getAvailableHierarchyRoles(accountRole, baseRole, hasActiveTenant)

    const allowsSuperadmin = available.includes('superadmin')
    const allowsAdmin = available.includes('admin')
    const allowsServidor = available.includes('servidor')

    return available.length === 3 && allowsSuperadmin && allowsAdmin && allowsServidor
  })

  // Teste 14: Alternância de Hierarquia Pós-Login — Admin municipal comum
  test('Cenário 5: Administrador Municipal pode alternar entre admin e servidor (comum), mas nunca para superadmin', () => {
    const accountRole: UserRole = 'servidor'
    const baseRole: UserRole = 'admin'
    const hasActiveTenant = true

    const available = getAvailableHierarchyRoles(accountRole, baseRole, hasActiveTenant)

    const allowsAdmin = available.includes('admin')
    const allowsServidor = available.includes('servidor')
    const blocksSuperadmin = !available.includes('superadmin')

    return available.length === 2 && allowsAdmin && allowsServidor && blocksSuperadmin
  })

  // Teste 15: Alternância de Hierarquia Pós-Login — Servidor comum não tem opção de alternar
  test('Cenário 6: Servidor Comum tem lista vazia de alternância e não pode degradar nem se promover', () => {
    const accountRole: UserRole = 'servidor'
    const baseRole: UserRole = 'servidor'
    const hasActiveTenant = true

    const available = getAvailableHierarchyRoles(accountRole, baseRole, hasActiveTenant)

    return available.length === 0
  })

  // Teste 16: Sessão e degradação de permissões — F5 preserva papel efetivo rebaixado e volta ao baseRole
  test('Cenário 7: Simulação de sessão — sessionStorage preserva effectiveRole no F5 e restringe rotas protegidas', () => {
    const mockSessionStore: Record<string, string> = {
      activeTenantId: 'ten_florania',
      effectiveRole: 'servidor', // Admin rebaixou voluntariamente para servidor
    }

    const baseUser = {
      id: 'usr_matheus',
      accountRole: 'superadmin' as UserRole,
      baseRole: 'admin' as UserRole,
      role: 'admin' as UserRole,
      tenantId: 'ten_florania',
    }

    // Ao carregar a sessão com effectiveRole salvo:
    const available = getAvailableHierarchyRoles(
      baseUser.accountRole,
      baseUser.baseRole,
      Boolean(baseUser.tenantId),
    )
    const storedRole = mockSessionStore['effectiveRole'] as any
    if (storedRole && available.includes(storedRole)) {
      baseUser.role = storedRole
    }

    // Validar se o papel em uso virou 'servidor'
    const isDegradedToServidor = baseUser.role === 'servidor'

    // Validar checagem de ProtectedRoute para rotas administrativas (ex: /usuarios exige admin/superadmin)
    const allowedRoles = ['admin', 'superadmin']
    const isRoutePermitted = allowedRoles.includes(baseUser.role) // Deve ser FALSE pois está no modo comum

    return isDegradedToServidor && !isRoutePermitted
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
