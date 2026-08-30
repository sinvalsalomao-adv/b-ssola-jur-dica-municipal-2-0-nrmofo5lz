import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'
import { UserRole } from '@/types/superadmin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
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
  login: (
    email: string,
    password: string,
    tenantSlugOrId?: string,
  ) => Promise<{ error: any; user?: AuthUser }>
  setTenantContext: (tenantId: string) => Promise<void>
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

async function resolveAuthUser(
  userRecord: any,
  contextTenantId?: string | null,
): Promise<AuthUser | null> {
  if (!userRecord) return null

  // Se o usuário é superadmin global
  const isSuperadminDirect = userRecord.role === 'superadmin'

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

  if (isSuperadminDirect) {
    // Se o superadmin está com um contexto municipal específico selecionado/armazenado
    let activeTenant: any = null
    const targetTenantId = contextTenantId || sessionStorage.getItem('activeTenantId')
    if (targetTenantId) {
      try {
        activeTenant = await pb.collection('tenants').getOne(targetTenantId)
      } catch {
        /* intentionally ignored */
      }
    }

    return {
      id: userRecord.id,
      name: userRecord.name || userRecord.email || '',
      email: userRecord.email || '',
      role: 'superadmin',
      prefeitura: activeTenant ? activeTenant.name : userRecord.expand?.tenant?.name || null,
      tenantId: activeTenant ? activeTenant.id : userRecord.tenant || null,
      tenantSlug: activeTenant ? activeTenant.slug : userRecord.expand?.tenant?.slug || null,
      membershipId: null,
    }
  }

  // Usuário comum: buscar vínculo ativo
  // 1. Se tem contexto municipal especificado
  let selectedMembership = null
  const targetTenantId = contextTenantId || sessionStorage.getItem('activeTenantId')

  if (targetTenantId) {
    selectedMembership = memberships.find(
      (m) =>
        (m.tenant === targetTenantId ||
          m.expand?.tenant?.id === targetTenantId ||
          m.expand?.tenant?.slug === targetTenantId) &&
        m.status === 'ativo',
    )
  }

  // 2. Se não encontrou pelo contexto ou sem contexto, pegar a primeira ativa
  if (!selectedMembership) {
    selectedMembership = memberships.find((m) => m.status === 'ativo')
  }

  // 3. Se tiver membership ativa selecionada
  if (selectedMembership) {
    const tenant = selectedMembership.expand?.tenant
    if (tenant?.id) {
      sessionStorage.setItem('activeTenantId', tenant.id)
    }
    return {
      id: userRecord.id,
      name: userRecord.name || userRecord.email || '',
      email: userRecord.email || '',
      role: (selectedMembership.role || 'servidor') as UserRole,
      prefeitura: tenant?.name || null,
      tenantId: selectedMembership.tenant || tenant?.id || null,
      tenantSlug: tenant?.slug || null,
      membershipId: selectedMembership.id,
    }
  }

  // 4. Fallback para campos legados diretos caso não tenha membership ainda
  if (userRecord.role && userRecord.tenant) {
    return {
      id: userRecord.id,
      name: userRecord.name || userRecord.email || '',
      email: userRecord.email || '',
      role: userRecord.role as UserRole,
      prefeitura: userRecord.expand?.tenant?.name || null,
      tenantId: userRecord.tenant || null,
      tenantSlug: userRecord.expand?.tenant?.slug || null,
      membershipId: null,
    }
  }

  // Usuário cadastrado sem vínculo ativo aprovado
  return {
    id: userRecord.id,
    name: userRecord.name || userRecord.email || '',
    email: userRecord.email || '',
    role: (userRecord.role || 'servidor') as UserRole,
    prefeitura: null,
    tenantId: null,
    tenantSlug: null,
    membershipId: null,
  }
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
          const authenticatedUser = await resolveAuthUser(record)
          setOriginalUser(authenticatedUser)
          const impersonatedUserId = sessionStorage.getItem('impersonatedUserId')

          if (authenticatedUser?.role === 'superadmin' && impersonatedUserId) {
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

  const setTenantContext = async (tenantId: string) => {
    sessionStorage.setItem('activeTenantId', tenantId)
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

  const login = async (email: string, password: string, tenantSlugOrId?: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      const userRecord = await pb
        .collection('users')
        .getOne(pb.authStore.record.id, { expand: 'tenant' })

      const isSuperadmin = userRecord.role === 'superadmin'

      let targetTenant: any = null
      if (tenantSlugOrId) {
        try {
          targetTenant = await pb
            .collection('tenants')
            .getFirstListItem(`slug = "${tenantSlugOrId}" || id = "${tenantSlugOrId}"`)
        } catch {
          /* intentionally ignored */
        }
      }

      // Se não for superadmin e login foi feito em um tenant específico, validar vínculo ativo
      if (!isSuperadmin && targetTenant) {
        // Verificar se o usuário tem vínculo ativo nessa prefeitura
        const memberships = await pb.collection('user_memberships').getFullList({
          filter: `user = "${userRecord.id}" && tenant = "${targetTenant.id}"`,
          expand: 'tenant',
        })

        const activeMembership = memberships.find((m) => m.status === 'ativo')
        const pendingMembership = memberships.find((m) => m.status === 'pendente')

        if (!activeMembership) {
          // Limpar sessão
          pb.authStore.clear()
          if (pendingMembership) {
            return {
              error: new Error(
                'Seu cadastro nesta prefeitura está pendente de aprovação pelo Administrador.',
              ),
            }
          }
          if (memberships.length > 0 && memberships[0].status === 'rejeitado') {
            return {
              error: new Error('Seu cadastro nesta prefeitura foi recusado pelo Administrador.'),
            }
          }
          if (userRecord.tenant === targetTenant.id && userRecord.status === 'ativo') {
            // Permite compatibilidade caso ainda não haja o registro em user_memberships
          } else {
            return {
              error: new Error('Você não possui um vínculo ativo com esta prefeitura.'),
            }
          }
        }

        sessionStorage.setItem('activeTenantId', targetTenant.id)
      } else if (targetTenant) {
        sessionStorage.setItem('activeTenantId', targetTenant.id)
      }

      const authenticatedUser = await resolveAuthUser(userRecord, targetTenant?.id)
      sessionStorage.removeItem('impersonatedUserId')
      setOriginalUser(authenticatedUser)
      setUser(authenticatedUser)
      setIsAuthenticated(true)
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
    setUser(null)
    setOriginalUser(null)
    setIsAuthenticated(false)
  }

  const isImpersonating = Boolean(originalUser && user && originalUser.id !== user.id)

  return (
    <AuthContext.Provider
      value={{
        user,
        originalUser,
        isAuthenticated,
        isImpersonating,
        loading,
        login,
        switchProfile,
        restoreProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
