import pb from '@/lib/pocketbase/client'
import type { DfdRecord } from '@/types/dfd'

const EXPAND = 'responsible_user,projeto_id,tenant'

export function normalizeDfd(r: any): DfdRecord {
  return {
    id: r.id,
    title: r.titulo || '',
    objeto: r.objeto || '',
    descricao: r.descricao || '',
    justificativa: r.justificativa || '',
    responsible: r.expand?.responsible_user?.name || '',
    responsibleUserId: r.responsible_user || '',
    deadline: r.prazo || '',
    status: (r.status || 'Rascunho') as 'Rascunho' | 'Finalizado',
    createdAt: r.created || '',
    projetoId: r.projeto_id || '',
    projectColumn: r.expand?.projeto_id?.coluna_kanban || '',
    projectPriority: r.expand?.projeto_id?.priority || '',
    projectDeadline: r.expand?.projeto_id?.prazo || '',
    tenantId: r.tenant || '',
  }
}

async function resolveFallbackTenant(tenantId?: string): Promise<string> {
  if (tenantId && tenantId.trim() !== '') return tenantId

  if (pb.authStore.record?.tenant) {
    return pb.authStore.record.tenant
  }

  try {
    const firstTenant = await pb.collection('tenants').getFirstListItem('', { requestKey: null })
    if (firstTenant?.id) return firstTenant.id
  } catch {
    // ignore
  }

  return ''
}

export const getRecentDfds = async (tenantId?: string, limit = 5): Promise<DfdRecord[]> => {
  const options: Record<string, any> = {
    sort: '-created',
    expand: EXPAND,
  }
  if (tenantId && tenantId.trim() !== '') {
    options.filter = `tenant = "${tenantId}"`
  }
  const result = await pb.collection('dfds').getList(1, limit, options)
  return result.items.map(normalizeDfd)
}

export const getDfd = async (id: string): Promise<DfdRecord> => {
  const record = await pb.collection('dfds').getOne(id, { expand: EXPAND })
  return normalizeDfd(record)
}

export const createDfd = async (data: Record<string, any>): Promise<DfdRecord> => {
  const payload: Record<string, any> = { ...data }

  // Ensure tenant is populated
  if (!payload.tenant || String(payload.tenant).trim() === '') {
    const resolvedTenant = await resolveFallbackTenant()
    if (resolvedTenant) {
      payload.tenant = resolvedTenant
    }
  }

  // Ensure responsible_user is handled properly
  if (
    !payload.responsible_user ||
    payload.responsible_user === 'none' ||
    String(payload.responsible_user).trim() === ''
  ) {
    if (pb.authStore.record?.id) {
      payload.responsible_user = pb.authStore.record.id
    } else {
      delete payload.responsible_user
    }
  }

  const record = await pb.collection('dfds').create(payload, { expand: EXPAND })
  return normalizeDfd(record)
}

export const updateDfd = async (id: string, data: Record<string, any>): Promise<DfdRecord> => {
  const payload: Record<string, any> = { ...data }
  if (payload.responsible_user === '' || payload.responsible_user === 'none') {
    payload.responsible_user = null
  }
  const record = await pb.collection('dfds').update(id, payload, { expand: EXPAND })
  return normalizeDfd(record)
}
