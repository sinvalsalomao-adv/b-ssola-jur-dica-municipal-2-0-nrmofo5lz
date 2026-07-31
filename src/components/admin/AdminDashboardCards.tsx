import { useState, useEffect, useCallback } from 'react'
import { Users, UserCheck, UserX, Clock, Bell, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUsersByTenant } from '@/services/users'
import { getStalledItems } from '@/services/reports'
import pb from '@/lib/pocketbase/client'
import type { GlobalUser } from '@/types/superadmin'

export function AdminDashboardCards() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<GlobalUser[]>([])
  const [recentNotifs, setRecentNotifs] = useState<any[]>([])
  const [stalled, setStalled] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const [u, n, s] = await Promise.all([
        getUsersByTenant(user.tenantId),
        pb.collection('notifications').getList(1, 5, {
          filter: `tenant = "${user.tenantId}"`,
          sort: '-created',
        }),
        getStalledItems(user.tenantId),
      ])
      setUsers(u)
      setRecentNotifs(n.items)
      setStalled(s.slice(0, 5))
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [user?.tenantId])

  useEffect(() => {
    load()
  }, [load])
  useRealtime(
    'users',
    () => {
      load()
    },
    !!user?.tenantId,
  )
  useRealtime(
    'notifications',
    () => {
      load()
    },
    !!user?.tenantId,
  )

  const total = users.length
  const active = users.filter((u) => u.status === 'ativo').length
  const inactive = total - active
  const recentUsers = [...users]
    .sort((a, b) => (b.lastAccess || '').localeCompare(a.lastAccess || ''))
    .slice(0, 5)

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    )
  }

  const stats = [
    {
      label: 'Total de Usuários',
      value: total,
      icon: Users,
      color: 'text-[#3b82f6]',
      bg: 'bg-blue-50',
    },
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
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Últimos Acessos</h3>
          </div>
          <CardContent className="p-3">
            <div className="space-y-2">
              {recentUsers.map((u) => (
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
              {recentUsers.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum usuário encontrado.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#3b82f6]" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">Notificações Recentes</h3>
          </div>
          <CardContent className="p-3">
            <div className="space-y-2">
              {recentNotifs.map((n) => (
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
      </div>

      {stalled.length > 0 && (
        <Card className="bg-white border-0 shadow-subtle">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[#1c2a3e]">
              Itens Estagnados ({stalled.length})
            </h3>
          </div>
          <CardContent className="p-3">
            <div className="space-y-2">
              {stalled.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#1c2a3e] truncate">
                      {item.projectTitle}
                    </p>
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
      )}
    </div>
  )
}
