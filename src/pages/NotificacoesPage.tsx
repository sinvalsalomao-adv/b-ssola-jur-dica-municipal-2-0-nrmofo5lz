import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getNotificationsPaginated,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'
import type { NotificationItem } from '@/types/controle'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bell,
  Search,
  Check,
  CheckCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Plus,
  MessageSquare,
  ShieldAlert,
  Info,
  Calendar,
  Building2,
  CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/dateUtils'
import { toast } from 'sonner'
import { NewNotificationModal } from '@/components/admin/NewNotificationModal'
import { TenantRequiredNotice } from '@/components/TenantRequiredNotice'
import pb from '@/lib/pocketbase/client'

const PER_PAGE = 15

export default function NotificacoesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filtros
  const [filterTipo, setFilterTipo] = useState<string>('Todos')
  const [filterLida, setFilterLida] = useState<string>('Todos') // 'Todos', 'false' (não lidas), 'true' (lidas)
  const [filterPeriodo, setFilterPeriodo] = useState<'todos' | 'hoje' | '7dias' | '30dias'>('todos')
  const [filterEscopo, setFilterEscopo] = useState<'todos' | 'minhas'>('todos')
  const [search, setSearch] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)

  const isAdminOrSuper = user?.role === 'admin' || user?.role === 'superadmin'
  const isSuperadminWithoutTenant = user?.role === 'superadmin' && !user?.tenantId
  const effectiveTenantId = isSuperadminWithoutTenant ? undefined : user?.tenantId || undefined

  // Carregar dados de notificações
  const loadData = useCallback(async () => {
    if (isSuperadminWithoutTenant) {
      setNotifications([])
      setTotalItems(0)
      setTotalPages(1)
      setUnreadCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const filters = {
        tipo: filterTipo !== 'Todos' ? filterTipo : undefined,
        lida: filterLida !== 'Todos' ? filterLida : undefined,
        periodo: filterPeriodo,
        targetUser: filterEscopo === 'minhas' ? user?.id : undefined,
      }

      const [res, unread] = await Promise.all([
        getNotificationsPaginated(effectiveTenantId, page, PER_PAGE, filters, user?.id),
        getUnreadNotificationsCount(effectiveTenantId, user?.id),
      ])

      setNotifications(res.items)
      setTotalPages(res.totalPages || 1)
      setTotalItems(res.totalItems)
      setUnreadCount(unread)
    } catch {
      toast.error('Erro ao carregar notificações.')
    } finally {
      setLoading(false)
    }
  }, [
    effectiveTenantId,
    isSuperadminWithoutTenant,
    page,
    filterTipo,
    filterLida,
    filterPeriodo,
    filterEscopo,
    user?.id,
  ])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Realtime updates
  useRealtime('notifications', () => loadData(), !!effectiveTenantId)
  useRealtime('notification_reads', () => loadData(), !!user?.id)

  // Escuta evento customizado de atualização do sino
  useEffect(() => {
    const handleSync = () => loadData()
    window.addEventListener('notificationsUpdated', handleSync)
    return () => window.removeEventListener('notificationsUpdated', handleSync)
  }, [loadData])

  const handleMarkAsRead = async (item: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await markNotificationAsRead(item.id, user?.id, effectiveTenantId)
      // Atualiza estado local de forma otimista
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, lida: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      window.dispatchEvent(new CustomEvent('notificationsUpdated'))
      toast.success('Notificação marcada como lida.')
    } catch {
      toast.error('Não foi possível marcar a notificação.')
    }
  }

  const handleMarkAllAsRead = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsAsRead(effectiveTenantId, user?.id)
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })))
      setUnreadCount(0)
      window.dispatchEvent(new CustomEvent('notificationsUpdated'))
      toast.success('Todas as notificações foram marcadas como lidas.')
    } catch {
      toast.error('Erro ao marcar notificações como lidas.')
    } finally {
      setMarkingAll(false)
    }
  }

  const handleOpenDestination = async (item: NotificationItem) => {
    // 1. Marca como lida se ainda não foi (sem alterar pendência do projeto)
    if (!item.lida) {
      await markNotificationAsRead(item.id, user?.id, effectiveTenantId)
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, lida: true } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      window.dispatchEvent(new CustomEvent('notificationsUpdated'))
    }

    const projId = item.projetoId || item.projectId
    if (projId) {
      try {
        const projectRecord = await pb
          .collection('projects')
          .getOne(projId)
          .catch(() => null)
        if (!projectRecord) {
          toast.info(
            'O projeto ou tarefa vinculada a este aviso não está mais disponível no sistema.',
          )
          return
        }

        navigate('/bussola')
        const targetTab = item.alertType === 'Mencao' ? 'comments' : 'details'
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('openProjectById', {
              detail: { projectId: projId, tab: targetTab },
            }),
          )
        }, 150)
      } catch {
        toast.info('Não foi possível abrir o registro correspondente.')
      }
    } else {
      toast.info('Esta é uma notificação informativa geral sem projeto vinculado.')
    }
  }

  // Filtro de busca textual em memória sobre o título, prefeitura e mensagem
  const filteredList = useMemo(() => {
    if (!search.trim()) return notifications
    const q = search.toLowerCase()
    return notifications.filter(
      (n) =>
        (n.projectTitle && n.projectTitle.toLowerCase().includes(q)) ||
        (n.mensagem && n.mensagem.toLowerCase().includes(q)) ||
        (n.prefeitura && n.prefeitura.toLowerCase().includes(q)) ||
        (n.alertType && n.alertType.toLowerCase().includes(q)),
    )
  }, [notifications, search])

  const getAlertBadge = (type: string) => {
    switch (type) {
      case 'Prazo Fatal':
        return (
          <Badge className="bg-red-600 hover:bg-red-700 text-white font-medium">Prazo Fatal</Badge>
        )
      case 'Atraso':
      case 'Gargalo':
        return (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
            Gargalo / Atraso
          </Badge>
        )
      case 'Mencao':
        return (
          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">Menção</Badge>
        )
      case 'Superadmin':
      case 'Seguranca':
        return (
          <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-medium">
            Sistema
          </Badge>
        )
      case 'Informativo':
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium">
            Informativo
          </Badge>
        )
      default:
        return <Badge variant="outline">{type}</Badge>
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Prazo Fatal':
        return <AlertTriangle className="w-4 h-4 text-red-600" />
      case 'Atraso':
      case 'Gargalo':
        return <Clock className="w-4 h-4 text-amber-600" />
      case 'Mencao':
        return <MessageSquare className="w-4 h-4 text-indigo-600" />
      case 'Superadmin':
      case 'Seguranca':
        return <ShieldAlert className="w-4 h-4 text-purple-600" />
      default:
        return <Bell className="w-4 h-4 text-blue-600" />
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1c2a3e] flex items-center gap-2">
            <Bell className="w-6 h-6 text-[#3b82f6]" /> Central de Notificações
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Acompanhe comunicados, prazos, gargalos do Kanban e menções em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && !isSuperadminWithoutTenant && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markingAll || loading}
              className="text-xs text-gray-700 border-gray-300 hover:bg-gray-100"
            >
              <CheckCheck className="w-4 h-4 mr-1.5 text-blue-600" />
              Marcar todas como lidas
            </Button>
          )}

          {isAdminOrSuper && !isSuperadminWithoutTenant && (
            <Button
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Novo Comunicado
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadData()}
            disabled={loading}
            className="h-8 w-8 text-gray-500"
            title="Atualizar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Bloqueio se superadmin não selecionou tenant */}
      {isSuperadminWithoutTenant ? (
        <TenantRequiredNotice
          title="Selecione uma prefeitura para consultar as notificações"
          description="Os alertas, prazos de projetos e comunicados institucionais pertencem ao escopo municipal específico. Como superadministrador na visão global, selecione um município no cabeçalho para gerenciar suas notificações."
          onSelected={() => loadData()}
        />
      ) : (
        <>
          {/* Barra de Filtros */}
          <Card className="bg-white border-0 shadow-subtle">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Buscar por assunto, projeto ou mensagem..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                  {/* Filtro de Leitura */}
                  <Select
                    value={filterLida}
                    onValueChange={(val) => {
                      setFilterLida(val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[140px] text-xs h-9">
                      <SelectValue placeholder="Leitura" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todas as notas</SelectItem>
                      <SelectItem value="false">Não lidas</SelectItem>
                      <SelectItem value="true">Já lidas</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro por Tipo */}
                  <Select
                    value={filterTipo}
                    onValueChange={(val) => {
                      setFilterTipo(val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[150px] text-xs h-9">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Todos">Todos os tipos</SelectItem>
                      <SelectItem value="Informativo">Informativo</SelectItem>
                      <SelectItem value="Aviso">Aviso</SelectItem>
                      <SelectItem value="Alerta">Alerta</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                      <SelectItem value="Prazo Fatal">Prazo Fatal</SelectItem>
                      <SelectItem value="Gargalo">Gargalo</SelectItem>
                      <SelectItem value="Mencao">Menção</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro de Período */}
                  <Select
                    value={filterPeriodo}
                    onValueChange={(val: any) => {
                      setFilterPeriodo(val)
                      setPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[140px] text-xs h-9">
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todo o período</SelectItem>
                      <SelectItem value="hoje">Hoje</SelectItem>
                      <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                      <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Filtro de Escopo ("Para mim" vs "Visão Municipal") apenas para admin */}
                  {isAdminOrSuper && (
                    <Select
                      value={filterEscopo}
                      onValueChange={(val: any) => {
                        setFilterEscopo(val)
                        setPage(1)
                      }}
                    >
                      <SelectTrigger className="w-[150px] text-xs h-9">
                        <SelectValue placeholder="Destinatário" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Visão Municipal</SelectItem>
                        <SelectItem value="minhas">Dirigidas a mim</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Linha de status e legenda */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span>
                    Total: <strong className="text-gray-900">{totalItems}</strong> registro(s)
                  </span>
                  <span>•</span>
                  <span>
                    Não lidas: <strong className="text-blue-600">{unreadCount}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1 text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Não lida
                  </span>
                  <span className="flex items-center gap-1 text-gray-400">
                    <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                    Lida
                  </span>
                  <span className="flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    Prazo / Gargalo
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Notificações */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-white rounded-lg border border-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : filteredList.length === 0 ? (
            <Card className="bg-white border-0 shadow-subtle py-12 text-center">
              <CardContent className="space-y-3">
                <Bell className="w-12 h-12 text-gray-300 mx-auto" />
                <h3 className="text-base font-semibold text-[#1c2a3e]">
                  Nenhuma notificação encontrada
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Não há notificações correspondentes aos critérios de filtro selecionados ou para o
                  contexto atual.
                </p>
                {(filterTipo !== 'Todos' ||
                  filterLida !== 'Todos' ||
                  filterPeriodo !== 'todos' ||
                  search) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFilterTipo('Todos')
                      setFilterLida('Todos')
                      setFilterPeriodo('todos')
                      setSearch('')
                      setPage(1)
                    }}
                    className="text-xs"
                  >
                    Limpar Filtros
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredList.map((item) => {
                const isFatal = item.alertType === 'Prazo Fatal'
                const isWarning = item.alertType === 'Atraso' || item.alertType === 'Gargalo'
                const isRead = item.lida

                return (
                  <div
                    key={item.id}
                    onClick={() => handleOpenDestination(item)}
                    className={`rounded-xl border p-4 transition-all duration-150 cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      !isRead
                        ? 'bg-white border-blue-200 shadow-sm hover:border-blue-300 hover:shadow-md'
                        : 'bg-gray-50/60 border-gray-200/80 opacity-90 hover:bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      {/* Ícone de Tipo */}
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isFatal
                            ? 'bg-red-100 text-red-700'
                            : isWarning
                              ? 'bg-amber-100 text-amber-700'
                              : !isRead
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {getAlertIcon(item.alertType)}
                      </div>

                      {/* Conteúdo textual */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`text-sm font-semibold truncate ${
                              !isRead ? 'text-[#1c2a3e] font-bold' : 'text-gray-700 font-medium'
                            }`}
                          >
                            {item.projectTitle || 'Comunicado Geral'}
                          </h3>
                          {getAlertBadge(item.alertType)}
                          {!isRead && (
                            <span
                              className="w-2 h-2 rounded-full bg-blue-600 inline-block"
                              title="Não lida"
                            />
                          )}
                          {isRead && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-gray-400 border-gray-300 py-0"
                            >
                              Lida
                            </Badge>
                          )}
                        </div>

                        {item.mensagem && (
                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">
                            {item.mensagem}
                          </p>
                        )}

                        {/* Metadados: Município, Data e Projeto Relacionado */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(item.createdAt, 'Data desconhecida')}
                          </span>

                          {item.prefeitura && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {item.prefeitura}
                            </span>
                          )}

                          {item.projetoId && (
                            <span className="text-[#3b82f6] hover:underline flex items-center gap-1">
                              Ver no Kanban <ExternalLink className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ações à direita */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                      {!isRead ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleMarkAsRead(item, e)}
                          className="h-8 px-2.5 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          title="Marcar como lida"
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Marcar como lida
                        </Button>
                      ) : (
                        <span className="text-[11px] text-gray-400 flex items-center gap-1 px-2 py-1">
                          <CheckCheck className="w-3.5 h-3.5 text-gray-400" />
                          Lida
                        </span>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDestination(item)}
                        className="h-8 px-2.5 text-xs text-gray-600 hover:text-gray-900"
                      >
                        Abrir destino <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-gray-500">
                Página {page} de {totalPages} ({totalItems} itens no total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="text-xs h-8"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="text-xs h-8"
                >
                  Próxima <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Criação de Notificação Interna */}
      {showNewModal && (
        <NewNotificationModal
          open={showNewModal}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            setShowNewModal(false)
            loadData()
          }}
          tenantId={effectiveTenantId || ''}
        />
      )}
    </div>
  )
}
