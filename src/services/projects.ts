import pb from '@/lib/pocketbase/client'
import { Project, ColumnType, Priority } from '@/types/project'
import { sanitizeInput } from '@/lib/sanitize'
import { normalizeDateForInput } from '@/lib/dateUtils'

export function normalizeProject(r: any): Project {
  if (!r || typeof r !== 'object') {
    return {
      id: '',
      title: 'Projeto Sem Título',
      description: '',
      responsible: 'Não atribuído',
      responsibleUserId: '',
      deadline: '',
      priority: 'Média',
      column: 'Ideação',
      prefeitura: '',
      objeto: '',
      justificativa: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  const rawDeadline = r.prazo || r.deadline || ''
  const formattedDeadline = normalizeDateForInput(rawDeadline)

  return {
    id: r.id || '',
    title: r.titulo || r.title || 'Projeto Sem Título',
    description: r.descricao || r.description || '',
    responsible: r.expand?.responsible_user?.name || r.responsible || 'Não atribuído',
    responsibleUserId: r.responsible_user || r.responsibleUserId || '',
    deadline: formattedDeadline,
    priority: (r.priority as Priority) || 'Média',
    column: (r.coluna_kanban as ColumnType) || (r.column as ColumnType) || 'Ideação',
    prefeitura: r.expand?.tenant?.name || r.prefeitura || '',
    objeto: r.objeto || '',
    justificativa: r.justificativa || '',
    tenantId: r.tenant || r.expand?.tenant?.id || '',
    createdAt: r.created || r.createdAt || new Date().toISOString(),
    updatedAt: r.updated || r.updatedAt || new Date().toISOString(),
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
  const payload: Record<string, any> = { ...data }
  if (payload.title !== undefined) payload.title = sanitizeInput(payload.title)
  if (payload.titulo !== undefined) payload.titulo = sanitizeInput(payload.titulo)
  if (payload.description !== undefined) payload.description = sanitizeInput(payload.description)
  if (payload.descricao !== undefined) payload.descricao = sanitizeInput(payload.descricao)
  if (payload.objeto !== undefined) payload.objeto = sanitizeInput(payload.objeto)
  if (payload.justificativa !== undefined)
    payload.justificativa = sanitizeInput(payload.justificativa)

  if (
    !payload.responsible_user ||
    payload.responsible_user === 'none' ||
    String(payload.responsible_user).trim() === ''
  ) {
    delete payload.responsible_user
  }
  const record = await pb.collection('projects').create(payload, {
    expand: 'responsible_user,tenant',
  })
  return normalizeProject(record)
}

export const updateProject = async (id: string, data: Record<string, any>): Promise<Project> => {
  const payload: Record<string, any> = { ...data }
  if (payload.title !== undefined) payload.title = sanitizeInput(payload.title)
  if (payload.titulo !== undefined) payload.titulo = sanitizeInput(payload.titulo)
  if (payload.description !== undefined) payload.description = sanitizeInput(payload.description)
  if (payload.descricao !== undefined) payload.descricao = sanitizeInput(payload.descricao)
  if (payload.objeto !== undefined) payload.objeto = sanitizeInput(payload.objeto)
  if (payload.justificativa !== undefined)
    payload.justificativa = sanitizeInput(payload.justificativa)

  if (payload.responsible_user === '' || payload.responsible_user === 'none') {
    payload.responsible_user = null
  }
  const record = await pb.collection('projects').update(id, payload, {
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
  actionType:
    | 'Criou card'
    | 'Moveu card'
    | 'Editou card'
    | 'Adicionou documento'
    | 'Nova versão documento'
    | 'Arquivou documento'
    | 'Restaurou documento'
    | 'Visualizou documento'
    | 'Baixou documento'
    | 'Adicionou participante'
    | 'Removeu participante'
    | 'Criou comentário'
    | 'Editou comentário'
    | 'Removeu comentário'
    | 'Criou resposta'
    | 'Editou resposta'
    | 'Removeu resposta'
    | 'Mencionou usuário'
    | string
  description: string
  projectTitle: string
  tenantId: string
}) => {
  try {
    if (!data.tenantId) return
    await pb.collection('audit_logs').create({
      user_name: data.userName || 'Usuário',
      action_type: data.actionType,
      description: data.description || '',
      project_title: data.projectTitle || '',
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
    let records = await pb.collection('audit_logs').getFullList({
      filter,
      sort: '-created',
    })
    if (records.length === 0 && tenantId) {
      records = await pb.collection('audit_logs').getFullList({
        filter: `project_title = "${projectTitle}"`,
        sort: '-created',
      })
    }
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

export const getAllAuditLogs = async (tenantId?: string) => {
  try {
    const options: Record<string, any> = { sort: '-created' }
    if (tenantId) {
      options.filter = `tenant = "${tenantId}"`
    }
    const records = await pb.collection('audit_logs').getFullList(options)
    return records.map((r: any) => ({
      id: r.id,
      userName: r.user_name || 'Usuário',
      actionType: r.action_type || 'Editou card',
      description: r.description || '',
      projectTitle: r.project_title || '',
      dateTime: r.created || '',
    }))
  } catch (err) {
    console.error('Erro ao buscar logs de auditoria:', err)
    return []
  }
}
