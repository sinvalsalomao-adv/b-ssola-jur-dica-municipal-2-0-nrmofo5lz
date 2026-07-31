import { useState, useEffect, useMemo } from 'react'
import { Shield, Lock, BarChart3, Layers, PieChart, FileText, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import {
  getAllProjects,
  getAllDfds,
  getAllTenantsForReports,
  getUsersByRole,
  getProjectsByColumnForTenant,
  getStalledItems,
  getRecentAuditLogsForTenant,
  getNotificationsSummary,
} from '@/services/reports'
import { COLUMNS, type Project } from '@/types/project'
import type { DfdRecord } from '@/types/dfd'
import { TenantsProjectsChart } from '@/components/reports/TenantsProjectsChart'
import { KanbanColumnsChart } from '@/components/reports/KanbanColumnsChart'
import { PriorityChart } from '@/components/reports/PriorityChart'
import { DfdStatusChart } from '@/components/reports/DfdStatusChart'
import { OverdueTable } from '@/components/reports/OverdueTable'
import { UsersByRoleCard } from '@/components/reports/UsersByRoleCard'
import { StalledItemsCard } from '@/components/reports/StalledItemsCard'
import { NotificationsSummaryCard } from '@/components/reports/NotificationsSummaryCard'
import { RecentAuditLogsCard } from '@/components/reports/RecentAuditLogsCard'

export default function RelatoriosPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [dfds, setDfds] = useState<DfdRecord[]>([])
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [usersByRole, setUsersByRole] = useState<Record<string, number>>({})
  const [stalled, setStalled] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [notifSummary, setNotifSummary] = useState({
    total: 0,
    unread: 0,
    read: 0,
    gargalo: 0,
    prazoFatal: 0,
  })
  const [projectsByCol, setProjectsByCol] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false)
      return
    }
    Promise.all([
      getAllProjects(),
      getAllDfds(),
      getAllTenantsForReports(),
      getUsersByRole(user.tenantId),
      getProjectsByColumnForTenant(user.tenantId),
      getStalledItems(user.tenantId),
      getRecentAuditLogsForTenant(user.tenantId),
      getNotificationsSummary(user.tenantId),
    ])
      .then(([p, d, t, ur, pbc, st, al, ns]) => {
        setProjects(p)
        setDfds(d)
        setTenants(t)
        setUsersByRole(ur)
        setProjectsByCol(pbc)
        setStalled(st)
        setAuditLogs(al)
        setNotifSummary(ns)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.tenantId])

  const projectCountData = useMemo(
    () =>
      tenants.map((t) => ({
        name: t.name,
        count: projects.filter((p) => p.prefeitura === t.name).length,
      })),
    [tenants, projects],
  )

  const kanbanData = useMemo(
    () =>
      tenants.map((t) => {
        const tp = projects.filter((p) => p.prefeitura === t.name)
        const row: Record<string, any> = { name: t.name }
        COLUMNS.forEach((c) => {
          row[c] = tp.filter((p) => p.column === c).length
        })
        return row
      }),
    [tenants, projects],
  )

  const dfdStatusData = useMemo(
    () =>
      tenants.map((t) => {
        const td = dfds.filter((d) => d.tenantId === t.id)
        return {
          name: t.name,
          Rascunho: td.filter((d) => d.status === 'Rascunho').length,
          Finalizado: td.filter((d) => d.status === 'Finalizado').length,
        }
      }),
    [tenants, dfds],
  )

  const overdueProjects = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return projects.filter(
      (p) => p.column !== 'Marketing' && new Date(p.deadline + 'T23:59:59') < now,
    )
  }, [projects])

  if (user?.role !== 'superadmin' && user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1c2a3e]">Acesso Negado</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Apenas administradores podem acessar o dashboard de relatórios.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1c2a3e]">Relatórios</h2>
          <p className="text-xs text-gray-500">
            Análise do município e comparativo entre prefeituras
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <UsersByRoleCard data={usersByRole} />
        <NotificationsSummaryCard data={notifSummary} />
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Projetos por Coluna</h3>
          </div>
          <CardContent className="p-4">
            <div className="space-y-1.5">
              {COLUMNS.map((col) => (
                <div
                  key={col}
                  className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0"
                >
                  <span className="text-xs text-gray-700">{col}</span>
                  <span className="text-sm font-bold text-[#1c2a3e]">
                    {projectsByCol[col] || 0}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StalledItemsCard items={stalled} />
        <RecentAuditLogsCard logs={auditLogs} />
      </div>

      <div className="flex items-center gap-2 pt-4">
        <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Comparativo entre Prefeituras</h3>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Total de Projetos por Prefeitura</h3>
          </div>
          <CardContent className="p-4">
            <TenantsProjectsChart data={projectCountData} />
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Projetos por Coluna Kanban</h3>
          </div>
          <CardContent className="p-4">
            <KanbanColumnsChart data={kanbanData} />
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Projetos por Prioridade</h3>
          </div>
          <CardContent className="p-4">
            <PriorityChart projects={projects} tenants={tenants} />
          </CardContent>
        </Card>
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">DFDs por Status</h3>
          </div>
          <CardContent className="p-4">
            <DfdStatusChart data={dfdStatusData} />
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-[#1c2a3e]">
            Projetos Atrasados ({overdueProjects.length})
          </h3>
        </div>
        <CardContent className="p-0">
          <OverdueTable projects={overdueProjects} />
        </CardContent>
      </Card>
    </div>
  )
}
