import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getUnreadNotifications, markNotificationAsRead } from '@/services/notifications'
import type { NotificationItem } from '@/types/controle'

export function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])

  const loadNotifications = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const data = await getUnreadNotifications(user.tenantId, 5)
      setNotifications(data)
    } catch {
      /* ignore */
    }
  }, [user?.tenantId])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useRealtime(
    'notifications',
    () => {
      loadNotifications()
    },
    !!user?.tenantId,
  )

  const handleClick = async (n: NotificationItem) => {
    try {
      await markNotificationAsRead(n.id, user?.id, user?.tenantId)
    } catch {
      /* ignore */
    }
    loadNotifications()

    if (n.projetoId) {
      navigate('/bussola')
      const targetTab = n.alertType === 'Mencao' ? 'comments' : 'details'
      // Disparar evento para abrir projeto e aba correta
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('openProjectById', {
            detail: { projectId: n.projetoId, tab: targetTab },
          }),
        )
      }, 150)
    } else {
      navigate('/bussola')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-700 relative">
          <Bell className="w-5 h-5" />
          {notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs font-semibold text-gray-500">
          Notificações ({notifications.length} não lidas)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-gray-400">
            Nenhuma notificação nova
          </div>
        ) : (
          notifications.map((n) => {
            const isFatal = n.alertType === 'Prazo Fatal'
            const isMention = n.alertType === 'Mencao'
            return (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex flex-col items-start gap-1 py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  {isMention ? (
                    <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                      @
                    </span>
                  ) : isFatal ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-[#1c2a3e] truncate flex-1">
                    {n.projectTitle}
                  </span>
                  <Badge
                    className={`text-[9px] px-1.5 py-0 ${
                      isMention
                        ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : isFatal
                          ? 'bg-red-100 text-red-700 border-red-200'
                          : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isMention ? 'Menção' : n.alertType}
                  </Badge>
                </div>
                {n.mensagem && (
                  <p className="text-xs text-gray-500 line-clamp-2 pl-5">{n.mensagem}</p>
                )}
              </DropdownMenuItem>
            )
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/notificacoes')}
          className="text-xs text-center justify-center text-[#3b82f6] font-medium cursor-pointer"
        >
          Ver todas
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
