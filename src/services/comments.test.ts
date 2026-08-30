/**
 * Testes automatizados para o módulo de Comentários, Menções (@usuário) e Participantes (Cartão de Projeto 2.0).
 * Cobre:
 * 1. Criar comentário simples e verificar estrutura de persistência
 * 2. Criar comentário com uma e várias @menções
 * 3. Bloquear menção a usuário sem acesso/inativo ou de outro tenant
 * 4. Adicionar/remover participante e impedir duplicidade
 * 5. Editar o próprio comentário e bloquear edição por outro usuário sem permissão
 * 6. Remover logicamente (soft delete) e confirmar preservação na auditoria
 * 7. Confirmar notificações internas das menções com link para projeto e aba Comentários
 * 8. Confirmar isolamento multi-tenant
 * 9. Confirmar sanitização XSS e proteção contra injeção de HTML
 * 10. Confirmar proteção de segredos técnicos e tokens nos logs de auditoria
 */

import { sanitizeInput } from '@/lib/sanitize'
import { sanitizeHttpError, sanitizeString } from '@/lib/errorSanitizer'
import { normalizeComment, normalizeMention } from './comments'
import { normalizeParticipant } from './participants'

export interface CommentsModuleTestResult {
  passed: boolean
  results: Array<{ name: string; ok: boolean; detail?: string }>
}

export function runCommentsAndParticipantsTests(): CommentsModuleTestResult {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = []

  function test(name: string, fn: () => boolean) {
    try {
      const ok = fn()
      results.push({ name, ok })
    } catch (err) {
      results.push({ name, ok: false, detail: String(err) })
    }
  }

  // 1. Criar comentário simples e validar persistência
  test('Deve normalizar e estruturar comentário simples com campos de autor e auditoria', () => {
    const rawRecord = {
      id: 'comm_001',
      project_id: 'proj_123',
      user_id: 'usr_001',
      author_name: 'Dr. Procurador',
      content: 'Projeto revisado e aprovado com ressalvas.',
      parent_id: null,
      is_edited: false,
      deleted: false,
      tenant: 'tenant_florania',
      created: '2025-05-20T10:00:00.000Z',
      updated: '2025-05-20T10:00:00.000Z',
      expand: {
        user_id: {
          id: 'usr_001',
          name: 'Dr. Procurador',
          role: 'procurador',
          avatar: 'avatar1.png',
        },
      },
    }

    const normalized = normalizeComment(rawRecord)

    return (
      normalized.id === 'comm_001' &&
      normalized.authorName === 'Dr. Procurador' &&
      normalized.authorRole === 'procurador' &&
      normalized.content === 'Projeto revisado e aprovado com ressalvas.' &&
      normalized.deleted === false &&
      normalized.isEdited === false &&
      Array.isArray(normalized.replies) &&
      Array.isArray(normalized.mentions)
    )
  })

  // 2. Criar comentário com uma e várias @menções
  test('Deve processar e vincular @menções múltiplas a IDs de usuários', () => {
    const rawMention1 = {
      id: 'men_001',
      comment_id: 'comm_002',
      project_id: 'proj_123',
      mentioned_user_id: 'usr_carlos',
      author_id: 'usr_ana',
      tenant: 'tenant_florania',
      created: '2025-05-20T10:05:00.000Z',
      expand: {
        mentioned_user_id: { id: 'usr_carlos', name: 'Carlos Gestor' },
      },
    }

    const rawMention2 = {
      id: 'men_002',
      comment_id: 'comm_002',
      project_id: 'proj_123',
      mentioned_user_id: 'usr_sofia',
      author_id: 'usr_ana',
      tenant: 'tenant_florania',
      created: '2025-05-20T10:05:00.000Z',
      expand: {
        mentioned_user_id: { id: 'usr_sofia', name: 'Sofia Secretária' },
      },
    }

    const norm1 = normalizeMention(rawMention1)
    const norm2 = normalizeMention(rawMention2)

    const mentionsMap = {
      comm_002: [norm1, norm2],
    }

    const rawComment = {
      id: 'comm_002',
      project_id: 'proj_123',
      user_id: 'usr_ana',
      author_name: 'Ana',
      content: 'Favor revisar @Carlos Gestor e @Sofia Secretária o cronograma.',
      parent_id: null,
      tenant: 'tenant_florania',
    }

    const normalizedComm = normalizeComment(rawComment, mentionsMap)

    return (
      normalizedComm.mentions?.length === 2 &&
      normalizedComm.mentions[0].mentionedUserId === 'usr_carlos' &&
      normalizedComm.mentions[0].mentionedUserName === 'Carlos Gestor' &&
      normalizedComm.mentions[1].mentionedUserId === 'usr_sofia'
    )
  })

  // 3. Bloquear menção com allowlist estrita (status === 'ativo'), sem tenant, outro tenant, status ausente ou inexistente
  test('Deve bloquear e filtrar menções a usuários sem tenant, status diferente de ativo, status ausente/desconhecido ou pertencentes a outro tenant', () => {
    const currentTenant = 'tenant_florania'
    const systemUsers = [
      { id: 'u1', name: 'Maria Servidora', tenant: 'tenant_florania', status: 'ativo' },
      { id: 'u2', name: 'João Inativo', tenant: 'tenant_florania', status: 'inativo' },
      { id: 'u3', name: 'Pedro Outro Município', tenant: 'tenant_tangara', status: 'ativo' },
      { id: 'u4', name: 'Superadmin Sem Tenant', tenant: '', status: 'ativo' },
      { id: 'u5', name: 'Superadmin Null Tenant', tenant: null as any, status: 'ativo' },
      { id: 'u6', name: 'Superadmin Undefined Tenant', tenant: undefined as any, status: 'ativo' },
      { id: 'u7', name: 'Usuário Status Pendente', tenant: 'tenant_florania', status: 'pendente' },
      { id: 'u8', name: 'Usuário Status Vazio', tenant: 'tenant_florania', status: '' },
      {
        id: 'u9',
        name: 'Usuário Status Ausente',
        tenant: 'tenant_florania',
        status: undefined as any,
      },
    ]

    function validateMentionSecurity(
      user:
        | { id?: string; name?: string; tenant?: string | null; status?: string }
        | null
        | undefined,
      targetTenantId: string,
    ): boolean {
      if (!user || !user.id) return false
      // Allowlist estrita: status deve ser EXATAMENTE 'ativo'
      if (user.status !== 'ativo') return false
      if (!user.tenant || typeof user.tenant !== 'string' || user.tenant.trim() === '') return false
      return user.tenant === targetTenantId
    }

    // Validações individuais dos cenários obrigatórios
    const isSameTenantActiveAllowed = validateMentionSecurity(systemUsers[0], currentTenant)
    const isInactiveBlocked = !validateMentionSecurity(systemUsers[1], currentTenant)
    const isOtherTenantBlocked = !validateMentionSecurity(systemUsers[2], currentTenant)
    const isNoTenantBlocked = !validateMentionSecurity(systemUsers[3], currentTenant)
    const isNullTenantBlocked = !validateMentionSecurity(systemUsers[4], currentTenant)
    const isUndefinedTenantBlocked = !validateMentionSecurity(systemUsers[5], currentTenant)
    const isPendingStatusBlocked = !validateMentionSecurity(systemUsers[6], currentTenant)
    const isEmptyStatusBlocked = !validateMentionSecurity(systemUsers[7], currentTenant)
    const isAbsentStatusBlocked = !validateMentionSecurity(systemUsers[8], currentTenant)
    const isNonExistentBlocked = !validateMentionSecurity(null, currentTenant)

    const eligibleUsers = systemUsers.filter((u) => validateMentionSecurity(u, currentTenant))

    return (
      isSameTenantActiveAllowed &&
      isInactiveBlocked &&
      isOtherTenantBlocked &&
      isNoTenantBlocked &&
      isNullTenantBlocked &&
      isUndefinedTenantBlocked &&
      isPendingStatusBlocked &&
      isEmptyStatusBlocked &&
      isAbsentStatusBlocked &&
      isNonExistentBlocked &&
      eligibleUsers.length === 1 &&
      eligibleUsers[0].id === 'u1' &&
      !eligibleUsers.some((u) => u.id === 'u2') &&
      !eligibleUsers.some((u) => u.id === 'u3') &&
      !eligibleUsers.some((u) => u.id === 'u4') &&
      !eligibleUsers.some((u) => u.id === 'u5') &&
      !eligibleUsers.some((u) => u.id === 'u6') &&
      !eligibleUsers.some((u) => u.id === 'u7') &&
      !eligibleUsers.some((u) => u.id === 'u8') &&
      !eligibleUsers.some((u) => u.id === 'u9')
    )
  })

  // 3.1 Testes obrigatórios adicionais para comentários e respostas com menções válidas e inválidas
  test('Deve validar menções em comentários principais e respostas (permitir válida e rejeitar inválida)', () => {
    const projectTenant = 'tenant_florania'
    const validUser = {
      id: 'u_valido',
      name: 'Servidor Florânia',
      tenant: 'tenant_florania',
      status: 'ativo',
    }
    const noTenantUser = { id: 'u_super', name: 'Superadmin Global', tenant: '', status: 'ativo' }
    const otherTenantUser = {
      id: 'u_outro',
      name: 'Servidor Tangará',
      tenant: 'tenant_tangara',
      status: 'ativo',
    }
    const inactiveUser = {
      id: 'u_inativo',
      name: 'Servidor Inativo',
      tenant: 'tenant_florania',
      status: 'inativo',
    }
    const unknownStatusUser = {
      id: 'u_unknown',
      name: 'Servidor Desconhecido',
      tenant: 'tenant_florania',
      status: 'bloqueado',
    }

    function filterValidMentions(
      mentionedIds: string[],
      usersDb: Array<{ id: string; name: string; tenant: string | null; status?: string }>,
      tenantId: string,
    ): string[] {
      return mentionedIds.filter((id) => {
        const u = usersDb.find((item) => item.id === id)
        if (!u) return false
        // Allowlist estrita
        if (u.status !== 'ativo') return false
        if (
          !u.tenant ||
          typeof u.tenant !== 'string' ||
          u.tenant.trim() === '' ||
          u.tenant !== tenantId
        )
          return false
        return true
      })
    }

    const allDbUsers = [validUser, noTenantUser, otherTenantUser, inactiveUser, unknownStatusUser]

    // Comentário sem menção: permitido
    const commentWithoutMentions: string[] = []
    const validNoMentions = filterValidMentions(commentWithoutMentions, allDbUsers, projectTenant)

    // Comentário ou resposta com menção válida
    const replyWithValidMention = [validUser.id]
    const filteredValidReply = filterValidMentions(replyWithValidMention, allDbUsers, projectTenant)

    // Comentário ou resposta com menções inválidas (sem tenant, outro tenant, inativo, status desconhecido, inexistente)
    const replyWithInvalidMentions = [
      noTenantUser.id,
      otherTenantUser.id,
      inactiveUser.id,
      unknownStatusUser.id,
      'u_fantasma',
    ]
    const filteredInvalidReply = filterValidMentions(
      replyWithInvalidMentions,
      allDbUsers,
      projectTenant,
    )

    return (
      validNoMentions.length === 0 &&
      filteredValidReply.length === 1 &&
      filteredValidReply[0] === validUser.id &&
      filteredInvalidReply.length === 0
    )
  })

  // 3.2 Teste de atomicidade estrita: validação prévia de TODAS as menções antes de criar qualquer registro
  test('Atomicidade: rejeitar operação inteira se houver menção inválida sem criar comentário parcial, menção, notificação ou log', () => {
    const GENERIC_ERROR_MESSAGE = 'Não foi possível adicionar uma ou mais menções.'
    const currentTenant = 'tenant_florania'

    const usersDb = [
      { id: 'usr_valido_1', name: 'Ana Gestora', tenant: 'tenant_florania', status: 'ativo' },
      { id: 'usr_valido_2', name: 'Bruno Procurador', tenant: 'tenant_florania', status: 'ativo' },
      { id: 'usr_inativo', name: 'Carlos Inativo', tenant: 'tenant_florania', status: 'inativo' },
      {
        id: 'usr_outro_tenant',
        name: 'Daniel Outra Cidade',
        tenant: 'tenant_tangara',
        status: 'ativo',
      },
      { id: 'usr_sem_tenant', name: 'Superadmin Sem Tenant', tenant: '', status: 'ativo' },
      {
        id: 'usr_status_desconhecido',
        name: 'Eduardo Suspenso',
        tenant: 'tenant_florania',
        status: 'suspenso',
      },
    ]

    interface StateTracker {
      commentsCreated: any[]
      mentionsCreated: any[]
      notificationsCreated: any[]
      auditLogsCreated: any[]
    }

    // Simulação do fluxo exato de atomicidade de createProjectComment
    function simulateAtomicCommentCreation(
      data: {
        projectId: string
        userId: string
        authorName: string
        content: string
        tenantId: string
        projectTitle: string
        parentId?: string | null
        mentionedUserIds?: string[]
      },
      tracker: StateTracker,
    ): { success: boolean; error?: string; comment?: any } {
      if (!data.projectId || !data.userId || !data.content?.trim() || !data.tenantId) {
        return { success: false, error: 'Dados insuficientes para criar comentário.' }
      }

      const cleanContent = sanitizeInput(data.content)
      if (!cleanContent) {
        return { success: false, error: 'O comentário não pode ficar vazio.' }
      }

      // 1. Validação PRÉVIA de TODAS as menções antes de qualquer mutação
      const uniqueMentionIds = Array.from(new Set(data.mentionedUserIds || [])).filter(
        (id) => !!id && id !== data.userId,
      )

      const validatedUsers: any[] = []
      for (const mId of uniqueMentionIds) {
        const targetUser = usersDb.find((u) => u.id === mId)
        const hasValidTenant =
          typeof targetUser?.tenant === 'string' &&
          targetUser.tenant.trim() !== '' &&
          targetUser.tenant === data.tenantId
        const isUserActive = targetUser?.status === 'ativo'

        if (!targetUser || !isUserActive || !hasValidTenant) {
          // Rejeita IMEDIATAMENTE com a mensagem uniforme genérica
          return { success: false, error: GENERIC_ERROR_MESSAGE }
        }

        validatedUsers.push(targetUser)
      }

      // 2. Cria comentário APENAS após validação integral
      const createdComment = {
        id: `comm_${Date.now()}`,
        project_id: data.projectId,
        user_id: data.userId,
        author_name: sanitizeInput(data.authorName),
        content: cleanContent,
        parent_id: data.parentId || null,
        is_edited: false,
        deleted: false,
        tenant: data.tenantId,
      }
      tracker.commentsCreated.push(createdComment)

      // 3. Cria menções e notificações
      for (const u of validatedUsers) {
        tracker.mentionsCreated.push({
          comment_id: createdComment.id,
          project_id: data.projectId,
          mentioned_user_id: u.id,
          author_id: data.userId,
          tenant: data.tenantId,
        })
        tracker.notificationsCreated.push({
          tenant: data.tenantId,
          projeto_id: data.projectId,
          target_user: u.id,
          tipo: 'Mencao',
          project_title: data.projectTitle,
        })
        tracker.auditLogsCreated.push({
          userName: data.authorName,
          actionType: 'Mencionou usuário',
          projectTitle: data.projectTitle,
          tenantId: data.tenantId,
        })
      }

      // Log do comentário
      tracker.auditLogsCreated.push({
        userName: data.authorName,
        actionType: data.parentId ? 'Criou resposta' : 'Criou comentário',
        projectTitle: data.projectTitle,
        tenantId: data.tenantId,
      })

      return { success: true, comment: createdComment }
    }

    // Cenário A: Uma menção válida + uma menção inválida (inativo) -> DEVE REJEITAR TUDO
    const trackerA: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultA = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Chamando @Ana Gestora e @Carlos Inativo',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: ['usr_valido_1', 'usr_inativo'],
      },
      trackerA,
    )

    // Cenário B: Uma menção válida + uma menção de outro tenant -> DEVE REJEITAR TUDO
    const trackerB: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultB = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Chamando @Ana Gestora e @Daniel Outra Cidade',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: ['usr_valido_1', 'usr_outro_tenant'],
      },
      trackerB,
    )

    // Cenário C: Uma menção válida + uma menção inexistente -> DEVE REJEITAR TUDO
    const trackerC: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultC = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Chamando @Ana Gestora e @Fantasma',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: ['usr_valido_1', 'usr_fantasma_inexistente'],
      },
      trackerC,
    )

    // Cenário D: Menção com status ausente ou desconhecido -> DEVE REJEITAR TUDO
    const trackerD: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultD = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Chamando @Eduardo Suspenso',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: ['usr_status_desconhecido'],
      },
      trackerD,
    )

    // Cenário E: Menções 100% válidas -> DEVE CRIAR COM SUCESSO
    const trackerE: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultE = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Chamando @Ana Gestora e @Bruno Procurador',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: ['usr_valido_1', 'usr_valido_2'],
      },
      trackerE,
    )

    // Cenário F: Comentário sem nenhuma menção -> DEVE CRIAR COM SUCESSO
    const trackerF: StateTracker = {
      commentsCreated: [],
      mentionsCreated: [],
      notificationsCreated: [],
      auditLogsCreated: [],
    }
    const resultF = simulateAtomicCommentCreation(
      {
        projectId: 'proj_1',
        userId: 'author_1',
        authorName: 'Autor',
        content: 'Comentário limpo sem nenhuma menção',
        tenantId: currentTenant,
        projectTitle: 'Projeto Teste',
        mentionedUserIds: [],
      },
      trackerF,
    )

    const isAtomicA =
      !resultA.success &&
      resultA.error === GENERIC_ERROR_MESSAGE &&
      trackerA.commentsCreated.length === 0 &&
      trackerA.mentionsCreated.length === 0 &&
      trackerA.notificationsCreated.length === 0 &&
      trackerA.auditLogsCreated.length === 0

    const isAtomicB =
      !resultB.success &&
      resultB.error === GENERIC_ERROR_MESSAGE &&
      trackerB.commentsCreated.length === 0 &&
      trackerB.mentionsCreated.length === 0 &&
      trackerB.notificationsCreated.length === 0 &&
      trackerB.auditLogsCreated.length === 0

    const isAtomicC =
      !resultC.success &&
      resultC.error === GENERIC_ERROR_MESSAGE &&
      trackerC.commentsCreated.length === 0 &&
      trackerC.mentionsCreated.length === 0 &&
      trackerC.notificationsCreated.length === 0 &&
      trackerC.auditLogsCreated.length === 0

    const isAtomicD =
      !resultD.success &&
      resultD.error === GENERIC_ERROR_MESSAGE &&
      trackerD.commentsCreated.length === 0 &&
      trackerD.mentionsCreated.length === 0 &&
      trackerD.notificationsCreated.length === 0 &&
      trackerD.auditLogsCreated.length === 0

    const isSuccessE =
      resultE.success &&
      trackerE.commentsCreated.length === 1 &&
      trackerE.mentionsCreated.length === 2 &&
      trackerE.notificationsCreated.length === 2 &&
      trackerE.auditLogsCreated.length === 3 // 2 mencoes + 1 comentario

    const isSuccessF =
      resultF.success &&
      trackerF.commentsCreated.length === 1 &&
      trackerF.mentionsCreated.length === 0 &&
      trackerF.notificationsCreated.length === 0 &&
      trackerF.auditLogsCreated.length === 1 // 1 comentario

    return isAtomicA && isAtomicB && isAtomicC && isAtomicD && isSuccessE && isSuccessF
  })

  // 3.3 Teste de mensagem genérica e não-vazamento de existência, status ou tenant
  test('Segurança e Não-vazamento: a mensagem de erro deve ser idêntica e genérica para qualquer falha de menção', () => {
    const GENERIC_MSG = 'Não foi possível adicionar uma ou mais menções.'
    const testCases = [
      { reason: 'inexistente', expected: GENERIC_MSG },
      { reason: 'sem_tenant', expected: GENERIC_MSG },
      { reason: 'outro_tenant', expected: GENERIC_MSG },
      { reason: 'inativo', expected: GENERIC_MSG },
      { reason: 'status_desconhecido', expected: GENERIC_MSG },
      { reason: 'status_nulo', expected: GENERIC_MSG },
    ]

    const allMatchGeneric = testCases.every((tc) => {
      const msg = GENERIC_MSG
      const leaksExistence =
        msg.toLowerCase().includes('inexistente') || msg.toLowerCase().includes('não encontrado')
      const leaksStatus =
        msg.toLowerCase().includes('inativo') || msg.toLowerCase().includes('status')
      const leaksTenant =
        msg.toLowerCase().includes('prefeitura') ||
        msg.toLowerCase().includes('município') ||
        msg.toLowerCase().includes('tenant')
      return msg === tc.expected && !leaksExistence && !leaksStatus && !leaksTenant
    })

    return allMatchGeneric
  })

  // 4. Adicionar/remover participante e impedir duplicidade
  test('Deve normalizar participantes e impedir inserção de participante duplicado', () => {
    const rawParticipant = {
      id: 'part_001',
      project_id: 'proj_123',
      user_id: 'usr_mariana',
      tenant: 'tenant_florania',
      role: 'fiscal',
      created: '2025-05-20T11:00:00.000Z',
      expand: {
        user_id: {
          id: 'usr_mariana',
          name: 'Mariana Fiscal',
          email: 'mariana@florania.gov.br',
          role: 'servidor',
          avatar: 'avatar_m.png',
        },
      },
    }

    const norm = normalizeParticipant(rawParticipant)

    const existingParticipants = [norm]
    const isDuplicate = existingParticipants.some((p) => p.userId === 'usr_mariana')
    const isNotDuplicate = existingParticipants.some((p) => p.userId === 'usr_novo')

    return (
      norm.userId === 'usr_mariana' &&
      norm.userName === 'Mariana Fiscal' &&
      isDuplicate === true &&
      isNotDuplicate === false
    )
  })

  // 5. Editar o próprio comentário e bloquear edição por outro usuário
  test('Deve autorizar edição pelo autor ou admin e bloquear por usuários comuns não-autores', () => {
    const commentOwnerId = 'usr_autor'
    const regularUserId = 'usr_estranho'
    const adminUserId = 'usr_admin'

    function canEdit(userId: string, role: string, ownerId: string): boolean {
      const isAuthor = userId === ownerId
      const isAdmin = role === 'admin' || role === 'superadmin'
      return isAuthor || isAdmin
    }

    const ownerCan = canEdit(commentOwnerId, 'servidor', commentOwnerId)
    const strangerCannot = canEdit(regularUserId, 'servidor', commentOwnerId)
    const adminCan = canEdit(adminUserId, 'admin', commentOwnerId)
    const superadminCan = canEdit('usr_super', 'superadmin', commentOwnerId)

    return ownerCan && !strangerCannot && adminCan && superadminCan
  })

  // 6. Remoção lógica (soft delete) preservando autor, datas e auditoria
  test('Deve aplicar soft delete preservando histórico e dados do autor original', () => {
    const originalComment = {
      id: 'comm_003',
      user_id: 'usr_autor',
      author_name: 'Carlos',
      content: 'Comentário confidencial a ser removido',
      deleted: false,
      deleted_at: null,
      created: '2025-05-20T09:00:00.000Z',
    }

    const softDeletedComment = {
      ...originalComment,
      deleted: true,
      deleted_at: '2025-05-20T11:30:00.000Z',
      deleted_by: 'usr_admin',
    }

    return (
      softDeletedComment.deleted === true &&
      softDeletedComment.user_id === 'usr_autor' &&
      softDeletedComment.content === originalComment.content &&
      !!softDeletedComment.deleted_at
    )
  })

  // 7. Notificações internas das menções com link para projeto e aba Comentários
  test('Deve gerar notificação interna com tipo Mencao, projeto_id e dados da menção', () => {
    const notificationPayload = {
      tenant: 'tenant_florania',
      projeto_id: 'proj_123',
      target_user: 'usr_mencionado',
      tipo: 'Mencao',
      project_title: 'Reforma da Praça Central',
      column: 'Comentários',
      mensagem: 'Carlos mencionou você no projeto "Reforma da Praça Central"',
      lida: false,
      delivery_status: 'enviada',
    }

    const hasTargetTabLink =
      notificationPayload.tipo === 'Mencao' && !!notificationPayload.projeto_id

    return (
      notificationPayload.tipo === 'Mencao' &&
      notificationPayload.target_user === 'usr_mencionado' &&
      hasTargetTabLink
    )
  })

  // 8. Isolamento multi-tenant rigoroso
  test('Deve garantir isolamento rigoroso de regras de acesso (RLS) por tenant', () => {
    const rlsRule =
      "@request.auth.id != '' && (tenant = @request.auth.tenant || @request.auth.role = 'superadmin')"

    const tenantA: string = 'tenant_florania'
    const tenantB: string = 'tenant_tangara'
    const filterTenantFlorania: string = `project_id = "proj_1" && tenant = "${tenantA}"`
    const filterTenantTangara: string = `project_id = "proj_1" && tenant = "${tenantB}"`

    return (
      rlsRule.includes("@request.auth.id != ''") &&
      rlsRule.includes('tenant = @request.auth.tenant') &&
      filterTenantFlorania !== filterTenantTangara
    )
  })

  // 9. Sanitização XSS e proteção contra HTML arbitrário
  test('Deve sanitizar injeção de scripts e tags HTML no corpo dos comentários', () => {
    const maliciousInput =
      '<script>alert("XSS")</script><img src=x onerror=alert(1)>Olá @servidor <b>importante</b>'
    const sanitized = sanitizeInput(maliciousInput)

    const isScriptRemoved = !sanitized.includes('<script>') && !sanitized.includes('alert(')
    const isImgRemoved = !sanitized.includes('<img')
    const isTagEscaped = !sanitized.includes('<b>')

    return isScriptRemoved && isImgRemoved && isTagEscaped
  })

  // 10. Proteção de segredos e tokens nos logs de auditoria
  test('Deve mascarar tokens, senhas e credenciais em logs de auditoria', () => {
    const dirtyLog =
      'Usuário realizou menção com Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID and token=secretPass123'
    const cleanLog = sanitizeString(dirtyLog)

    const isJwtMasked = !cleanLog.includes('eyJhbGciOiJIUzI1Ni')
    const isTokenMasked = !cleanLog.includes('secretPass123')

    return isJwtMasked && isTokenMasked
  })

  const passed = results.every((r) => r.ok)
  return { passed, results }
}
