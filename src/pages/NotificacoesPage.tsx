import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, Clock, CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getNotificationsPaginated,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'
import { toast } from 'sonner'
import type { NotificationItem } from '@/types/controle'

const PER_PAGE = 10

export default function NotificacoesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<NotificationItem[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('Todos')
  const [filterLida, setFilterLida] = useState('Todos')

  const load = useCallback(async () => {
    if (!user?.tenantId) return
    setLoading(true)
    try {
      const result = await getNotificationsPaginated(user.tenantId, page, PER_PAGE, {
        tipo: filterTipo,
        lida: filterLida,
      })
      setItems(result.items)
      setTotalPages(result.totalPages)
      setTotalItems(result.totalItems)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [user?.tenantId, page, filterTipo, filterLida])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    setPage(1)
  }, [filterTipo, filterLida])
  useRealtime(
    'notifications',
    () => {
      load()
    },
    !!user?.tenantId,
  )

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationAsRead(id)
      load()
    } catch {
      /* ignore */
    }
  }

  const handleMarkAllRead = async () => {
    if (!user?.tenantId) return
    try {
      await markAllNotificationsAsRead(user.tenantId)
      toast.success('Todas as notificações marcadas como lidas!')
      load()
    } catch {
      toast.error('Erro ao marcar notificações.')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1c2a3e]">Notificações</h2>
            <p className="text-xs text-gray-500">{totalItems} notificação(ões) encontrada(s)</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleMarkAllRead} className="gap-2 text-xs">
          <CheckCheck className="w-4 h-4" /> Marcar todas como lidas
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[160px] h-9 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Todos">Todos os tipos</SelectItem>
            <SelectItem value="Gargalo">Gargalo</SelectItem>
            <SelectItem value="Prazo Fatal">Prazo Fatal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLida} onValueChange={setFilterLida}>
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
                      <h4 className="font-bold text-sm text-[#1c2a3e]">{n.projectTitle}</h4>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${isFatal ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}
                      >
                        {n.alertType}
                      </Badge>
                      {!n.lida && <Badge className="text-[9px] bg-blue-500 text-white">Nova</Badge>}
                    </div>
                    {n.mensagem && <p className="text-xs text-gray-600 mt-1">{n.mensagem}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {n.daysIdle > 0 && <span>{n.daysIdle} dias parado</span>}
                      <span>Coluna: {n.column}</span>
                      {n.responsible && <span>Resp: {n.responsible}</span>}
                    </div>
                  </div>
                  {!n.lida && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMarkRead(n.id)}
                      className="text-xs text-blue-600 hover:bg-blue-50 shrink-0"
                    >
                      Marcar lida
                    </Button>
                  )}
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
    </div>
  )
}
