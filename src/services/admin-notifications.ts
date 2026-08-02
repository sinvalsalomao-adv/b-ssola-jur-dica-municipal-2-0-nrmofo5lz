import pb from '@/lib/pocketbase/client'

export const createInternalNotification = async (data: {
  tenantId: string
  mensagem: string
  tipo: string
  subject?: string
  sendNow: boolean
  scheduledFor?: string
  recorrencia?: string
  diaSemana?: string
  diaMes?: number
  exigeConfirmacao?: boolean
  modoConfirmacao?: string
  videoUrl?: string
}) => {
  const today = new Date().toISOString().split('T')[0]
  const now = new Date().toISOString()
  const isScheduled = !data.sendNow && !!data.scheduledFor

  return pb.collection('notifications').create({
    tenant: data.tenantId,
    mensagem: data.mensagem,
    tipo: data.tipo,
    person_responsible: 'Todos os Servidores',
    lida: false,
    alert_date: isScheduled ? data.scheduledFor!.split('T')[0] : today,
    project_title: data.subject || 'Aviso Interno',
    column: '—',
    days_stalled: 0,
    delivery_status: isScheduled ? 'agendada' : 'enviada',
    scheduled_for: isScheduled ? data.scheduledFor : '',
    delivered_at: isScheduled ? '' : now,
    recorrencia: data.recorrencia || 'nenhuma',
    dia_semana: data.diaSemana || '',
    ...(data.diaMes ? { dia_mes: data.diaMes } : {}),
    exige_confirmacao: data.exigeConfirmacao || false,
    modo_confirmacao: data.modoConfirmacao || '',
    video_url: data.videoUrl || '',
    recorrencia_ativa: true,
  })
}

export const cancelScheduledNotification = async (id: string) =>
  pb.collection('notifications').update(id, { delivery_status: 'cancelada' })

export const cancelRecurringNotification = async (id: string) => {
  const notif = await pb.collection('notifications').getOne(id)
  const parentId = notif.parent_notification || notif.id

  await pb.collection('notifications').update(parentId, {
    recorrencia_ativa: false,
    delivery_status: 'cancelada',
  })

  if (id !== parentId) {
    await pb.collection('notifications').update(id, { delivery_status: 'cancelada' })
  }

  const children = await pb.collection('notifications').getFullList({
    filter: `parent_notification = "${parentId}" && delivery_status = 'agendada'`,
  })
  await Promise.all(
    children.map((c) =>
      pb.collection('notifications').update(c.id, { delivery_status: 'cancelada' }),
    ),
  )
}

export const getAuditLogsPaginated = async (
  tenantId: string,
  page: number,
  perPage: number,
  search?: string,
) => {
  let filter = `tenant = "${tenantId}"`
  if (search && search.trim()) {
    const s = search.trim()
    filter += ` && (user_name ~ "${s}" || action_type ~ "${s}")`
  }
  const result = await pb.collection('audit_logs').getList(page, perPage, {
    filter,
    sort: '-created',
  })
  return {
    items: result.items.map((r: any) => ({
      id: r.id,
      userName: r.user_name || '—',
      actionType: r.action_type || '',
      description: r.description || '',
      projectTitle: r.project_title || '',
      created: r.created || '',
    })),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  }
}
