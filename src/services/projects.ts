import pb from '@/lib/pocketbase/client'
import type { Project, ColumnType, Priority } from '@/types/project'

const EXPAND = 'tenant,responsible_user'

export function normalizeProject(r: any): Project {
  let cleanDeadline = ''
  if (r.prazo) {
    cleanDeadline = r.prazo.split('T')[0].split(' ')[0]
  }

  return {
    id: r.id,
    title: r.titulo || '',
    description: r.descricao || '',
    responsible: r.expand?.responsible_user?.name || '',
    responsibleUserId: r.responsible_user || '',
    deadline: cleanDeadline,
    priority: (r.priority || 'Média') as Priority,
    column: (r.coluna_kanban || 'Ideação') as ColumnType,
    prefeitura: r.expand?.tenant?.name || '',
    objeto: r.objeto || '',
    justificativa: r.justificativa || '',
    createdAt: r.created || '',
    updatedAt: r.updated || '',
  }
}

export const getProjects = async (tenantId?: string): Promise<Project[]> => {
  const filter = tenantId ? `tenant = "${tenantId}"` : ''
  const records = await pb.collection('projects').getFullList({
    sort: '-created',
    expand: EXPAND,
    filter,
  })
  return records.map(normalizeProject)
}

export const createProject = async (data: Record<string, any>) =>
  normalizeProject(await pb.collection('projects').create(data, { expand: EXPAND }))

export const updateProject = async (id: string, data: Record<string, any>) =>
  normalizeProject(await pb.collection('projects').update(id, data, { expand: EXPAND }))

export const deleteProject = async (id: string) => pb.collection('projects').delete(id)

export const getTenants = async () => {
  const records = await pb.collection('tenants').getFullList({ sort: 'name' })
  return records.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
}

export const createAuditLog = async (data: {
  action_type: string
  description: string
  project_title: string
  tenant?: string
}) =>
  pb.send('/backend/v1/audit-logs/create', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  })
