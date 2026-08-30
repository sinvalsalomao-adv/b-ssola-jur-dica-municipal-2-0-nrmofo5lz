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
}

interface AuthContextType {
  user: AuthUser | null
  originalUser: AuthUser | null
  isAuthenticated: boolean
  isImpersonating: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: any }>
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

function normalizeUser(record: any): AuthUser | null {
  if (!record) return null
  if (!record.role) return null
  return {
    id: record.id,
    name: record.name || record.email || '',
    email: record.email || '',
    role: record.role as UserRole,
    prefeitura: record.expand?.tenant?.name || null,
    tenantId: record.tenant || null,
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
          const authenticatedUser = normalizeUser(record)
          setOriginalUser(authenticatedUser)
          const impersonatedUserId = sessionStorage.getItem('impersonatedUserId')

          if (authenticatedUser?.role === 'superadmin' && impersonatedUserId) {
            try {
              const impersonatedRecord = await pb
                .collection('users')
                .getOne(impersonatedUserId, { expand: 'tenant' })
              setUser(normalizeUser(impersonatedRecord))
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

  const login = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      const record = await pb
        .collection('users')
        .getOne(pb.authStore.record.id, { expand: 'tenant' })
      const authenticatedUser = normalizeUser(record)
      sessionStorage.removeItem('impersonatedUserId')
      setOriginalUser(authenticatedUser)
      setUser(authenticatedUser)
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const switchProfile = async (userId: string) => {
    if (originalUser?.role !== 'superadmin') {
      throw new Error('Apenas superadministradores podem trocar de perfil.')
    }

    const record = await pb.collection('users').getOne(userId, { expand: 'tenant' })
    const targetUser = normalizeUser(record)
    if (!targetUser || targetUser.role === 'superadmin') {
      throw new Error('Selecione um usuário municipal ativo para acessar o perfil.')
    }
    if (record.status && record.status !== 'ativo') {
      throw new Error('Não é possível acessar o perfil de um usuário inativo.')
    }

    sessionStorage.setItem('impersonatedUserId', targetUser.id)
    setUser(targetUser)
  }

  const restoreProfile = () => {
    if (!originalUser) return
    sessionStorage.removeItem('impersonatedUserId')
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
