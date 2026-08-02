import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import {
  getPendingMandatoryNotifications,
  confirmNotification,
} from '@/services/notification-reads'
import type { NotificationItem } from '@/types/controle'

export function useMandatoryNotifications() {
  const { user } = useAuth()
  const [pending, setPending] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(async () => {
    if (!user?.id || !user?.tenantId) {
      setPending([])
      setLoading(false)
      return
    }
    try {
      const items = await getPendingMandatoryNotifications(user.id, user.tenantId)
      setPending(items)
    } catch {
      setPending([])
    } finally {
      setLoading(false)
    }
  }, [user?.id, user?.tenantId])

  useEffect(() => {
    load()
  }, [load])

  useRealtime('notifications', () => load(), !!user?.tenantId)
  useRealtime('notification_reads', () => load(), !!user?.id)

  const confirm = async (modoConfirmacao: string) => {
    if (!pending[0] || !user) return
    setConfirming(true)
    try {
      await confirmNotification(pending[0].id, user.id, user.tenantId, modoConfirmacao === 'video')
      await load()
    } catch {
      /* ignore */
    } finally {
      setConfirming(false)
    }
  }

  return {
    current: pending[0] || null,
    pendingCount: pending.length,
    confirming,
    confirm,
    loading,
    reload: load,
  }
}
