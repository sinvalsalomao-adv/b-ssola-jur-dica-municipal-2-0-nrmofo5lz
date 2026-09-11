import pb from '@/lib/pocketbase/client'
import { normalizeNotification } from '@/services/controle'
import type { NotificationItem } from '@/types/controle'

function enrichNotification(
  r: any,
  userReadsMap?: Map<string, { read_at?: string; confirmed_at?: string }>,
  hasUserContext = false,
): NotificationItem {
  const base = normalizeNotification(r)
  const userRead = userReadsMap?.get(r.id)
  // D-1: Quando houver contexto de usuário, o status de lida é estritamente individual baseado em notification_reads.
  // Somente se não houver contexto de usuário (ex.: consultas puramente anônimas/globais de sistema) recorre a r.lida.
  const isRead = hasUserContext ? Boolean(userRead?.read_at) : Boolean(userRead?.read_at || r.lida)

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

  // D-1 / D-2: Buscar registros respeitando paginação progressiva para encontrar não lidas
  const fetchBatchSize = Math.max(limit * 5, 50)
  let page = 1
  const unreadItems: NotificationItem[] = []
  let totalPages = 1

  do {
    const result = await pb.collection('notifications').getList(page, fetchBatchSize, {
      filter: filterParts.join(' && '),
      sort: '-created',
      expand: 'tenant,projeto_id',
    })

    totalPages = result.totalPages
    const enriched = result.items.map((r) => enrichNotification(r, userReadsMap, Boolean(userId)))
    for (const item of enriched) {
      if (!item.lida) {
        unreadItems.push(item)
        if (unreadItems.length >= limit) break
      }
    }

    if (unreadItems.length >= limit || page >= totalPages) break
    page++
  } while (page <= totalPages && unreadItems.length < limit)

  return unreadItems.slice(0, limit)
}

/**
 * Contagem consistente de não lidas para o badge do sino e dashboard (D-2b).
 * Garante contagem confiável de TODAS as notificações entregues do tenant,
 * sem subestimar pelo teto de 100 itens.
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
    const [userReadsMap, allNotifs] = await Promise.all([
      getUserReadsMap(userId),
      pb.collection('notifications').getFullList({
        filter: filterParts.join(' && '),
        fields: 'id',
      }),
    ])

    // D-1: lida = existe registro com read_at em notification_reads para o usuário
    const unreadCount = allNotifs.filter((r) => {
      const uRead = userReadsMap.get(r.id)
      return !uRead?.read_at
    }).length

    return unreadCount
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
  const hasUser = Boolean(currentUserId)
  const filter = filterParts.join(' && ')

  // D-1 / D-2: Se houver filtro de leitura (lida === 'true' ou 'false') e contexto de usuário,
  // a definição de leitura é puramente individual (notification_reads).
  // Para manter a paginação exata e totalItems correspondendo à contagem do sino:
  if (filters?.lida && filters.lida !== 'Todos' && hasUser) {
    const wantRead = filters.lida === 'true'
    const allRecords = await pb.collection('notifications').getFullList({
      filter: filter || undefined,
      sort: '-created',
      expand: 'tenant,projeto_id',
    })

    const enrichedAll = allRecords
      .map((r) => enrichNotification(r, userReadsMap, hasUser))
      .filter((item) => (wantRead ? item.lida : !item.lida))

    const totalItems = enrichedAll.length
    const totalPages = Math.ceil(totalItems / perPage) || 1
    const offset = (page - 1) * perPage
    const items = enrichedAll.slice(offset, offset + perPage)

    return {
      items,
      page,
      perPage,
      totalItems,
      totalPages,
    }
  }

  const result = await pb.collection('notifications').getList(page, perPage, {
    filter: filter || undefined,
    sort: '-created',
    expand: 'tenant,projeto_id',
  })

  let enrichedItems = result.items.map((r) => enrichNotification(r, userReadsMap, hasUser))

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

  // D-1 & D-3: A leitura deve ser registrada APENAS na coleção individual notification_reads (por usuário),
  // e NUNCA mutar o campo global `lida` da notificação em `notifications`.
  // Valida que a notificação referenciada pertence ao mesmo tenant do usuário antes de criar o registro de leitura (D-3).
  if (!userId) {
    return null
  }

  try {
    // 1. Obter a notificação para validar existência e pertencimento ao tenant
    const notif = await pb.collection('notifications').getOne(id)
    if (!notif || !notif.tenant) {
      return null
    }

    // Se tenantId foi informado pelo chamador (contexto do usuário logado),
    // validar estritamente que a notificação pertence ao mesmo tenant (D-3)
    if (tenantId && tenantId !== 'all' && notif.tenant !== tenantId) {
      // Rejeitar registro cruzado de leitura entre tenants
      return null
    }

    const effectiveTenant = notif.tenant

    const existing = await pb
      .collection('notification_reads')
      .getFirstListItem(`notification = "${id}" && user = "${userId}"`)
      .catch(() => null)

    if (existing) {
      // Validar também que o registro existente coincide com o tenant da notificação
      if (existing.tenant && existing.tenant !== effectiveTenant) {
        return null
      }
      if (!existing.read_at) {
        return await pb.collection('notification_reads').update(existing.id, { read_at: now })
      }
      return existing
    }

    return await pb.collection('notification_reads').create({
      notification: id,
      user: userId,
      tenant: effectiveTenant,
      read_at: now,
    })
  } catch {
    return null
  }
}

/**
 * Marca todas as notificações como lidas para o usuário atual (D-2a):
 * Cria registros individuais em notification_reads para o usuário atual apenas,
 * sem tocar no campo global `lida` de `notifications`.
 */
export const markAllNotificationsAsRead = async (tenantId?: string, userId?: string) => {
  if (!userId) return

  const filterParts = [`delivery_status = 'enviada'`]
  if (tenantId && tenantId !== 'all') {
    filterParts.push(`tenant = "${tenantId}"`)
  }

  // Buscar todas as notificações do escopo com id e tenant
  const records = await pb.collection('notifications').getFullList({
    filter: filterParts.join(' && '),
    fields: 'id,tenant',
  })

  const now = new Date().toISOString()

  // Carregar leituras já existentes do usuário para evitar chamadas duplicadas
  const existingReadsMap = await getUserReadsMap(userId)

  // Criar/atualizar leituras individuais em lotes controlados
  const BATCH_SIZE = 25
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE)
    await Promise.all(
      chunk.map(async (r) => {
        // D-3: Garantir que a notificação tem tenant e coincide com tenantId se fornecido
        if (!r.tenant) return
        if (tenantId && tenantId !== 'all' && r.tenant !== tenantId) return

        const existing = existingReadsMap.get(r.id)
        if (existing?.read_at) {
          // Já marcada como lida pelo usuário
          return
        }

        try {
          // Verificar se já existe registro em notification_reads
          const rec = await pb
            .collection('notification_reads')
            .getFirstListItem(`notification = "${r.id}" && user = "${userId}"`)
            .catch(() => null)

          if (!rec) {
            await pb.collection('notification_reads').create({
              notification: r.id,
              user: userId,
              tenant: r.tenant,
              read_at: now,
            })
          } else if (!rec.read_at) {
            await pb.collection('notification_reads').update(rec.id, { read_at: now })
          }
        } catch {
          // Silencioso por registro
        }
      }),
    )
  }
}
