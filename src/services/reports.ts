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

export const getUsersByRole = async (tenantId: string): Promise<Record<string, number>> => {
  try {
    const memberships = await pb.collection('user_memberships').getFullList({
      filter: `tenant = "${tenantId}" && status = "ativo"`,
    })
    if (memberships.length > 0) {
      const counts: Record<string, number> = {}
      memberships.forEach((m: any) => {
        const role = m.role || 'servidor'
        counts[role] = (counts[role] || 0) + 1
      })
      return counts
    }
  } catch {
    /* intentionally ignored */
  }

  const records = await pb.collection('users').getFullList({
    filter: `tenant = "${tenantId}" && status = "ativo"`,
  })
  const counts: Record<string, number> = {}
  records.forEach((r) => {
    const role = r.role || 'servidor'
    counts[role] = (counts[role] || 0) + 1
  })
  return counts
}

export const getProjectsByColumnForTenant = async (
  tenantId: string,
): Promise<Record<string, number>> => {
  const records = await pb.collection('projects').getFullList({
    filter: `tenant = "${tenantId}"`,
  })
  const counts: Record<string, number> = {}
  records.forEach((r) => {
    const col = r.coluna_kanban || 'Ideação'
    counts[col] = (counts[col] || 0) + 1
  })
  return counts
}

export const getStalledItems = async (tenantId: string) => {
  const records = await pb.collection('notifications').getFullList({
    filter: `tenant = "${tenantId}" && tipo = "Gargalo"`,
    sort: '-days_stalled',
  })
  return records.map((r) => ({
    id: r.id,
    projectTitle: r.project_title || '',
    column: r.column || '',
    daysStalled: r.days_stalled || 0,
    responsible: r.person_responsible || '',
  }))
}

export const getRecentAuditLogsForTenant = async (tenantId: string, limit = 20) => {
  const records = await pb.collection('audit_logs').getFullList({
    filter: `tenant = "${tenantId}"`,
    sort: '-created',
  })
  return records.slice(0, limit).map((r) => ({
    id: r.id,
    userName: r.user_name || '',
    actionType: r.action_type || '',
    description: r.description || '',
    projectTitle: r.project_title || '',
    created: r.created || '',
  }))
}

export const getNotificationsSummary = async (tenantId: string) => {
  const records = await pb.collection('notifications').getFullList({
    filter: `tenant = "${tenantId}"`,
  })
  const total = records.length
  const unread = records.filter((r) => !r.lida).length
  const read = total - unread
  const gargalo = records.filter((r) => r.tipo === 'Gargalo').length
  const prazoFatal = records.filter((r) => r.tipo === 'Prazo Fatal').length
  return { total, unread, read, gargalo, prazoFatal }
}
