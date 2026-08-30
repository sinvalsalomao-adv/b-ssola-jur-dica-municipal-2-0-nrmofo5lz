import pb from '@/lib/pocketbase/client'
import { ProjectComment, CommentMention } from '@/types/project'
import { sanitizeInput } from '@/lib/sanitize'
import { createAuditLog } from '@/services/projects'

export function normalizeMention(r: any): CommentMention {
  const userExp = r.expand?.mentioned_user_id
  return {
    id: r.id,
    commentId: r.comment_id || '',
    projectId: r.project_id || '',
    mentionedUserId: r.mentioned_user_id || userExp?.id || '',
    mentionedUserName: userExp?.name || '',
    authorId: r.author_id || '',
    tenantId: r.tenant || '',
    createdAt: r.created || new Date().toISOString(),
  }
}

export function normalizeComment(
  r: any,
  mentionsMap?: Record<string, CommentMention[]>,
): ProjectComment {
  const userExp = r.expand?.user_id
  return {
    id: r.id,
    projectId: r.project_id || '',
    userId: r.user_id || userExp?.id || '',
    authorName: r.author_name || userExp?.name || 'Usuário',
    authorRole: userExp?.role || 'servidor',
    authorAvatar: userExp?.avatar || null,
    content: r.content || '',
    parentId: r.parent_id || null,
    isEdited: !!r.is_edited,
    editedAt: r.edited_at || null,
    deleted: !!r.deleted,
    deletedAt: r.deleted_at || null,
    deletedBy: r.deleted_by || null,
    tenantId: r.tenant || '',
    createdAt: r.created || new Date().toISOString(),
    updatedAt: r.updated || new Date().toISOString(),
    mentions: mentionsMap?.[r.id] || [],
    replies: [],
  }
}

/**
 * Busca todos os comentários de um projeto estruturados com respostas aninhadas (1 nível)
 */
export const getProjectComments = async (
  projectId: string,
  tenantId?: string,
): Promise<ProjectComment[]> => {
  try {
    let filter = `project_id = "${projectId}"`
    if (tenantId) {
      filter += ` && tenant = "${tenantId}"`
    }

    // Busca comentários e menções em paralelo
    const [commentRecords, mentionRecords] = await Promise.all([
      pb.collection('project_comments').getFullList({
        filter,
        expand: 'user_id',
        sort: 'created',
      }),
      pb.collection('comment_mentions').getFullList({
        filter,
        expand: 'mentioned_user_id',
        sort: 'created',
      }),
    ])

    const mentionsMap: Record<string, CommentMention[]> = {}
    mentionRecords.forEach((m) => {
      const norm = normalizeMention(m)
      if (!mentionsMap[norm.commentId]) {
        mentionsMap[norm.commentId] = []
      }
      mentionsMap[norm.commentId].push(norm)
    })

    const allComments = commentRecords.map((r) => normalizeComment(r, mentionsMap))

    // Organizar threading de 1 nível (pais e filhos)
    const rootComments: ProjectComment[] = []
    const repliesMap: Record<string, ProjectComment[]> = {}

    allComments.forEach((comm) => {
      if (!comm.parentId) {
        rootComments.push(comm)
      } else {
        if (!repliesMap[comm.parentId]) {
          repliesMap[comm.parentId] = []
        }
        repliesMap[comm.parentId].push(comm)
      }
    })

    rootComments.forEach((root) => {
      root.replies = repliesMap[root.id] || []
    })

    return rootComments
  } catch (err) {
    console.error('Erro ao buscar comentários do projeto:', err)
    return []
  }
}

/**
 * Cria um novo comentário (ou resposta) com suporte a menções, notificações e auditoria
 */
export const createProjectComment = async (data: {
  projectId: string
  userId: string
  authorName: string
  content: string
  tenantId: string
  projectTitle: string
  parentId?: string | null
  mentionedUserIds?: string[]
}): Promise<ProjectComment> => {
  if (!data.projectId || !data.userId || !data.content?.trim() || !data.tenantId) {
    throw new Error('Dados insuficientes para criar comentário.')
  }

  // Sanitizar o conteúdo
  const cleanContent = sanitizeInput(data.content)
  if (!cleanContent) {
    throw new Error('O comentário não pode ficar vazio.')
  }

  const payload = {
    project_id: data.projectId,
    user_id: data.userId,
    author_name: sanitizeInput(data.authorName),
    content: cleanContent,
    parent_id: data.parentId || null,
    is_edited: false,
    deleted: false,
    tenant: data.tenantId,
  }

  const commentRecord = await pb.collection('project_comments').create(payload, {
    expand: 'user_id',
  })

  // Processar menções caso existam
  const mentionsList: CommentMention[] = []
  const uniqueMentionIds = Array.from(new Set(data.mentionedUserIds || []))

  for (const mentionedId of uniqueMentionIds) {
    if (!mentionedId || mentionedId === data.userId) continue

    try {
      // Validar se o usuário mencionado existe, está ativo e possui tenant estritamente igual ao do projeto
      const targetUser = await pb.collection('users').getOne(mentionedId)
      const hasValidTenant = !!targetUser?.tenant && targetUser.tenant === data.tenantId
      const isUserActive = targetUser && targetUser.status !== 'inativo'

      if (targetUser && isUserActive && hasValidTenant) {
        const mentionRecord = await pb.collection('comment_mentions').create(
          {
            comment_id: commentRecord.id,
            project_id: data.projectId,
            mentioned_user_id: mentionedId,
            author_id: data.userId,
            tenant: data.tenantId,
          },
          { expand: 'mentioned_user_id' },
        )
        mentionsList.push(normalizeMention(mentionRecord))

        // Criar notificação interna para o usuário mencionado
        await pb.collection('notifications').create({
          tenant: data.tenantId,
          projeto_id: data.projectId,
          target_user: mentionedId,
          tipo: 'Mencao',
          project_title: data.projectTitle,
          column: 'Comentários',
          days_stalled: 0,
          person_responsible: targetUser.name || 'Servidor',
          mensagem: `${data.authorName} mencionou você em um comentário no projeto "${data.projectTitle}": "${cleanContent.slice(0, 120)}${cleanContent.length > 120 ? '...' : ''}"`,
          lida: false,
          delivery_status: 'enviada',
          delivered_at: new Date().toISOString(),
          alert_date: new Date().toISOString().split('T')[0],
        })

        // Log de auditoria da menção
        await createAuditLog({
          userName: data.authorName,
          actionType: 'Mencionou usuário',
          description: `Mencionou ${targetUser.name || targetUser.email} no projeto "${data.projectTitle}"`,
          projectTitle: data.projectTitle,
          tenantId: data.tenantId,
        })
      } else {
        console.warn(
          `Menção ignorada por política de segurança: usuário ${mentionedId} sem tenant, de outro município ou inativo.`,
        )
      }
    } catch (mErr) {
      console.error('Erro ao processar menção:', mErr)
    }
  }

  // Registrar auditoria da criação de comentário / resposta
  const isReply = !!data.parentId
  await createAuditLog({
    userName: data.authorName,
    actionType: isReply ? 'Criou resposta' : 'Criou comentário',
    description: `${isReply ? 'Respondeu a um comentário' : 'Publicou um novo comentário'} no projeto`,
    projectTitle: data.projectTitle,
    tenantId: data.tenantId,
  })

  const mentionsMap: Record<string, CommentMention[]> = {
    [commentRecord.id]: mentionsList,
  }

  return normalizeComment(commentRecord, mentionsMap)
}

/**
 * Edita o próprio comentário (ou perfil administrativo)
 */
export const updateProjectComment = async (data: {
  commentId: string
  content: string
  currentUserId: string
  currentUserRole?: string
  currentUserName: string
  projectTitle: string
  tenantId: string
  isReply?: boolean
}): Promise<ProjectComment> => {
  const existing = await pb.collection('project_comments').getOne(data.commentId)
  if (!existing) {
    throw new Error('Comentário não encontrado.')
  }

  // Apenas o autor ou admin/superadmin podem editar
  const isAuthor = existing.user_id === data.currentUserId
  const isAdmin = data.currentUserRole === 'superadmin' || data.currentUserRole === 'admin'

  if (!isAuthor && !isAdmin) {
    throw new Error('Você não tem permissão para editar este comentário.')
  }

  const cleanContent = sanitizeInput(data.content)
  if (!cleanContent) {
    throw new Error('O conteúdo do comentário não pode ficar vazio.')
  }

  const updated = await pb.collection('project_comments').update(
    data.commentId,
    {
      content: cleanContent,
      is_edited: true,
      edited_at: new Date().toISOString(),
    },
    { expand: 'user_id' },
  )

  await createAuditLog({
    userName: data.currentUserName,
    actionType: data.isReply ? 'Editou resposta' : 'Editou comentário',
    description: `Editou ${data.isReply ? 'uma resposta' : 'um comentário'} no projeto`,
    projectTitle: data.projectTitle,
    tenantId: data.tenantId,
  })

  return normalizeComment(updated)
}

/**
 * Remoção lógica (soft delete) do comentário, preservando autor, datas e auditoria.
 */
export const softDeleteProjectComment = async (data: {
  commentId: string
  currentUserId: string
  currentUserRole?: string
  currentUserName: string
  projectTitle: string
  tenantId: string
  isReply?: boolean
}): Promise<void> => {
  const existing = await pb.collection('project_comments').getOne(data.commentId)
  if (!existing) {
    throw new Error('Comentário não encontrado.')
  }

  const isAuthor = existing.user_id === data.currentUserId
  const isAdmin = data.currentUserRole === 'superadmin' || data.currentUserRole === 'admin'

  if (!isAuthor && !isAdmin) {
    throw new Error('Você não tem permissão para remover este comentário.')
  }

  await pb.collection('project_comments').update(data.commentId, {
    deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: data.currentUserId,
  })

  await createAuditLog({
    userName: data.currentUserName,
    actionType: data.isReply ? 'Removeu resposta' : 'Removeu comentário',
    description: `Removeu logicamente ${data.isReply ? 'uma resposta' : 'um comentário'} no projeto`,
    projectTitle: data.projectTitle,
    tenantId: data.tenantId,
  })
}
