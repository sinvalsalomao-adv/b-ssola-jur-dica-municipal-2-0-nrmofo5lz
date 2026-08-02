import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUnreadNotificationsCount } from '@/services/notifications'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  FolderKanban,
  Bell,
  Clock,
  Calendar,
  Building2,
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { useAdminData } from './AdminWidgetProvider'

export function StatsOverviewWidget() {
  const { projects } = useProjects()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const loadUnread = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      setUnread(await getUnreadNotificationsCount(user.tenantId))
    } catch {
      /* intentionally ignored */
    }
  }, [user?.tenantId])
  useEffect(() => {
    loadUnread()
  }, [loadUnread])
  useRealtime('notifications', () => loadUnread(), !!user?.tenantId)

  const active = projects.filter((p: any) => p.column !== 'Marketing').length
  const deadlines = projects.filter((p: any) => {
    if (p.column === 'Marketing' || !p.deadline) return false
    const d = new Date(p.deadline + 'T23:59:59')
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000)
    return diff >= 0 && diff <= 7
  }).length

  const cards = [
    {
      label: 'Projetos Ativos',
      value: active,
      sub: 'Não finalizados',
      icon: FolderKanban,
      color: 'text-[#3b82f6]',
      bg: 'bg-blue-50',
      path: '/bussola',
    },
    {
      label: 'Notificações Pendentes',
      value: unread,
      sub: 'Aguardando leitura',
      icon: Bell,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      path: '/notificacoes',
    },
    {
      label: 'Prazos Próximos',
      value: deadlines,
      sub: 'Próximos 7 dias',
      icon: Clock,
      color: 'text-red-600',
      bg: 'bg-red-50',
      path: '/bussola',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card
            key={c.label}
            className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
            onClick={() => navigate(c.path)}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {c.label}
                </p>
                <h3 className={`text-3xl font-extrabold mt-2 ${c.color}`}>{c.value}</h3>
                <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
              </div>
              <div
                className={`w-12 h-12 rounded-xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function RecentProjectsWidget() {
  const { projects, openProjectDetails } = useProjects()
  const navigate = useNavigate()
  const recent = [...projects].slice(0, 5)
  const handleClick = (p: any) => {
    navigate('/bussola')
    setTimeout(() => openProjectDetails(p), 100)
  }

  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-[#1c2a3e]">Projetos Recentes</h3>
          <p className="text-xs text-gray-500 mt-0.5">Últimas atualizações no sistema.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/bussola')}
          className="text-xs text-[#3b82f6] hover:bg-blue-50"
        >
          Ver todos
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-50/70">
            <TableRow>
              <TableHead className="text-xs font-semibold text-gray-600">Nome do Projeto</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Prefeitura</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Etapa</TableHead>
              <TableHead className="text-xs font-semibold text-gray-600">Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recent.map((p: any) => (
              <TableRow
                key={p.id}
                onClick={() => handleClick(p)}
                className="cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <TableCell className="font-semibold text-sm text-[#1c2a3e] max-w-[260px] truncate">
                  {p.title}
                </TableCell>
                <TableCell className="text-xs text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {p.prefeitura}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                    {p.column}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium text-gray-800">
                      {p.deadline
                        ? new Date(p.deadline + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {recent.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-gray-400 py-8">
                  Nenhum projeto encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

export function UsersTotalWidget() {
  const { users, loading } = useAdminData()
  if (loading) return <Skeleton className="h-28 w-full" />
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50 text-[#3b82f6]">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#1c2a3e]">{users.length}</p>
          <p className="text-xs text-gray-500">Total de Usuários</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function UsersStatusWidget() {
  const { users, loading } = useAdminData()
  if (loading)
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    )
  const active = users.filter((u) => u.status === 'ativo').length
  const inactive = users.length - active
  const items = [
    {
      label: 'Usuários Ativos',
      value: active,
      icon: UserCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Usuários Inativos',
      value: inactive,
      icon: UserX,
      color: 'text-red-500',
      bg: 'bg-red-50',
    },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((s) => {
        const Icon = s.icon
        return (
          <Card key={s.label} className="bg-white border-0 shadow-subtle">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1c2a3e]">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function RecentAccessWidget() {
  const { users, loading } = useAdminData()
  if (loading) return <Skeleton className="h-[200px] w-full" />
  const recent = [...users]
    .sort((a, b) => (b.lastAccess || '').localeCompare(a.lastAccess || ''))
    .slice(0, 5)
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Últimos Acessos</h3>
      </div>
      <CardContent className="p-3">
        <div className="space-y-2">
          {recent.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0"
            >
              <div>
                <p className="text-xs font-medium text-[#1c2a3e]">{u.name}</p>
                <p className="text-[10px] text-gray-400">{u.email}</p>
              </div>
              <span className="text-[10px] text-gray-400">
                {u.lastAccess && u.lastAccess !== '—'
                  ? new Date(u.lastAccess).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
            </div>
          ))}
          {recent.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário encontrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentNotificationsWidget() {
  const { recentNotifs, loading } = useAdminData()
  if (loading) return <Skeleton className="h-[200px] w-full" />
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <Bell className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Notificações Recentes</h3>
      </div>
      <CardContent className="p-3">
        <div className="space-y-2">
          {recentNotifs.map((n: any) => (
            <div
              key={n.id}
              className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1c2a3e] truncate">
                  {n.project_title || n.mensagem || 'Notificação'}
                </p>
                <p className="text-[10px] text-gray-400">
                  {n.created ? new Date(n.created).toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
              <Badge variant="outline" className="text-[9px] shrink-0">
                {n.tipo || '—'}
              </Badge>
            </div>
          ))}
          {recentNotifs.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">
              Nenhuma notificação encontrada.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function StalledItemsWidget() {
  const { stalled, loading } = useAdminData()
  if (loading) return <Skeleton className="h-[200px] w-full" />
  if (stalled.length === 0) return null
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Itens Estagnados ({stalled.length})</h3>
      </div>
      <CardContent className="p-3">
        <div className="space-y-2">
          {stalled.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
            >
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1c2a3e] truncate">{item.projectTitle}</p>
                <p className="text-[10px] text-gray-400">
                  {item.column} • {item.responsible}
                </p>
              </div>
              <Badge className="bg-amber-500 text-white text-[9px] shrink-0">
                {item.daysStalled} dias
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function RecentAuditLogsWidget() {
  const { auditLogs, loading } = useAdminData()
  if (loading) return <Skeleton className="h-[200px] w-full" />
  return (
    <Card className="bg-white border-0 shadow-subtle">
      <div className="p-4 border-b border-gray-100 flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#3b82f6]" />
        <h3 className="text-sm font-bold text-[#1c2a3e]">Logs de Auditoria Recentes</h3>
      </div>
      <CardContent className="p-3">
        <div className="space-y-2">
          {auditLogs.map((log: any) => (
            <div
              key={log.id}
              className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#1c2a3e] truncate">
                  {log.user_name || '—'} • {log.action_type || ''}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {log.description || log.project_title || ''}
                </p>
              </div>
              <span className="text-[10px] text-gray-400 shrink-0">
                {log.created ? new Date(log.created).toLocaleDateString('pt-BR') : ''}
              </span>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum log encontrado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
