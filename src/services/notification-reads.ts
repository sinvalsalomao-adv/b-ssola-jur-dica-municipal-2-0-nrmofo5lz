import pb from '@/lib/pocketbase/client'
import type { NotificationItem } from '@/types/controle'

export interface NotificationReadStats {
  totalUsers: number
  readCount: number
  confirmedCount: number
  pendingCount: number
  users: Array<{ userId: string; userName: string; status: string; timestamp: string }>
}

export const getPendingMandatoryNotifications = async (
  userId: string,
  tenantId: string,
): Promise<NotificationItem[]> => {
  const mandatoryNotifs = await pb.collection('notifications').getFullList({
    filter: `tenant = "${tenantId}" && exige_confirmacao = true && delivery_status = 'enviada'`,
    sort: 'created',
  })

  let reads: any[] = []
  try {
    reads = await pb.collection('notification_reads').getFullList({ filter: `user = "${userId}"` })
  } catch {
    reads = []
  }

  const confirmedIds = new Set(reads.filter((r) => r.confirmed_at).map((r) => r.notification))

  return mandatoryNotifs
    .filter((n) => !confirmedIds.has(n.id))
    .map((n) => ({
      id: n.id,
      projectTitle: n.project_title || '',
      column: (n.column || '—') as any,
      daysIdle: n.days_stalled || 0,
      responsible: n.person_responsible || '',
      alertDate: n.alert_date || '',
      alertType: (n.tipo || 'Aviso Interno') as any,
      prefeitura: '',
      mensagem: n.mensagem || '',
      exigeConfirmacao: true,
      modoConfirmacao: (n.modo_confirmacao || 'leitura') as 'leitura' | 'video',
      videoUrl: n.video_url || '',
    }))
}

export const markNotificationRead = async (
  notificationId: string,
  userId: string,
  tenantId: string,
) => {
  const now = new Date().toISOString()
  try {
    const existing = await pb
      .collection('notification_reads')
      .getFirstListItem(`notification = "${notificationId}" && user = "${userId}"`)
    if (!existing.read_at) {
      return pb.collection('notification_reads').update(existing.id, { read_at: now })
    }
    return existing
  } catch {
    return pb.collection('notification_reads').create({
      notification: notificationId,
      user: userId,
      tenant: tenantId,
      read_at: now,
    })
  }
}

export const confirmNotification = async (
  notificationId: string,
  userId: string,
  tenantId: string,
  watched: boolean,
) => {
  const now = new Date().toISOString()
  try {
    const existing = await pb
      .collection('notification_reads')
      .getFirstListItem(`notification = "${notificationId}" && user = "${userId}"`)
    return pb.collection('notification_reads').update(existing.id, {
      confirmed_at: now,
      ...(watched ? { watched_at: now } : {}),
      ...(existing.read_at ? {} : { read_at: now }),
    })
  } catch {
    return pb.collection('notification_reads').create({
      notification: notificationId,
      user: userId,
      tenant: tenantId,
      read_at: now,
      confirmed_at: now,
      ...(watched ? { watched_at: now } : {}),
    })
  }
}

export const getNotificationReadStats = async (
  notificationId: string,
): Promise<NotificationReadStats> => {
  const notif = await pb.collection('notifications').getOne(notificationId)
  const tenantId = notif.tenant || ''

  const [reads, users] = await Promise.all([
    pb.collection('notification_reads').getFullList({
      filter: `notification = "${notificationId}"`,
      expand: 'user',
      sort: 'created',
    }),
    tenantId
      ? pb.collection('users').getFullList({ filter: `tenant = "${tenantId}" && status = 'ativo'` })
      : [],
  ])

  const readsMap = new Map(reads.map((r: any) => [r.user, r]))

  const userList = users.map((u: any) => {
    const read: any = readsMap.get(u.id)
    if (read?.watched_at)
      return {
        userId: u.id,
        userName: u.name || u.email,
        status: 'Vídeo assistido',
        timestamp: read.watched_at,
      }
    if (read?.confirmed_at)
      return {
        userId: u.id,
        userName: u.name || u.email,
        status: 'Confirmada',
        timestamp: read.confirmed_at,
      }
    if (read?.read_at)
      return { userId: u.id, userName: u.name || u.email, status: 'Lida', timestamp: read.read_at }
    return { userId: u.id, userName: u.name || u.email, status: 'Pendente', timestamp: '' }
  })

  const readCount = userList.filter((u) => u.status !== 'Pendente').length
  const confirmedCount = userList.filter(
    (u) => u.status === 'Confirmada' || u.status === 'Vídeo assistido',
  ).length
  const pendingCount = userList.filter((u) => u.status === 'Pendente').length

  return { totalUsers: users.length, readCount, confirmedCount, pendingCount, users: userList }
}
