import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUsersByTenant } from '@/services/users'
import { getUsersByRole, getProjectsByColumnForTenant, getStalledItems } from '@/services/reports'
import pb from '@/lib/pocketbase/client'
import type { GlobalUser } from '@/types/superadmin'

interface AdminData {
  users: GlobalUser[]
  usersByRole: Record<string, number>
  projectsByCol: Record<string, number>
  stalled: any[]
  recentNotifs: any[]
  auditLogs: any[]
  loading: boolean
}

const Ctx = createContext<AdminData | null>(null)

export function useAdminData(): AdminData {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAdminData must be used within AdminWidgetProvider')
  return ctx
}

export function AdminWidgetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<AdminData>({
    users: [],
    usersByRole: {},
    projectsByCol: {},
    stalled: [],
    recentNotifs: [],
    auditLogs: [],
    loading: true,
  })

  const load = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const [u, ur, pbc, s, n, a] = await Promise.all([
        getUsersByTenant(user.tenantId),
        getUsersByRole(user.tenantId),
        getProjectsByColumnForTenant(user.tenantId),
        getStalledItems(user.tenantId),
        pb.collection('notifications').getList(1, 5, {
          filter: `tenant = "${user.tenantId}"`,
          sort: '-created',
        }),
        pb.collection('audit_logs').getList(1, 5, {
          filter: `tenant = "${user.tenantId}"`,
          sort: '-created',
        }),
      ])
      setData({
        users: u,
        usersByRole: ur,
        projectsByCol: pbc,
        stalled: s.slice(0, 5),
        recentNotifs: n.items,
        auditLogs: a.items,
        loading: false,
      })
    } catch {
      setData((prev) => ({ ...prev, loading: false }))
    }
  }, [user?.tenantId])

  useEffect(() => {
    load()
  }, [load])
  useRealtime('users', () => load(), !!user?.tenantId)
  useRealtime('notifications', () => load(), !!user?.tenantId)
  useRealtime('projects', () => load(), !!user?.tenantId)

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}
