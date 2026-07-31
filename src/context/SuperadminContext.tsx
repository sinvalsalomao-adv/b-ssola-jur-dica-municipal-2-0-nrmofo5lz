import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react'
import { Prefeitura, GlobalUser, PlatformConfig, UserRole } from '@/types/superadmin'
import { DEFAULT_STALL_LIMITS } from '@/types/controle'
import { getTenants, getTenant, updateTenant, createTenant } from '@/services/tenants'
import pb from '@/lib/pocketbase/client'

interface SuperadminContextType {
  prefeituras: Prefeitura[]
  globalUsers: GlobalUser[]
  platformConfig: PlatformConfig
  loading: boolean
  addPrefeitura: (data: Omit<Prefeitura, 'id' | 'createdAt' | 'status'>) => Promise<void>
  updatePrefeitura: (id: string, updates: Partial<Prefeitura>) => void
  togglePrefeituraStatus: (id: string) => void
  refreshTenant: (id: string) => Promise<void>
  addGlobalUser: (
    data: Omit<GlobalUser, 'id' | 'lastAccess'> & { password?: string; tenantId?: string },
  ) => Promise<void>
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

function normalizeGlobalUser(r: any): GlobalUser {
  const tenant = r.expand?.tenant
  return {
    id: r.id,
    name: r.name || '',
    email: r.email || '',
    prefeituraName: tenant?.name || '—',
    prefeituraSlug: tenant?.slug || '',
    role: (r.role || 'servidor') as UserRole,
    status: (r.status || 'ativo') as 'ativo' | 'inativo',
    lastAccess: r.updated || r.created || '—',
  }
}

const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  stallLimits: { ...DEFAULT_STALL_LIMITS },
  smtpServer: '',
  smtpPort: '587',
  smtpUsername: '',
  smtpPassword: '',
  senderEmail: '',
  aiApiKey: '',
}

export const SuperadminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>([])
  const [globalUsers, setGlobalUsers] = useState<GlobalUser[]>([])
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG)
  const [loading, setLoading] = useState(true)

  const fetchTenants = useCallback(async () => {
    try {
      const tenants = await getTenants()
      setPrefeituras(tenants)
    } catch (err) {
      console.error('Failed to fetch tenants:', err)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const records = await pb.collection('users').getFullList({
        expand: 'tenant',
        sort: 'created',
      })
      setGlobalUsers(records.map(normalizeGlobalUser))
    } catch (err) {
      console.error('Failed to fetch users:', err)
    }
  }, [])

  const fetchPlatformConfig = useCallback(async () => {
    try {
      const records = await pb.collection('platform_settings').getFullList()
      if (records.length > 0) {
        const r = records[0]
        const smtp = r.smtp_config || {}
        setPlatformConfig({
          stallLimits: r.stall_limits || { ...DEFAULT_STALL_LIMITS },
          smtpServer: smtp.server || '',
          smtpPort: smtp.port || '587',
          smtpUsername: smtp.username || '',
          smtpPassword: smtp.password || '',
          senderEmail: smtp.senderEmail || '',
          aiApiKey: r.ai_api_key || '',
        })
      }
    } catch (err) {
      console.error('Failed to fetch platform config:', err)
    }
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      await Promise.all([fetchTenants(), fetchUsers(), fetchPlatformConfig()])
      setLoading(false)
    }
    loadAll()
  }, [fetchTenants, fetchUsers, fetchPlatformConfig])

  const addPrefeitura: SuperadminContextType['addPrefeitura'] = async (data) => {
    await createTenant({
      name: data.name,
      cnpj: data.cnpj,
      slug: data.slug,
      admin_name: data.adminName,
    })
    await fetchTenants()
  }

  const mapPrefeituraToApi = (updates: Partial<Prefeitura>): Record<string, any> => {
    const apiData: Record<string, any> = {}
    if (updates.adminName !== undefined) apiData.admin_name = updates.adminName
    if (updates.cidade !== undefined) apiData.cidade = updates.cidade
    if (updates.estado !== undefined) apiData.estado = updates.estado
    if (updates.status !== undefined) apiData.status = updates.status
    if (updates.name !== undefined) apiData.name = updates.name
    if (updates.cnpj !== undefined) apiData.cnpj = updates.cnpj
    if (updates.slug !== undefined) apiData.slug = updates.slug
    return apiData
  }

  const updatePrefeitura = (id: string, updates: Partial<Prefeitura>) => {
    setPrefeituras((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)))
    const apiData = mapPrefeituraToApi(updates)
    if (Object.keys(apiData).length > 0) {
      updateTenant(id, apiData).catch((err) => {
        console.error('Failed to update tenant:', err)
      })
    }
  }

  const togglePrefeituraStatus = (id: string) => {
    const prefeitura = prefeituras.find((p) => p.id === id)
    if (!prefeitura) return
    const newStatus = prefeitura.status === 'ativa' ? 'inativa' : 'ativa'
    setPrefeituras((prev) => prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p)))
    updateTenant(id, { status: newStatus }).catch((err) => {
      console.error('Failed to toggle tenant status:', err)
    })
  }

  const refreshTenant = async (id: string) => {
    try {
      const updated = await getTenant(id)
      setPrefeituras((prev) => prev.map((p) => (p.id === id ? updated : p)))
    } catch (err) {
      console.error('Failed to refresh tenant:', err)
    }
  }

  const addGlobalUser: SuperadminContextType['addGlobalUser'] = async (data) => {
    const pwd = data.password || 'Skip@Pass'
    const tId = data.tenantId || prefeituras.find((p) => p.slug === data.prefeituraSlug)?.id || null
    await pb.collection('users').create({
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status || 'ativo',
      tenant: tId,
      password: pwd,
      passwordConfirm: pwd,
    })
    await fetchUsers()
  }

  const updateUser = (id: string, updates: Partial<GlobalUser>) => {
    setGlobalUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)))
    const apiData: Record<string, any> = {}
    if (updates.name !== undefined) apiData.name = updates.name
    if (updates.role !== undefined) apiData.role = updates.role
    if (updates.status !== undefined) apiData.status = updates.status
    if (Object.keys(apiData).length > 0) {
      pb.collection('users')
        .update(id, apiData)
        .catch((err) => {
          console.error('Failed to update user:', err)
        })
    }
  }

  const toggleUserStatus = (id: string) => {
    const user = globalUsers.find((u) => u.id === id)
    if (!user) return
    const newStatus = user.status === 'ativo' ? 'inativo' : 'ativo'
    setGlobalUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: newStatus } : u)))
    pb.collection('users')
      .update(id, { status: newStatus })
      .catch((err) => {
        console.error('Failed to toggle user status:', err)
      })
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
        loading,
        addPrefeitura,
        updatePrefeitura,
        togglePrefeituraStatus,
        refreshTenant,
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
