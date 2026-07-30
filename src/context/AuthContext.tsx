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
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: any }>
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
  return {
    id: record.id,
    name: record.name || record.email || 'Usuário',
    email: record.email || '',
    role: (record.role || 'servidor') as UserRole,
    prefeitura: record.expand?.tenant?.name || null,
    tenantId: record.tenant || null,
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      pb.collection('users')
        .authRefresh()
        .then(() => pb.collection('users').getOne(pb.authStore.record.id, { expand: 'tenant' }))
        .then((record) => {
          setUser(normalizeUser(record))
          setIsAuthenticated(true)
        })
        .catch(() => {
          pb.authStore.clear()
          setUser(null)
          setIsAuthenticated(false)
        })
        .finally(() => setLoading(false))
    } else {
      if (pb.authStore.record) pb.authStore.clear()
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      await pb.collection('users').authWithPassword(email, password)
      const record = await pb
        .collection('users')
        .getOne(pb.authStore.record.id, { expand: 'tenant' })
      setUser(normalizeUser(record))
      setIsAuthenticated(true)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
