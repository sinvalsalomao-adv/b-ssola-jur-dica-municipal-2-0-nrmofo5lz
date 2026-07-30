import pb from '@/lib/pocketbase/client'
import type { Project, ColumnType, Priority } from '@/types/project'

export function normalizeProject(r: any): Project {
  return {
    id: r.id,
    title: r.title || '',
    description: r.description || '',
    responsible: r.responsible || '',
    deadline: r.deadline || '',
    priority: (r.priority || 'Média') as Priority,
    column: (r.column || 'Ideação') as ColumnType,
    prefeitura: r.expand?.tenant?.name || '',
    createdAt: r.created || '',
    updatedAt: r.updated || '',
  }
}

export const getProjects = async (tenantId?: string): Promise<Project[]> => {
  const filter = tenantId ? `tenant = "${tenantId}"` : ''
  const records = await pb.collection('projects').getFullList({
    sort: '-created',
    expand: 'tenant',
    filter,
  })
  return records.map(normalizeProject)
}

export const createProject = async (data: Record<string, any>) =>
  normalizeProject(await pb.collection('projects').create(data, { expand: 'tenant' }))

export const updateProject = async (id: string, data: Record<string, any>) =>
  normalizeProject(await pb.collection('projects').update(id, data, { expand: 'tenant' }))

export const deleteProject = async (id: string) => pb.collection('projects').delete(id)

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
