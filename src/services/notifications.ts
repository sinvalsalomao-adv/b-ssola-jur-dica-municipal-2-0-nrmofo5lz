import pb from '@/lib/pocketbase/client'
import { normalizeNotification } from '@/services/controle'
import type { NotificationItem } from '@/types/controle'

export const getUnreadNotifications = async (
  tenantId: string,
  limit = 5,
): Promise<NotificationItem[]> => {
  const result = await pb.collection('notifications').getList(1, limit, {
    filter: `tenant = "${tenantId}" && lida = false`,
    sort: '-created',
    expand: 'tenant',
  })
  return result.items.map(normalizeNotification)
}

export const getNotificationsPaginated = async (
  tenantId: string,
  page: number,
  perPage: number,
  filters?: { tipo?: string; lida?: string },
) => {
  let filter = `tenant = "${tenantId}"`
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
    items: result.items.map(normalizeNotification),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  }
}

export const markNotificationAsRead = async (id: string) =>
  pb.collection('notifications').update(id, { lida: true })

export const markAllNotificationsAsRead = async (tenantId: string) => {
  const records = await pb.collection('notifications').getFullList({
    filter: `tenant = "${tenantId}" && lida = false`,
  })
  await Promise.all(records.map((r) => pb.collection('notifications').update(r.id, { lida: true })))
}
