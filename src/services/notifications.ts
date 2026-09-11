import pb from '@/lib/pocketbase/client'
import { normalizeNotification } from '@/services/controle'
import type { NotificationItem } from '@/types/controle'

function enrichNotification(r: any): NotificationItem {
  const base = normalizeNotification(r)
  return {
    ...base,
    projectId: base.projetoId,
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
  tenantId?: string,
  limit = 5,
): Promise<NotificationItem[]> => {
  const filterParts = [`lida = false`, `delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }
  const result = await pb.collection('notifications').getList(1, limit, {
    filter: filterParts.join(' && '),
    sort: '-created',
    expand: 'tenant',
  })
  return result.items.map(enrichNotification)
}

export const getNotificationsPaginated = async (
  tenantId: string | undefined,
  page: number,
  perPage: number,
  filters?: { tipo?: string; lida?: string; role?: string; targetUser?: string },
) => {
  const filterParts: string[] = []
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }
  if (filters?.role === 'servidor') {
    filterParts.push(`delivery_status = 'enviada'`)
  }
  if (filters?.tipo && filters.tipo !== 'Todos') {
    filterParts.push(`tipo = "${filters.tipo}"`)
  }
  if (filters?.lida && filters.lida !== 'Todos') {
    filterParts.push(`lida = ${filters.lida === 'true' ? 'true' : 'false'}`)
  }
  if (filters?.targetUser) {
    filterParts.push(`target_user = "${filters.targetUser}"`)
  }
  const filter = filterParts.join(' && ')
  const result = await pb.collection('notifications').getList(page, perPage, {
    filter: filter || undefined,
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

export const getUnreadNotificationsCount = async (tenantId?: string): Promise<number> => {
  const filterParts = [`lida = false`, `delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }
  const result = await pb.collection('notifications').getList(1, 1, {
    filter: filterParts.join(' && '),
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

export const markAllNotificationsAsRead = async (tenantId?: string) => {
  const filterParts = [`lida = false`, `delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }
  const records = await pb.collection('notifications').getFullList({
    filter: filterParts.join(' && '),
  })
  await Promise.all(records.map((r) => pb.collection('notifications').update(r.id, { lida: true })))
}
