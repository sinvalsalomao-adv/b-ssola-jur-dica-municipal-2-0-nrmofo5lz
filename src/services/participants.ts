import pb from '@/lib/pocketbase/client'
import { ProjectParticipant } from '@/types/project'
import { sanitizeInput } from '@/lib/sanitize'
import { createAuditLog } from '@/services/projects'

export function normalizeParticipant(r: any): ProjectParticipant {
  const userExp = r.expand?.user_id
  return {
    id: r.id,
    projectId: r.project_id || '',
    userId: r.user_id || userExp?.id || '',
    userName: userExp?.name || r.user_name || 'Usuário',
    userEmail: userExp?.email || '',
    userRole: userExp?.role || 'servidor',
    userAvatar: userExp?.avatar || null,
    tenantId: r.tenant || userExp?.tenant || '',
    addedBy: r.added_by || '',
    role: r.role || '',
    createdAt: r.created || new Date().toISOString(),
    updatedAt: r.updated || new Date().toISOString(),
  }
}

/**
 * Retorna todos os participantes de um projeto.
 */
export const getProjectParticipants = async (
  projectId: string,
  tenantId?: string,
): Promise<ProjectParticipant[]> => {
  try {
    let filter = `project_id = "${projectId}"`
    if (tenantId) {
      filter += ` && tenant = "${tenantId}"`
    }
    const records = await pb.collection('project_participants').getFullList({
      filter,
      expand: 'user_id',
      sort: 'created',
    })
    return records.map(normalizeParticipant)
  } catch (err) {
    console.error('Erro ao listar participantes:', err)
    return []
  }
}

/**
 * Retorna mapa de participantes indexado por projectId para otimizar renderização de múltiplos cards no Kanban.
 */
export const getParticipantsByTenant = async (
  tenantId?: string,
): Promise<Record<string, ProjectParticipant[]>> => {
  try {
    const options: Record<string, any> = {
      expand: 'user_id',
      sort: 'created',
    }
    if (tenantId) {
      options.filter = `tenant = "${tenantId}"`
    }
    const records = await pb.collection('project_participants').getFullList(options)
    const map: Record<string, ProjectParticipant[]> = {}
    records.forEach((r) => {
      const p = normalizeParticipant(r)
      if (!map[p.projectId]) map[p.projectId] = []
      map[p.projectId].push(p)
    })
    return map
  } catch (err) {
    console.error('Erro ao buscar mapa de participantes:', err)
    return {}
  }
}

/**
 * Adiciona um participante ao projeto garantindo que não seja duplicado,
 * pertença ao tenant do projeto e registra auditoria.
 */
export const addProjectParticipant = async (data: {
  projectId: string
  userId: string
  tenantId: string
  currentUserName: string
  projectTitle: string
  addedByUserId?: string
  role?: string
}): Promise<ProjectParticipant> => {
  if (!data.projectId || !data.userId || !data.tenantId) {
    throw new Error('Dados insuficientes para adicionar participante.')
  }

  // 1. Validar se o usuário existe, está ativo e pertence ao mesmo tenant
  const userRecord = await pb.collection('users').getOne(data.userId)
  if (!userRecord) {
    throw new Error('Usuário selecionado não foi encontrado.')
  }
  if (userRecord.status === 'inativo') {
    throw new Error('Não é possível adicionar um usuário inativo como participante.')
  }
  if (userRecord.tenant && userRecord.tenant !== data.tenantId) {
    throw new Error('Usuário não pertence à mesma Prefeitura/Tenant do projeto.')
  }

  // 2. Verificar duplicidade existente
  try {
    const existing = await pb
      .collection('project_participants')
      .getFirstListItem(`project_id = "${data.projectId}" && user_id = "${data.userId}"`)
    if (existing) {
      throw new Error('Este usuário já é participante deste projeto.')
    }
  } catch (e: any) {
    if (e?.status !== 404 && e?.message === 'Este usuário já é participante deste projeto.') {
      throw e
    }
  }

  // 3. Inserir participante
  const payload = {
    project_id: data.projectId,
    user_id: data.userId,
    tenant: data.tenantId,
    added_by: data.addedByUserId || null,
    role: sanitizeInput(data.role || ''),
  }

  const record = await pb.collection('project_participants').create(payload, {
    expand: 'user_id',
  })

  // 4. Gravar auditoria
  await createAuditLog({
    userName: data.currentUserName || 'Usuário',
    actionType: 'Adicionou participante',
    description: `Adicionou o participante ${userRecord.name || userRecord.email} ao projeto`,
    projectTitle: data.projectTitle,
    tenantId: data.tenantId,
  })

  return normalizeParticipant(record)
}

/**
 * Remove um participante e grava auditoria
 */
export const removeProjectParticipant = async (data: {
  participantId: string
  projectId: string
  participantName: string
  tenantId: string
  currentUserName: string
  projectTitle: string
}): Promise<void> => {
  await pb.collection('project_participants').delete(data.participantId)

  await createAuditLog({
    userName: data.currentUserName || 'Usuário',
    actionType: 'Removeu participante',
    description: `Removeu o participante ${data.participantName} do projeto`,
    projectTitle: data.projectTitle,
    tenantId: data.tenantId,
  })
}
