import React, { createContext, useContext, useState, ReactNode } from 'react'
import { UserRole } from '@/types/superadmin'
import { MOCK_GLOBAL_USERS } from '@/data/mockSuperadmin'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  prefeitura: string | null
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

const SUPERADMIN_USER: AuthUser = {
  id: 'user-11',
  name: 'Dr. Silval Salomão',
  email: 'sinvalsalomao@gmail.com',
  role: 'superadmin',
  prefeitura: null,
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(SUPERADMIN_USER)
  const [loading] = useState(false)

  const login = async (email: string, _password: string) => {
    const mockUser = MOCK_GLOBAL_USERS.find((u) => u.email === email)
    if (mockUser) {
      setUser({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        role: mockUser.role,
        prefeitura: mockUser.prefeituraSlug ? mockUser.prefeituraName : null,
      })
      return { error: null }
    }
    return { error: { message: 'Usuário não encontrado' } }
  }

  const logout = () => setUser(null)

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
