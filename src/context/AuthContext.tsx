import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { UserRole } from '@/types/superadmin'

export type HierarchyRole = 'superadmin' | 'admin' | 'servidor'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  accountRole: UserRole
  baseRole: UserRole
  prefeitura: string | null
  tenantId: string | null
  tenantSlug?: string | null
  membershipId?: string | null
}

interface AuthContextType {
  user: AuthUser | null
  originalUser: AuthUser | null
  isAuthenticated: boolean
  isImpersonating: boolean
  loading: boolean
  availableHierarchyRoles: HierarchyRole[]
  canSwitchRole: boolean
  login: (
    email: string,
    password: string,
    tenantSlugOrId?: string,
  ) => Promise<{ error: any; user?: AuthUser }>
  setTenantContext: (tenantId: string | null) => Promise<void>
  clearTenantContext: () => Promise<void>
  switchRole: (targetRole: HierarchyRole) => Promise<void>
  switchProfile: (userId: string) => Promise<void>
  restoreProfile: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}

export function getAvailableHierarchyRoles(
  accountRole: UserRole,
  baseRole: UserRole,
  hasActiveTenant: boolean,
): HierarchyRole[] {
  // Superadmin global
  if (accountRole === 'superadmin') {
    // Se estiver em um contexto municipal e tiver vínculo de admin
    if (hasActiveTenant) {
      if (baseRole === 'admin') {
        return ['superadmin', 'admin', 'servidor']
      }
      // Se a membership no município for servidor/gestor/procurador etc.
      return ['superadmin', 'servidor']
    }
    // Visão global pura: pode alternar para superadmin
    return ['superadmin']
  }

  // Admin municipal
  if (baseRole === 'admin' || accountRole === 'admin') {
    return ['admin', 'servidor']
  }

  // Servidor comum / outros papéis municipais: sem alternância
  return []
}

async function resolveAuthUser(
  userRecord: any,
  contextTenantId?: string | null,
): Promise<AuthUser | null> {
  if (!userRecord) return null

  const isSuperadminDirect = userRecord.role === 'superadmin'
  const accountRole: UserRole = (userRecord.role || 'servidor') as UserRole

  // Buscar memberships do usuário
  let memberships: any[] = []
  try {
    memberships = await pb.collection('user_memberships').getFullList({
      filter: `user = "${userRecord.id}"`,
      expand: 'tenant',
      sort: '-created',
    })
  } catch (err) {
    console.warn('Erro ao carregar memberships do usuário:', err)
  }

  // Determinar o tenant do contexto:
  // Se contextTenantId for fornecido (inclusive null explícito para visão global), usá-lo.
  // Caso contrário, verificar no sessionStorage.
  const targetTenantId =
    contextTenantId !== undefined ? contextTenantId : sessionStorage.getItem('activeTenantId')

  let baseAuthUser: AuthUser

  // Se houver um contexto municipal ativo especificado
  if (targetTenantId) {
    const selectedMembership = memberships.find(
      (m) =>
        (m.tenant === targetTenantId ||
          m.expand?.tenant?.id === targetTenantId ||
          m.expand?.tenant?.slug === targetTenantId) &&
        m.status === 'ativo',
    )

    if (selectedMembership) {
      const tenant = selectedMembership.expand?.tenant
      if (tenant?.id) {
        sessionStorage.setItem('activeTenantId', tenant.id)
      }
      const membershipBaseRole = (selectedMembership.role || 'servidor') as UserRole
      baseAuthUser = {
        id: userRecord.id,
        name: userRecord.name || userRecord.email || '',
        email: userRecord.email || '',
        role: membershipBaseRole,
        accountRole,
        baseRole: membershipBaseRole,
        prefeitura: tenant?.name || null,
        tenantId: selectedMembership.tenant || tenant?.id || null,
        tenantSlug: tenant?.slug || null,
        membershipId: selectedMembership.id,
      }
    } else if (isSuperadminDirect) {
      try {
        const activeTenant = await pb.collection('tenants').getOne(targetTenantId)
        baseAuthUser = {
          id: userRecord.id,
          name: userRecord.name || userRecord.email || '',
          email: userRecord.email || '',
          role: 'superadmin',
          accountRole,
          baseRole: 'superadmin',
          prefeitura: activeTenant ? activeTenant.name : null,
          tenantId: activeTenant ? activeTenant.id : null,
          tenantSlug: activeTenant ? activeTenant.slug : null,
          membershipId: null,
        }
      } catch {
        sessionStorage.removeItem('activeTenantId')
        baseAuthUser = {
          id: userRecord.id,
          name: userRecord.name || userRecord.email || '',
          email: userRecord.email || '',
          role: 'superadmin',
          accountRole,
          baseRole: 'superadmin',
          prefeitura: null,
          tenantId: null,
          tenantSlug: null,
          membershipId: null,
        }
      }
    } else {
      // Usuário comum sem membership encontrada para o tenant alvo
      baseAuthUser = {
        id: userRecord.id,
        name: userRecord.name || userRecord.email || '',
        email: userRecord.email || '',
        role: (userRecord.role || 'servidor') as UserRole,
        accountRole,
        baseRole: (userRecord.role || 'servidor') as UserRole,
        prefeitura: null,
        tenantId: null,
        tenantSlug: null,
        membershipId: null,
      }
    }
  } else if (isSuperadminDirect) {
    // Se não há contexto municipal e é superadmin direto -> Visão Global pura (role: superadmin)
    baseAuthUser = {
      id: userRecord.id,
      name: userRecord.name || userRecord.email || '',
      email: userRecord.email || '',
      role: 'superadmin',
      accountRole,
      baseRole: 'superadmin',
      prefeitura: null,
      tenantId: null,
      tenantSlug: null,
      membershipId: null,
    }
  } else {
    // Usuário comum sem contexto especificado: pegar a primeira membership ativa
    const firstActiveMembership = memberships.find((m) => m.status === 'ativo')

    if (firstActiveMembership) {
      const tenant = firstActiveMembership.expand?.tenant
      if (tenant?.id) {
        sessionStorage.setItem('activeTenantId', tenant.id)
      }
      const membershipBaseRole = (firstActiveMembership.role || 'servidor') as UserRole
      baseAuthUser = {
        id: userRecord.id,
        name: userRecord.name || userRecord.email || '',
        email: userRecord.email || '',
        role: membershipBaseRole,
        accountRole,
        baseRole: membershipBaseRole,
        prefeitura: tenant?.name || null,
        tenantId: firstActiveMembership.tenant || tenant?.id || null,
        tenantSlug: tenant?.slug || null,
        membershipId: firstActiveMembership.id,
      }
    } else if (userRecord.role && userRecord.tenant) {
      // Fallback para campos legados diretos caso não tenha membership ainda
      const legRole = userRecord.role as UserRole
      baseAuthUser = {
        id: userRecord.id,
        name: userRecord.name || userRecord.email || '',
        email: userRecord.email || '',
        role: legRole,
        accountRole,
        baseRole: legRole,
        prefeitura: userRecord.expand?.tenant?.name || null,
        tenantId: userRecord.tenant || null,
        tenantSlug: userRecord.expand?.tenant?.slug || null,
        membershipId: null,
      }
    } else {
      // Usuário cadastrado sem vínculo ativo aprovado
      const defaultRole = (userRecord.role || 'servidor') as UserRole
      baseAuthUser = {
        id: userRecord.id,
        name: userRecord.name || userRecord.email || '',
        email: userRecord.email || '',
        role: defaultRole,
        accountRole,
        baseRole: defaultRole,
        prefeitura: null,
        tenantId: null,
        tenantSlug: null,
        membershipId: null,
      }
    }
  }

  // Aplicar papel efetivo se houver 'effectiveRole' salvo na sessão
  const storedEffectiveRole = sessionStorage.getItem('effectiveRole') as HierarchyRole | null
  if (storedEffectiveRole) {
    const available = getAvailableHierarchyRoles(
      baseAuthUser.accountRole,
      baseAuthUser.baseRole,
      Boolean(baseAuthUser.tenantId),
    )
    if (available.includes(storedEffectiveRole)) {
      baseAuthUser.role = storedEffectiveRole as UserRole
    } else {
      sessionStorage.removeItem('effectiveRole')
    }
  }

  return baseAuthUser
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [originalUser, setOriginalUser] = useState<AuthUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      pb.collection('users')
        .authRefresh()
        .then(() => pb.collection('users').getOne(pb.authStore.record.id, { expand: 'tenant' }))
        .then(async (record) => {
          const storedTenantId = sessionStorage.getItem('activeTenantId')
          const authenticatedUser = await resolveAuthUser(record, storedTenantId)
          setOriginalUser(authenticatedUser)
          const impersonatedUserId = sessionStorage.getItem('impersonatedUserId')

          if (record.role === 'superadmin' && impersonatedUserId) {
            try {
              const impersonatedRecord = await pb
                .collection('users')
                .getOne(impersonatedUserId, { expand: 'tenant' })
              const impUser = await resolveAuthUser(impersonatedRecord)
              setUser(impUser)
            } catch {
              sessionStorage.removeItem('impersonatedUserId')
              setUser(authenticatedUser)
            }
          } else {
            sessionStorage.removeItem('impersonatedUserId')
            setUser(authenticatedUser)
          }
          setIsAuthenticated(true)
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
          setIsAuthenticated(false)
        })
        .finally(() => setLoading(false))
    } else {
      pb.authStore.clear()
      setUser(null)
      setIsAuthenticated(false)
      setLoading(false)
    }
  }, [])

  const setTenantContext = async (tenantId: string | null) => {
    if (tenantId) {
      sessionStorage.setItem('activeTenantId', tenantId)
    } else {
      sessionStorage.removeItem('activeTenantId')
    }
    // Ao trocar de prefeitura ou limpar contexto municipal, limpar o papel efetivo rebaixado
    sessionStorage.removeItem('effectiveRole')
    if (pb.authStore.isValid && pb.authStore.record) {
      const record = await pb
        .collection('users')
        .getOne(pb.authStore.record.id, { expand: 'tenant' })
      const updatedUser = await resolveAuthUser(record, tenantId)
      setUser(updatedUser)
      if (!isImpersonating) {
        setOriginalUser(updatedUser)
      }
    }
  }

  const clearTenantContext = async () => {
    await setTenantContext(null)
  }

  const switchRole = async (targetRole: HierarchyRole) => {
    if (!user) {
      throw new Error('Nenhum usuário autenticado.')
    }

    const available = getAvailableHierarchyRoles(
      user.accountRole,
      user.baseRole,
      Boolean(user.tenantId),
    )

    if (!available.includes(targetRole)) {
      throw new Error(`O papel "${targetRole}" não está disponível para o seu nível hierárquico.`)
    }

    // Se alternou para superadmin: requer voltar à visão global
    if (targetRole === 'superadmin') {
      sessionStorage.removeItem('effectiveRole')
      sessionStorage.removeItem('activeTenantId')
      if (pb.authStore.isValid && pb.authStore.record) {
        const record = await pb
          .collection('users')
          .getOne(pb.authStore.record.id, { expand: 'tenant' })
        const updatedUser = await resolveAuthUser(record, null)
        setUser(updatedUser)
        if (!isImpersonating) {
          setOriginalUser(updatedUser)
        }
      }
      return
    }

    // Se alternou para o papel base (ex.: admin)
    if (targetRole === user.baseRole) {
      sessionStorage.removeItem('effectiveRole')
    } else {
      sessionStorage.setItem('effectiveRole', targetRole)
    }

    setUser((prev) => {
      if (!prev) return null
      return {
        ...prev,
        role: targetRole as UserRole,
      }
    })
  }

  const login = async (email: string, password: string, tenantSlugOrId?: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      const userRecord = await pb
        .collection('users')
        .getOne(pb.authStore.record.id, { expand: 'tenant' })

      const isSuperadmin = userRecord.role === 'superadmin'

      // Se o login foi solicitado pelo canal 'global', restringir exclusivamente a superadmin
      if (tenantSlugOrId === 'global' && !isSuperadmin) {
        pb.authStore.clear()
        return {
          error: new Error('Esta entrada é exclusiva para superadministradores.'),
        }
      }

      let targetTenant: any = null
      if (tenantSlugOrId && tenantSlugOrId !== 'global') {
        try {
          targetTenant = await pb
            .collection('tenants')
            .getFirstListItem(`slug = "${tenantSlugOrId}" || id = "${tenantSlugOrId}"`)
        } catch {
          /* intentionally ignored */
        }
      }

      // Se o login foi feito em uma porta municipal (tenantSlugOrId !== 'global'),
      // validar vínculo ativo para TODOS os usuários (inclusive superadmin)
      if (targetTenant) {
        // Verificar se o usuário tem vínculo ativo nessa prefeitura
        const memberships = await pb.collection('user_memberships').getFullList({
          filter: `user = "${userRecord.id}" && tenant = "${targetTenant.id}"`,
          expand: 'tenant',
        })

        const activeMembership = memberships.find((m) => m.status === 'ativo')
        const pendingMembership = memberships.find((m) => m.status === 'pendente')
        const rejectedMembership = memberships.find((m) => m.status === 'rejeitado')

        if (!activeMembership) {
          // Limpar sessão PocketBase e sessionStorage
          pb.authStore.clear()
          sessionStorage.removeItem('activeTenantId')

          if (pendingMembership) {
            return {
              error: new Error(
                'Seu cadastro nesta prefeitura está pendente de aprovação pelo Administrador.',
              ),
            }
          }
          if (
            rejectedMembership ||
            (memberships.length > 0 && memberships[0].status === 'rejeitado')
          ) {
            return {
              error: new Error('Seu cadastro nesta prefeitura foi recusado pelo Administrador.'),
            }
          }
          if (
            !isSuperadmin &&
            userRecord.tenant === targetTenant.id &&
            userRecord.status === 'ativo'
          ) {
            // Permite compatibilidade caso ainda não haja o registro em user_memberships
          } else {
            return {
              error: new Error('Esta conta não possui vínculo com esta prefeitura.'),
            }
          }
        }

        sessionStorage.setItem('activeTenantId', targetTenant.id)
      } else if (tenantSlugOrId && tenantSlugOrId !== 'global') {
        // Se foi passado um slug municipal mas a organização não foi encontrada no banco
        pb.authStore.clear()
        sessionStorage.removeItem('activeTenantId')
        return {
          error: new Error('Esta conta não possui vínculo com esta prefeitura.'),
        }
      }

      const authenticatedUser = await resolveAuthUser(userRecord, targetTenant?.id)
      sessionStorage.removeItem('impersonatedUserId')
      setOriginalUser(authenticatedUser)
      setUser(authenticatedUser)
      setIsAuthenticated(true)
      // Se for login global (ou sem tenant municipal especificado), garantir que comece na visão global
      if (isSuperadmin && (!tenantSlugOrId || tenantSlugOrId === 'global')) {
        sessionStorage.removeItem('activeTenantId')
        if (authenticatedUser) {
          authenticatedUser.tenantId = null
          authenticatedUser.prefeitura = null
          authenticatedUser.tenantSlug = null
          authenticatedUser.membershipId = null
          authenticatedUser.role = 'superadmin'
        }
      }

      return { error: null, user: authenticatedUser }
    } catch (error) {
      return { error }
    }
  }

  const switchProfile = async (userId: string) => {
    if (originalUser?.role !== 'superadmin') {
      throw new Error('Apenas superadministradores podem trocar de perfil.')
    }

    const record = await pb.collection('users').getOne(userId, { expand: 'tenant' })
    const targetUser = await resolveAuthUser(record)
    if (!targetUser || targetUser.role === 'superadmin') {
      throw new Error('Selecione um usuário municipal ativo para acessar o perfil.')
    }
    if (record.status && record.status !== 'ativo') {
      throw new Error('Não é possível acessar o perfil de um usuário inativo.')
    }

    sessionStorage.setItem('impersonatedUserId', targetUser.id)
    if (targetUser.tenantId) {
      sessionStorage.setItem('activeTenantId', targetUser.tenantId)
    }
    setUser(targetUser)
  }

  const restoreProfile = () => {
    if (!originalUser) return
    sessionStorage.removeItem('impersonatedUserId')
    if (originalUser.tenantId) {
      sessionStorage.setItem('activeTenantId', originalUser.tenantId)
    } else {
      sessionStorage.removeItem('activeTenantId')
    }
    setUser(originalUser)
  }

  const logout = () => {
    try {
      pb.authStore.clear()
    } catch (err) {
      console.error('Failed to clear auth store:', err)
      pb.authStore.clear()
    }
    sessionStorage.removeItem('impersonatedUserId')
    sessionStorage.removeItem('activeTenantId')
    sessionStorage.removeItem('effectiveRole')
    setUser(null)
    setOriginalUser(null)
    setIsAuthenticated(false)
  }

  const isImpersonating = Boolean(originalUser && user && originalUser.id !== user.id)

  const availableHierarchyRoles = user
    ? getAvailableHierarchyRoles(user.accountRole, user.baseRole, Boolean(user.tenantId))
    : []

  const canSwitchRole = availableHierarchyRoles.length > 1

  return (
    <AuthContext.Provider
      value={{
        user,
        originalUser,
        isAuthenticated,
        isImpersonating,
        loading,
        availableHierarchyRoles,
        canSwitchRole,
        login,
        setTenantContext,
        clearTenantContext,
        switchRole,
        switchProfile,
        restoreProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
