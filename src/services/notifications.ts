import pb from '@/lib/pocketbase/client'
import { normalizeNotification } from '@/services/controle'
import type { NotificationItem } from '@/types/controle'

function enrichNotification(r: any): NotificationItem {
  return {
    ...normalizeNotification(r),
    deliveryStatus: r.delivery_status || 'enviada',
    scheduledFor: r.scheduled_for || '',
    deliveredAt: r.delivered_at || '',
    recorrencia: r.recorrencia || 'nenhuma',
    diaSemana: r.dia_semana || '',
    diaMes: r.dia_mes || 0,
    exigeConfirmacao: r.exige_confirmacao || false,
    modoConfirmacao: r.modo_confirmacao || '',
    videoUrl: r.video_url || '',
    parentNotification: r.parent_notification || '',
    recorrenciaAtiva: r.recorrencia_ativa ?? true,
    targetUserId: r.target_user || '',
  }
}

export const getUnreadNotifications = async (
  tenantId: string,
  limit = 5,
): Promise<NotificationItem[]> => {
  const result = await pb.collection('notifications').getList(1, limit, {
    filter: `tenant = "${tenantId}" && lida = false && delivery_status = 'enviada'`,
    sort: '-created',
    expand: 'tenant',
  })
  return result.items.map(enrichNotification)
}

export const getNotificationsPaginated = async (
  tenantId: string,
  page: number,
  perPage: number,
  filters?: { tipo?: string; lida?: string; role?: string },
) => {
  let filter = `tenant = "${tenantId}"`
  if (filters?.role === 'servidor') {
    filter += ` && delivery_status = 'enviada'`
  }
  if (filters?.tipo && filters.tipo !== 'Todos') {
    filter += ` && tipo = "${filters.tipo}"`
  }
  if (filters?.lida && filters.lida !== 'Todos') {
    filter += ` && lida = ${filters.lida === 'true' ? 'true' : 'false'}`
  }
  const result = await pb.collection('notifications').getList(page, perPage, {
    filter,
    sort: '-created',
    expand: 'tenant',
  })
  return {
    items: result.items.map(enrichNotification),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  }
}

export const getUnreadNotificationsCount = async (tenantId: string): Promise<number> => {
  const result = await pb.collection('notifications').getList(1, 1, {
    filter: `tenant = "${tenantId}" && lida = false && delivery_status = 'enviada'`,
  })
  return result.totalItems
}

export const markNotificationAsRead = async (id: string, userId?: string, tenantId?: string) => {
  if (userId && tenantId) {
    try {
      const now = new Date().toISOString()
      try {
        const existing = await pb
          .collection('notification_reads')
          .getFirstListItem(`notification = "${id}" && user = "${userId}"`)
        if (!existing.read_at) {
          await pb.collection('notification_reads').update(existing.id, { read_at: now })
        }
      } catch {
        await pb.collection('notification_reads').create({
          notification: id,
          user: userId,
          tenant: tenantId,
          read_at: now,
        })
      }
    } catch {
      /* ignore */
    }
  }
  return pb.collection('notifications').update(id, { lida: true })
}

export const markAllNotificationsAsRead = async (tenantId: string) => {
  const records = await pb.collection('notifications').getFullList({
    filter: `tenant = "${tenantId}" && lida = false && delivery_status = 'enviada'`,
  })
  await Promise.all(records.map((r) => pb.collection('notifications').update(r.id, { lida: true })))
}
