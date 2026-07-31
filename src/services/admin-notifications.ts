import pb from '@/lib/pocketbase/client'

export const createInternalNotification = async (data: {
  tenantId: string
  mensagem: string
  tipo: string
  subject?: string
}) => {
  const today = new Date().toISOString().split('T')[0]
  return pb.collection('notifications').create({
    tenant: data.tenantId,
    mensagem: data.mensagem,
    tipo: data.tipo,
    person_responsible: 'Todos os Servidores',
    lida: false,
    alert_date: today,
    project_title: data.subject || 'Aviso Interno',
    column: '—',
    days_stalled: 0,
  })
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
