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
  error: string | null
  overdueCount: number
  upcomingCount: number
  activeProjectsCount: number
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
    error: null,
    overdueCount: 0,
    upcomingCount: 0,
    activeProjectsCount: 0,
  })

  const load = useCallback(async () => {
    if (!user?.tenantId) {
      setData((prev) => ({ ...prev, loading: false }))
      return
    }
    setData((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [u, ur, pbc, s, n, a, projList] = await Promise.all([
        getUsersByTenant(user.tenantId).catch(() => []),
        getUsersByRole(user.tenantId).catch(() => ({})),
        getProjectsByColumnForTenant(user.tenantId).catch(() => ({})),
        getStalledItems(user.tenantId).catch(() => []),
        pb
          .collection('notifications')
          .getList(1, 6, {
            filter: `tenant = "${user.tenantId}"`,
            sort: '-created',
          })
          .catch(() => ({ items: [] })),
        pb
          .collection('audit_logs')
          .getList(1, 6, {
            filter: `tenant = "${user.tenantId}"`,
            sort: '-created',
          })
          .catch(() => ({ items: [] })),
        pb
          .collection('projects')
          .getFullList({
            filter: `tenant = "${user.tenantId}"`,
          })
          .catch(() => []),
      ])

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let overdue = 0
      let upcoming = 0
      let active = 0

      projList.forEach((p: any) => {
        if (p.column !== 'Marketing') {
          active += 1
        }
        if (p.column !== 'Marketing' && p.deadline) {
          const d = new Date(p.deadline.substring(0, 10) + 'T23:59:59')
          if (!isNaN(d.getTime())) {
            const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
            if (diffDays < 0) overdue += 1
            else if (diffDays <= 7) upcoming += 1
          }
        }
      })

      setData({
        users: u,
        usersByRole: ur,
        projectsByCol: pbc,
        stalled: s.slice(0, 5),
        recentNotifs: n.items,
        auditLogs: a.items,
        loading: false,
        error: null,
        overdueCount: overdue,
        upcomingCount: upcoming,
        activeProjectsCount: active,
      })
    } catch {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: 'Não foi possível carregar os dados administrativos no momento.',
      }))
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
