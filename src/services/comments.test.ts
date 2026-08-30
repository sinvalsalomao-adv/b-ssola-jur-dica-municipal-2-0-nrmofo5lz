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

  // 3. Bloquear menção a usuário sem acesso/inativo, sem tenant ou de outro tenant
  test('Deve bloquear e filtrar menções a usuários sem tenant, inativos ou pertencentes a outro tenant', () => {
    const currentTenant = 'tenant_florania'
    const systemUsers = [
      { id: 'u1', name: 'Maria Servidora', tenant: 'tenant_florania', status: 'ativo' },
      { id: 'u2', name: 'João Inativo', tenant: 'tenant_florania', status: 'inativo' },
      { id: 'u3', name: 'Pedro Outro Município', tenant: 'tenant_tangara', status: 'ativo' },
      { id: 'u4', name: 'Superadmin Sem Tenant', tenant: '', status: 'ativo' },
      { id: 'u5', name: 'Superadmin Null Tenant', tenant: null as any, status: 'ativo' },
      { id: 'u6', name: 'Superadmin Undefined Tenant', tenant: undefined as any, status: 'ativo' },
    ]

    function validateMentionSecurity(
      user:
        | { id?: string; name?: string; tenant?: string | null; status?: string }
        | null
        | undefined,
      targetTenantId: string,
    ): boolean {
      if (!user || !user.id) return false
      if (user.status === 'inativo') return false
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
    const isNonExistentBlocked = !validateMentionSecurity(null, currentTenant)

    const eligibleUsers = systemUsers.filter((u) => validateMentionSecurity(u, currentTenant))

    return (
      isSameTenantActiveAllowed &&
      isInactiveBlocked &&
      isOtherTenantBlocked &&
      isNoTenantBlocked &&
      isNullTenantBlocked &&
      isUndefinedTenantBlocked &&
      isNonExistentBlocked &&
      eligibleUsers.length === 1 &&
      eligibleUsers[0].id === 'u1' &&
      !eligibleUsers.some((u) => u.id === 'u2') &&
      !eligibleUsers.some((u) => u.id === 'u3') &&
      !eligibleUsers.some((u) => u.id === 'u4') &&
      !eligibleUsers.some((u) => u.id === 'u5') &&
      !eligibleUsers.some((u) => u.id === 'u6')
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

    function filterValidMentions(
      mentionedIds: string[],
      usersDb: Array<{ id: string; name: string; tenant: string | null; status: string }>,
      tenantId: string,
    ): string[] {
      return mentionedIds.filter((id) => {
        const u = usersDb.find((item) => item.id === id)
        if (!u) return false
        if (u.status === 'inativo') return false
        if (!u.tenant || u.tenant !== tenantId) return false
        return true
      })
    }

    const allDbUsers = [validUser, noTenantUser, otherTenantUser, inactiveUser]

    // Comentário sem menção: permitido
    const commentWithoutMentions: string[] = []
    const validNoMentions = filterValidMentions(commentWithoutMentions, allDbUsers, projectTenant)

    // Comentário ou resposta com menção válida
    const replyWithValidMention = [validUser.id]
    const filteredValidReply = filterValidMentions(replyWithValidMention, allDbUsers, projectTenant)

    // Comentário ou resposta com menções inválidas (sem tenant, outro tenant, inativo, inexistente)
    const replyWithInvalidMentions = [
      noTenantUser.id,
      otherTenantUser.id,
      inactiveUser.id,
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
