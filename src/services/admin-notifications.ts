import pb from '@/lib/pocketbase/client'

export const createInternalNotification = async (data: {
  tenantId: string
  mensagem: string
  tipo: string
}) => {
  const today = new Date().toISOString().split('T')[0]
  return pb.collection('notifications').create({
    tenant: data.tenantId,
    mensagem: data.mensagem,
    tipo: data.tipo,
    person_responsible: 'Todos os Servidores',
    lida: false,
    alert_date: today,
    project_title: 'Aviso Interno',
    column: '—',
    days_stalled: 0,
  })
}

export const getAuditLogsPaginated = async (tenantId: string, page: number, perPage: number) => {
  const result = await pb.collection('audit_logs').getList(page, perPage, {
    filter: `tenant = "${tenantId}"`,
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
