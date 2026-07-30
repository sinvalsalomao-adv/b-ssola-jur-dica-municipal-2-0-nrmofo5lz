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
  }
}

export const getRecentDfds = async (tenantId: string, limit = 5): Promise<DfdRecord[]> => {
  const result = await pb.collection('dfds').getList(1, limit, {
    filter: `tenant = "${tenantId}"`,
    sort: '-created',
    expand: EXPAND,
  })
  return result.items.map(normalizeDfd)
}

export const getDfd = async (id: string): Promise<DfdRecord> => {
  const record = await pb.collection('dfds').getOne(id, { expand: EXPAND })
  return normalizeDfd(record)
}

export const createDfd = async (data: Record<string, any>): Promise<DfdRecord> => {
  const record = await pb.collection('dfds').create(data, { expand: EXPAND })
  return normalizeDfd(record)
}

export const updateDfd = async (id: string, data: Record<string, any>): Promise<DfdRecord> => {
  const record = await pb.collection('dfds').update(id, data, { expand: EXPAND })
  return normalizeDfd(record)
}
