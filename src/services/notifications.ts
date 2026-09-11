import pb from '@/lib/pocketbase/client'
import { normalizeNotification } from '@/services/controle'
import type { NotificationItem } from '@/types/controle'

function enrichNotification(
  r: any,
  userReadsMap?: Map<string, { read_at?: string; confirmed_at?: string }>,
): NotificationItem {
  const base = normalizeNotification(r)
  const userRead = userReadsMap?.get(r.id)
  const isRead = userRead?.read_at ? true : r.lida || false

  return {
    ...base,
    lida: isRead,
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

/**
 * Carrega o mapa de leitura do usuário atual a partir de `notification_reads`.
 */
async function getUserReadsMap(
  userId?: string,
): Promise<Map<string, { read_at?: string; confirmed_at?: string }>> {
  if (!userId) return new Map()
  try {
    const records = await pb.collection('notification_reads').getFullList({
      filter: `user = "${userId}"`,
    })
    const map = new Map<string, { read_at?: string; confirmed_at?: string }>()
    for (const rec of records) {
      if (rec.notification) {
        map.set(rec.notification, {
          read_at: rec.read_at,
          confirmed_at: rec.confirmed_at,
        })
      }
    }
    return map
  } catch {
    return new Map()
  }
}

/**
 * Retorna as notificações não lidas para o sino ou badges.
 * Filtra por tenant e considera se o usuário já marcou como lida individualmente.
 */
export const getUnreadNotifications = async (
  tenantId?: string,
  limit = 5,
  userId?: string,
): Promise<NotificationItem[]> => {
  const filterParts = [`delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }

  // Se tivermos userId, precisamos trazer registros e filtrar os que o usuário não leu
  const userReadsMap = await getUserReadsMap(userId)

  // Para garantir desempenho, buscamos as notificações mais recentes
  const result = await pb.collection('notifications').getList(1, Math.max(limit * 3, 20), {
    filter: filterParts.join(' && '),
    sort: '-created',
    expand: 'tenant,projeto_id',
  })

  const enriched = result.items.map((r) => enrichNotification(r, userReadsMap))
  // Filtra as que não foram lidas
  const unreadOnly = enriched.filter((n) => !n.lida)
  return unreadOnly.slice(0, limit)
}

/**
 * Contagem consistente de não lidas para o badge do sino e dashboard
 */
export const getUnreadNotificationsCount = async (
  tenantId?: string,
  userId?: string,
): Promise<number> => {
  const filterParts = [`delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }

  if (userId) {
    const userReadsMap = await getUserReadsMap(userId)
    const result = await pb.collection('notifications').getList(1, 100, {
      filter: filterParts.join(' && '),
      sort: '-created',
    })
    const unread = result.items.filter((r) => {
      const uRead = userReadsMap.get(r.id)
      return !(uRead?.read_at || r.lida)
    })
    return unread.length
  }

  const unreadFilter = [...filterParts, `lida = false`].join(' && ')
  const result = await pb.collection('notifications').getList(1, 1, {
    filter: unreadFilter,
  })
  return result.totalItems
}

export interface NotificationFilterParams {
  tipo?: string
  lida?: string
  periodo?: 'todos' | '7dias' | '30dias' | 'hoje'
  targetUser?: string
  role?: string
}

/**
 * Consulta paginada com suporte completo a filtros: status de leitura, tipo, período e destinatário
 */
export const getNotificationsPaginated = async (
  tenantId: string | undefined,
  page: number,
  perPage: number,
  filters?: NotificationFilterParams,
  currentUserId?: string,
) => {
  const filterParts: string[] = []

  // Isolamento de tenant (se não for superadmin 'all')
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }

  // Regra padrão de entrega
  filterParts.push(`delivery_status = 'enviada'`)

  // Filtro por tipo
  if (filters?.tipo && filters.tipo !== 'Todos') {
    filterParts.push(`tipo = "${filters.tipo}"`)
  }

  // Filtro por destinatário direto
  if (filters?.targetUser) {
    filterParts.push(`target_user = "${filters.targetUser}"`)
  }

  // Filtro por período
  if (filters?.periodo && filters.periodo !== 'todos') {
    const now = new Date()
    if (filters.periodo === 'hoje') {
      const todayStr = now.toISOString().split('T')[0]
      filterParts.push(`created >= "${todayStr} 00:00:00"`)
    } else if (filters.periodo === '7dias') {
      const past7 = new Date(now.getTime() - 7 * 86400000)
      filterParts.push(`created >= "${past7.toISOString()}"`)
    } else if (filters.periodo === '30dias') {
      const past30 = new Date(now.getTime() - 30 * 86400000)
      filterParts.push(`created >= "${past30.toISOString()}"`)
    }
  }

  // Obter mapa de leitura individual
  const userReadsMap = await getUserReadsMap(currentUserId)

  // Se o filtro de leitura for direto e não usarmos notification_reads por usuário,
  // ou se aplicarmos na listagem:
  const filter = filterParts.join(' && ')
  const result = await pb.collection('notifications').getList(page, perPage, {
    filter: filter || undefined,
    sort: '-created',
    expand: 'tenant,projeto_id',
  })

  let enrichedItems = result.items.map((r) => enrichNotification(r, userReadsMap))

  // Filtro em memória para consistência de leitura por usuário
  if (filters?.lida && filters.lida !== 'Todos') {
    const wantRead = filters.lida === 'true'
    enrichedItems = enrichedItems.filter((item) => (wantRead ? item.lida : !item.lida))
  }

  return {
    items: enrichedItems,
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  }
}

/**
 * Marca uma notificação como lida de forma persistente:
 * Grava na coleção `notification_reads` para o usuário e atualiza a flag do registro.
 */
export const markNotificationAsRead = async (id: string, userId?: string, tenantId?: string) => {
  const now = new Date().toISOString()

  // 1. Persistência individual em notification_reads
  if (userId) {
    try {
      let effectiveTenant = tenantId
      if (!effectiveTenant) {
        const notif = await pb.collection('notifications').getOne(id)
        effectiveTenant = notif.tenant
      }

      const existing = await pb
        .collection('notification_reads')
        .getFirstListItem(`notification = "${id}" && user = "${userId}"`)
        .catch(() => null)

      if (existing) {
        if (!existing.read_at) {
          await pb.collection('notification_reads').update(existing.id, { read_at: now })
        }
      } else if (effectiveTenant) {
        await pb.collection('notification_reads').create({
          notification: id,
          user: userId,
          tenant: effectiveTenant,
          read_at: now,
        })
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Atualizar campo `lida` do registro principal para manter sincronia
  try {
    return await pb.collection('notifications').update(id, { lida: true })
  } catch {
    return null
  }
}

/**
 * Marca todas as notificações como lidas para o contexto atual
 */
export const markAllNotificationsAsRead = async (tenantId?: string, userId?: string) => {
  const filterParts = [`delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }

  const records = await pb.collection('notifications').getFullList({
    filter: filterParts.join(' && '),
  })

  const now = new Date().toISOString()
  await Promise.all(
    records.map(async (r) => {
      if (userId && r.tenant) {
        try {
          const existing = await pb
            .collection('notification_reads')
            .getFirstListItem(`notification = "${r.id}" && user = "${userId}"`)
            .catch(() => null)
          if (!existing) {
            await pb.collection('notification_reads').create({
              notification: r.id,
              user: userId,
              tenant: r.tenant,
              read_at: now,
            })
          } else if (!existing.read_at) {
            await pb.collection('notification_reads').update(existing.id, { read_at: now })
          }
        } catch {
          // ignore
        }
      }
      return pb
        .collection('notifications')
        .update(r.id, { lida: true })
        .catch(() => null)
    }),
  )
}
