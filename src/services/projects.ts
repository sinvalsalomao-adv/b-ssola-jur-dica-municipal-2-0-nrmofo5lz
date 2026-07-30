import pb from '@/lib/pocketbase/client'
import { Project, ColumnType, Priority } from '@/types/project'

export function normalizeProject(r: any): Project {
  return {
    id: r.id,
    title: r.titulo || '',
    description: r.descricao || '',
    responsible: r.expand?.responsible_user?.name || r.responsible || '',
    responsibleUserId: r.responsible_user || '',
    deadline: r.prazo ? r.prazo.split('T')[0] : '',
    priority: (r.priority as Priority) || 'Média',
    column: (r.coluna_kanban as ColumnType) || 'Ideação',
    prefeitura: r.expand?.tenant?.name || '',
    objeto: r.objeto || '',
    justificativa: r.justificativa || '',
    createdAt: r.created || '',
    updatedAt: r.updated || '',
  }
}

export const getProjects = async (tenantId?: string): Promise<Project[]> => {
  const options: Record<string, any> = {
    expand: 'responsible_user,tenant',
    sort: '-created',
  }
  if (tenantId) {
    options.filter = `tenant = "${tenantId}"`
  }
  const records = await pb.collection('projects').getFullList(options)
  return records.map(normalizeProject)
}

export const createProject = async (data: Record<string, any>): Promise<Project> => {
  const record = await pb.collection('projects').create(data, {
    expand: 'responsible_user,tenant',
  })
  return normalizeProject(record)
}

export const updateProject = async (id: string, data: Record<string, any>): Promise<Project> => {
  const record = await pb.collection('projects').update(id, data, {
    expand: 'responsible_user,tenant',
  })
  return normalizeProject(record)
}

export const deleteProject = async (id: string): Promise<void> => {
  await pb.collection('projects').delete(id)
}

export const getTenants = async (): Promise<{ id: string; name: string }[]> => {
  const records = await pb.collection('tenants').getFullList({ sort: 'name' })
  return records.map((t) => ({ id: t.id, name: t.name }))
}

export const createAuditLog = async (data: {
  userName: string
  actionType: 'Criou card' | 'Moveu card' | 'Editou card'
  description: string
  projectTitle: string
  tenantId: string
}) => {
  try {
    await pb.collection('audit_logs').create({
      user_name: data.userName,
      action_type: data.actionType,
      description: data.description,
      project_title: data.projectTitle,
      tenant: data.tenantId,
    })
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err)
  }
}

export const getAuditLogsByProjectTitle = async (projectTitle: string, tenantId?: string) => {
  try {
    let filter = `project_title = "${projectTitle}"`
    if (tenantId) {
      filter += ` && tenant = "${tenantId}"`
    }
    const records = await pb.collection('audit_logs').getFullList({
      filter,
      sort: '-created',
    })
    return records.map((r: any) => ({
      id: r.id,
      userName: r.user_name || 'Usuário',
      actionType: r.action_type || 'Editou card',
      description: r.description || '',
      projectTitle: r.project_title || '',
      dateTime: r.created || '',
    }))
  } catch (err) {
    console.error('Erro ao buscar histórico de auditoria:', err)
    return []
  }
}
