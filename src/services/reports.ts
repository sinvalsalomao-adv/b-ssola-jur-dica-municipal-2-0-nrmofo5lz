import pb from '@/lib/pocketbase/client'
import { normalizeProject } from '@/services/projects'
import { normalizeDfd } from '@/services/dfds'
import type { Project } from '@/types/project'
import type { DfdRecord } from '@/types/dfd'

export const getAllProjects = async (): Promise<Project[]> => {
  const records = await pb.collection('projects').getFullList({
    sort: '-created',
    expand: 'tenant,responsible_user',
  })
  return records.map(normalizeProject)
}

export const getAllDfds = async (): Promise<DfdRecord[]> => {
  const records = await pb.collection('dfds').getFullList({
    sort: '-created',
    expand: 'responsible_user,projeto_id,tenant',
  })
  return records.map(normalizeDfd)
}

export const getAllTenantsForReports = async () => {
  const records = await pb.collection('tenants').getFullList({ sort: 'name' })
  return records.map((r) => ({ id: r.id, name: r.name, slug: r.slug }))
}
