import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bell,
  CheckCheck,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
} from 'lucide-react'
import {
  getNotificationsPaginated,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'
import { getTenants } from '@/services/tenants'
import { toast } from 'sonner'
import { NewNotificationModal } from '@/components/admin/NewNotificationModal'
import type { NotificationItem } from '@/types/controle'
import type { Prefeitura } from '@/types/superadmin'

const PER_PAGE = 10

export default function NotificacoesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuperadmin = user?.role === 'superadmin'

  const [availableTenants, setAvailableTenants] = useState<Prefeitura[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    user?.tenantId || (isSuperadmin ? 'all' : ''),
  )

  const [items, setItems] = useState<NotificationItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('Todos')
  const [filterLida, setFilterLida] = useState('Todos')
  const [filterDestinatario, setFilterDestinatario] = useState<'todas' | 'para_mim'>('todas')
  const [createOpen, setCreateOpen] = useState(false)

  // Carregar prefeituras para o superadmin
  useEffect(() => {
    if (isSuperadmin) {
      getTenants()
        .then((list) => setAvailableTenants(list))
        .catch(() => {})
    }
  }, [isSuperadmin])

  const effectiveTenantId = isSuperadmin ? selectedTenantId : user?.tenantId || ''

  const load = useCallback(async () => {
    if (!effectiveTenantId && !isSuperadmin) return
    setLoading(true)
    try {
      const result = await getNotificationsPaginated(effectiveTenantId, page, PER_PAGE, {
        tipo: filterTipo,
        lida: filterLida,
        targetUser: filterDestinatario === 'para_mim' ? user?.id : undefined,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotalItems(result.totalItems)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [effectiveTenantId, isSuperadmin, page, filterTipo, filterLida, filterDestinatario, user?.id])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    setPage(1)
  }, [filterTipo, filterLida, filterDestinatario, selectedTenantId])

  useRealtime(
    'notifications',
    () => {
      load()
    },
    !!effectiveTenantId || isSuperadmin,
  )

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(
        id,
        user?.id,
        effectiveTenantId !== 'all' ? effectiveTenantId : undefined,
      )
      load()
    } catch {
      /* ignore */
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead(effectiveTenantId !== 'all' ? effectiveTenantId : undefined)
      toast.success('Todas as notificações marcadas como lidas!')
      load()
    } catch {
      toast.error('Erro ao marcar notificações.')
    }
  }

  const handleOpenNotificationProject = (projectId?: string) => {
    if (!projectId) {
      navigate('/bussola')
      return
    }
    navigate('/bussola')
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('openProjectById', { detail: { projectId } }))
    }, 150)
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1c2a3e]">Notificações do Sistema</h2>
            <p className="text-xs text-gray-500">
              Avisos internos, gargalos e prazos vinculados a projetos e demandas municipais (
              {totalItems} registros)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="gap-2 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              <Plus className="w-4 h-4" /> Nova Notificação
            </Button>
          )}
          <Button variant="outline" onClick={handleMarkAllRead} className="gap-2 text-xs">
            <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
          </Button>
        </div>
      </div>

      {/* Seletor de prefeitura para Superadmin */}
      {isSuperadmin && (
        <Card className="bg-slate-50 border border-slate-200">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                Filtrar por Prefeitura:
              </span>
              <Select
                value={selectedTenantId}
                onValueChange={(val) => {
                  setSelectedTenantId(val)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-full sm:w-80 h-9 bg-white text-xs">
                  <SelectValue placeholder="Todas as prefeituras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as prefeituras</SelectItem>
                  {availableTenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros da Central de Notificações */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filterDestinatario}
          onValueChange={(val: 'todas' | 'para_mim') => {
            setFilterDestinatario(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[190px] h-9 text-xs">
            <SelectValue placeholder="Destinatário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas da prefeitura</SelectItem>
            <SelectItem value="para_mim">Para mim (menções / diretas)</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterTipo}
          onValueChange={(val) => {
            setFilterTipo(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os tipos</SelectItem>
            <SelectItem value="Gargalo">Gargalo</SelectItem>
            <SelectItem value="Prazo Fatal">Prazo Fatal</SelectItem>
            <SelectItem value="Aviso Interno">Aviso Interno</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filterLida}
          onValueChange={(val) => {
            setFilterLida(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos</SelectItem>
            <SelectItem value="false">Não lidas</SelectItem>
            <SelectItem value="true">Lidas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-white border-0 shadow-subtle">
          <CardContent className="p-12 text-center text-sm text-gray-400">
            Nenhuma notificação encontrada com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => {
            const isFatal = n.alertType === 'Prazo Fatal'
            return (
              <Card
                key={n.id}
                className={`border-l-4 ${isFatal ? 'border-l-red-500' : 'border-l-amber-500'} shadow-sm bg-white ${n.lida ? 'opacity-60' : ''}`}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isFatal ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}
                  >
                    {isFatal ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4
                        className="font-bold text-sm text-[#1c2a3e] hover:underline cursor-pointer flex items-center gap-1"
                        onClick={() => handleOpenNotificationProject(n.projectId)}
                      >
                        {n.projectTitle}
                        {n.projectId && <ExternalLink className="w-3 h-3 text-gray-400" />}
                      </h4>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${isFatal ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                      >
                        {n.alertType}
                      </Badge>
                      {!n.lida && <Badge className="text-[9px] bg-blue-500 text-white">Nova</Badge>}
                      {n.targetUserId && n.targetUserId === user?.id && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          Para mim
                        </Badge>
                      )}
                    </div>
                    {n.mensagem && <p className="text-xs text-gray-600 mt-1">{n.mensagem}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                      {n.daysIdle > 0 && <span>{n.daysIdle} dias parado</span>}
                      <span>Coluna: {n.column}</span>
                      {n.responsible && <span>Resp: {n.responsible}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {n.projectId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenNotificationProject(n.projectId)}
                        className="text-xs text-slate-600 hover:bg-slate-100"
                        title="Abrir no Kanban"
                      >
                        Abrir
                      </Button>
                    )}
                    {!n.lida && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(n.id)}
                        className="text-xs text-blue-600 hover:bg-blue-50"
                      >
                        Marcar lida
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-gray-500">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <NewNotificationModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
        tenantId={user?.tenantId || ''}
      />
    </div>
  )
}
