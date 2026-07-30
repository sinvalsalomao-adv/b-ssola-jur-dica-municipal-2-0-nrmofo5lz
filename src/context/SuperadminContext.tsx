import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Prefeitura, GlobalUser, PlatformConfig } from '@/types/superadmin'
import { MOCK_PREFEITURAS, MOCK_GLOBAL_USERS, DEFAULT_PLATFORM_CONFIG } from '@/data/mockSuperadmin'

interface SuperadminContextType {
  prefeituras: Prefeitura[]
  globalUsers: GlobalUser[]
  platformConfig: PlatformConfig
  addPrefeitura: (data: Omit<Prefeitura, 'id' | 'createdAt' | 'status'>) => Prefeitura
  updatePrefeitura: (id: string, updates: Partial<Prefeitura>) => void
  togglePrefeituraStatus: (id: string) => void
  addGlobalUser: (data: Omit<GlobalUser, 'id' | 'lastAccess'>) => void
  updateUser: (id: string, updates: Partial<GlobalUser>) => void
  toggleUserStatus: (id: string) => void
  updatePlatformConfig: (updates: Partial<PlatformConfig>) => void
}

const SuperadminContext = createContext<SuperadminContextType | undefined>(undefined)

export const useSuperadmin = () => {
  const ctx = useContext(SuperadminContext)
  if (!ctx) throw new Error('useSuperadmin must be used within SuperadminProvider')
  return ctx
}

export const SuperadminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>(MOCK_PREFEITURAS)
  const [globalUsers, setGlobalUsers] = useState<GlobalUser[]>(MOCK_GLOBAL_USERS)
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG)

  const addPrefeitura: SuperadminContextType['addPrefeitura'] = (data) => {
    const newPref: Prefeitura = {
      ...data,
      id: `pref-${Date.now()}`,
      status: 'ativa',
      createdAt: new Date().toISOString(),
    }
    setPrefeituras((prev) => [...prev, newPref])
    return newPref
  }

  const updatePrefeitura = (id: string, updates: Partial<Prefeitura>) => {
    setPrefeituras((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  const togglePrefeituraStatus = (id: string) => {
    setPrefeituras((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status: p.status === 'ativa' ? 'inativa' : 'ativa' } : p,
      ),
    )
  }

  const addGlobalUser: SuperadminContextType['addGlobalUser'] = (data) => {
    const newUser: GlobalUser = { ...data, id: `user-${Date.now()}`, lastAccess: '—' }
    setGlobalUsers((prev) => [...prev, newUser])
  }

  const updateUser = (id: string, updates: Partial<GlobalUser>) => {
    setGlobalUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)))
  }

  const toggleUserStatus = (id: string) => {
    setGlobalUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, status: u.status === 'ativo' ? 'inativo' : 'ativo' } : u,
      ),
    )
  }

  const updatePlatformConfig = (updates: Partial<PlatformConfig>) => {
    setPlatformConfig((prev) => ({ ...prev, ...updates }))
  }

  return (
    <SuperadminContext.Provider
      value={{
        prefeituras,
        globalUsers,
        platformConfig,
        addPrefeitura,
        updatePrefeitura,
        togglePrefeituraStatus,
        addGlobalUser,
        updateUser,
        toggleUserStatus,
        updatePlatformConfig,
      }}
    >
      {children}
    </SuperadminContext.Provider>
  )
}
