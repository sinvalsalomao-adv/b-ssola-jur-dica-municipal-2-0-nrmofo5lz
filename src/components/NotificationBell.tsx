import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getUnreadNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notifications'
import type { NotificationItem } from '@/types/controle'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Bell,
  Check,
  CheckCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react'
import { formatDate } from '@/lib/dateUtils'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Superadmin sem prefeitura selecionada não deve usar fallback cego
  const isSuperadminWithoutTenant = user?.role === 'superadmin' && !user?.tenantId
  const effectiveTenantId = isSuperadminWithoutTenant ? undefined : user?.tenantId || undefined

  const loadNotifications = useCallback(async () => {
    if (isSuperadminWithoutTenant) {
      setNotifications([])
      setUnreadCount(0)
      return
    }

    try {
      const [items, count] = await Promise.all([
        getUnreadNotifications(effectiveTenantId, 8, user?.id),
        getUnreadNotificationsCount(effectiveTenantId, user?.id),
      ])
      setNotifications(items)
      setUnreadCount(count)
    } catch {
      // Silencioso para não quebrar UI
    }
  }, [effectiveTenantId, isSuperadminWithoutTenant, user?.id])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Atualização em tempo real das coleções de notificações e leituras
  useRealtime('notifications', () => loadNotifications(), !!effectiveTenantId)
  useRealtime('notification_reads', () => loadNotifications(), !!user?.id)

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      await markNotificationAsRead(id, user?.id, effectiveTenantId)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setUnreadCount((c) => Math.max(0, c - 1))
      // Notifica outras partes da aplicação
      window.dispatchEvent(new CustomEvent('notificationsUpdated'))
    } catch {
      toast.error('Erro ao marcar notificação como lida.')
    }
  }

  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      await markAllNotificationsAsRead(effectiveTenantId, user?.id)
      setNotifications([])
      setUnreadCount(0)
      window.dispatchEvent(new CustomEvent('notificationsUpdated'))
      toast.success('Todas as notificações foram marcadas como lidas.')
    } catch {
      toast.error('Erro ao marcar notificações.')
    } finally {
      setLoading(false)
    }
  }

  const handleItemClick = async (item: NotificationItem) => {
    // 1. Marca como lida no clique
    await handleMarkAsRead(item.id)
    setOpen(false)

    // 2. Navegação com validação do registro destino
    const projId = item.projetoId || item.projectId
    if (projId) {
      try {
        const exists = await pb
          .collection('projects')
          .getOne(projId)
          .catch(() => null)
        if (!exists) {
          toast.info('O projeto relacionado não está mais disponível ou foi arquivado.')
          navigate('/notificacoes')
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
        navigate('/notificacoes')
      }
    } else {
      navigate('/notificacoes')
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Prazo Fatal':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
      case 'Atraso':
      case 'Gargalo':
        return <Clock className="w-3.5 h-3.5 text-amber-500" />
      case 'Mencao':
        return <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
      case 'Superadmin':
      case 'Seguranca':
        return <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
      default:
        return <Bell className="w-3.5 h-3.5 text-blue-500" />
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-gray-500 hover:text-gray-900 rounded-full h-9 w-9 focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
          title="Notificações"
          aria-label={
            unreadCount > 0
              ? `Notificações: ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
              : 'Notificações (nenhuma nova)'
          }
        >
          <Bell className="w-4 h-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white animate-in zoom-in">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-lg border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-[#1c2a3e]">Notificações</h4>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-800"
              >
                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-800 h-7 px-2"
              title="Marcar todas como lidas"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Marcar lidas
            </Button>
          )}
        </div>

        {isSuperadminWithoutTenant ? (
          <div className="py-8 px-4 text-center">
            <ShieldAlert className="w-8 h-8 mx-auto text-amber-500 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-gray-700">
              Visão Global do Superadministrador
            </p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-xs mx-auto">
              Selecione uma prefeitura no cabeçalho para ver os alertas e notificações locais.
            </p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <Bell className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-xs font-medium">Nenhuma notificação não lida</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Você está com tudo em dia!</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[340px]">
            <div className="divide-y divide-gray-50">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="p-3 hover:bg-slate-50 transition-colors cursor-pointer group flex items-start gap-3"
                >
                  <div className="mt-0.5 p-1 rounded-full bg-gray-100 shrink-0 group-hover:bg-white group-hover:shadow-xs transition-colors">
                    {getAlertIcon(item.alertType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {item.projectTitle}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {formatDate(item.createdAt, 'Hoje')}
                      </span>
                    </div>
                    {item.mensagem && (
                      <p className="text-xs text-gray-600 line-clamp-2 mt-0.5 leading-snug">
                        {item.mensagem}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-gray-200">
                        {item.alertType}
                      </Badge>
                      {item.prefeitura && (
                        <span className="text-[10px] text-gray-400 truncate">
                          {item.prefeitura}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-600 transition-opacity shrink-0"
                    onClick={(e) => handleMarkAsRead(item.id, e)}
                    title="Marcar como lida"
                    aria-label="Marcar como lida"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="p-2 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false)
              navigate('/notificacoes')
            }}
            className="w-full text-xs text-[#3b82f6] hover:text-[#2563eb] h-8 font-medium flex items-center justify-center gap-1"
          >
            Ver todas as notificações
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
