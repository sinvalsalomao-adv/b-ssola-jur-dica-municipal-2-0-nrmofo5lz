import React, { useState, useEffect, useRef } from 'react'
import {
  MessageSquare,
  Send,
  CornerDownRight,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  User,
  AtSign,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Project, ProjectComment } from '@/types/project'
import { useAuth } from '@/context/AuthContext'
import {
  getProjectComments,
  createProjectComment,
  updateProjectComment,
  softDeleteProjectComment,
} from '@/services/comments'
import { getAvatarUrl } from '@/services/profile'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Props {
  project: Project
  tenantUsers: {
    id: string
    name: string
    email?: string
    role?: string
    avatar?: string | null
    status?: string
  }[]
  onHistoryUpdate?: () => void
}

export const ProjectCommentsSection: React.FC<Props> = ({
  project,
  tenantUsers,
  onHistoryUpdate,
}) => {
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'
  const isAdmin = user?.role === 'admin' || isSuperadmin

  const [comments, setComments] = useState<ProjectComment[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Novo comentário principal
  const [content, setContent] = useState('')
  const [mentionedIds, setMentionedIds] = useState<string[]>([])

  // Autocomplete de @menções para o campo principal
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Resposta a um comentário existente (1 nível)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replyMentionedIds, setReplyMentionedIds] = useState<string[]>([])
  const [replyMentionQuery, setReplyMentionQuery] = useState<string | null>(null)
  const [replyMentionIndex, setReplyMentionIndex] = useState(0)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Edição de comentário existente
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const effectiveTenant = project.tenantId || user?.tenantId || ''

  // Apenas usuários ativos autorizados para o tenant
  const eligibleMentionUsers = tenantUsers.filter((u) => u.status !== 'inativo')

  const loadComments = async () => {
    if (!project.id) return
    setLoading(true)
    try {
      const data = await getProjectComments(project.id, effectiveTenant || undefined)
      setComments(data)
    } catch (err) {
      console.error('Erro ao carregar comentários:', err)
      toast.error('Erro ao buscar comentários do projeto.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComments()
  }, [project.id])

  // Processa detecção de @ no input principal
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setContent(text)

    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = text.slice(0, cursorPos)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1 && !/\s/.test(textBeforeCursor.slice(lastAt + 1))) {
      const query = textBeforeCursor.slice(lastAt + 1).toLowerCase()
      setMentionQuery(query)
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  // Filtra sugestões de menção para o campo principal
  const filteredMentionUsers =
    mentionQuery !== null
      ? eligibleMentionUsers.filter(
          (u) =>
            u.name.toLowerCase().includes(mentionQuery) ||
            (u.email && u.email.toLowerCase().includes(mentionQuery)),
        )
      : []

  const insertMention = (targetUser: (typeof eligibleMentionUsers)[0]) => {
    if (!textareaRef.current) return
    const cursorPos = textareaRef.current.selectionStart || 0
    const textBeforeCursor = content.slice(0, cursorPos)
    const textAfterCursor = content.slice(cursorPos)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, lastAt) + `@${targetUser.name} `
      const newFull = newTextBefore + textAfterCursor
      setContent(newFull)
      setMentionedIds((prev) => Array.from(new Set([...prev, targetUser.id])))
      setMentionQuery(null)

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length)
        }
      }, 50)
    }
  }

  // Processa detecção de @ na resposta
  const handleReplyContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setReplyContent(text)

    const cursorPos = e.target.selectionStart || 0
    const textBeforeCursor = text.slice(0, cursorPos)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1 && !/\s/.test(textBeforeCursor.slice(lastAt + 1))) {
      const query = textBeforeCursor.slice(lastAt + 1).toLowerCase()
      setReplyMentionQuery(query)
      setReplyMentionIndex(0)
    } else {
      setReplyMentionQuery(null)
    }
  }

  const filteredReplyMentionUsers =
    replyMentionQuery !== null
      ? eligibleMentionUsers.filter(
          (u) =>
            u.name.toLowerCase().includes(replyMentionQuery) ||
            (u.email && u.email.toLowerCase().includes(replyMentionQuery)),
        )
      : []

  const insertReplyMention = (targetUser: (typeof eligibleMentionUsers)[0]) => {
    if (!replyTextareaRef.current) return
    const cursorPos = replyTextareaRef.current.selectionStart || 0
    const textBeforeCursor = replyContent.slice(0, cursorPos)
    const textAfterCursor = replyContent.slice(cursorPos)
    const lastAt = textBeforeCursor.lastIndexOf('@')

    if (lastAt !== -1) {
      const newTextBefore = textBeforeCursor.slice(0, lastAt) + `@${targetUser.name} `
      const newFull = newTextBefore + textAfterCursor
      setReplyContent(newFull)
      setReplyMentionedIds((prev) => Array.from(new Set([...prev, targetUser.id])))
      setReplyMentionQuery(null)

      setTimeout(() => {
        if (replyTextareaRef.current) {
          replyTextareaRef.current.focus()
          replyTextareaRef.current.setSelectionRange(newTextBefore.length, newTextBefore.length)
        }
      }, 50)
    }
  }

  // Envio de novo comentário
  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Digite o conteúdo do seu comentário.')
      return
    }
    if (!user) {
      toast.error('Usuário não autenticado.')
      return
    }

    setSubmitting(true)
    try {
      // Identificar IDs de menção presentes no texto
      const detectedMentionIds = eligibleMentionUsers
        .filter((u) => content.includes(`@${u.name}`) || mentionedIds.includes(u.id))
        .map((u) => u.id)

      const created = await createProjectComment({
        projectId: project.id,
        userId: user.id,
        authorName: user.name || 'Servidor',
        content: content.trim(),
        tenantId: effectiveTenant,
        projectTitle: project.title,
        mentionedUserIds: detectedMentionIds,
      })

      setComments((prev) => [...prev, created])
      setContent('')
      setMentionedIds([])
      setMentionQuery(null)
      toast.success('Comentário publicado!')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao publicar comentário.')
    } finally {
      setSubmitting(false)
    }
  }

  // Envio de resposta
  const handleSubmitReply = async (parentComment: ProjectComment) => {
    if (!replyContent.trim()) {
      toast.error('Digite a sua resposta.')
      return
    }
    if (!user) return

    setSubmitting(true)
    try {
      const detectedMentionIds = eligibleMentionUsers
        .filter((u) => replyContent.includes(`@${u.name}`) || replyMentionedIds.includes(u.id))
        .map((u) => u.id)

      const createdReply = await createProjectComment({
        projectId: project.id,
        userId: user.id,
        authorName: user.name || 'Servidor',
        content: replyContent.trim(),
        tenantId: effectiveTenant,
        projectTitle: project.title,
        parentId: parentComment.id,
        mentionedUserIds: detectedMentionIds,
      })

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === parentComment.id) {
            return { ...c, replies: [...(c.replies || []), createdReply] }
          }
          return c
        }),
      )

      setReplyingToId(null)
      setReplyContent('')
      setReplyMentionedIds([])
      setReplyMentionQuery(null)
      toast.success('Resposta publicada!')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao publicar resposta.')
    } finally {
      setSubmitting(false)
    }
  }

  // Iniciar edição
  const handleStartEdit = (c: ProjectComment) => {
    setEditingCommentId(c.id)
    setEditContent(c.content)
  }

  // Salvar edição
  const handleSaveEdit = async (comment: ProjectComment, isReply = false) => {
    if (!editContent.trim()) {
      toast.error('O conteúdo não pode ficar em branco.')
      return
    }
    if (!user) return

    setSavingEdit(true)
    try {
      const updated = await updateProjectComment({
        commentId: comment.id,
        content: editContent.trim(),
        currentUserId: user.id,
        currentUserRole: user.role,
        currentUserName: user.name || 'Servidor',
        projectTitle: project.title,
        tenantId: effectiveTenant,
        isReply,
      })

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return { ...c, content: updated.content, isEdited: true, editedAt: updated.editedAt }
          }
          if (c.replies && c.replies.some((r) => r.id === comment.id)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === comment.id
                  ? { ...r, content: updated.content, isEdited: true, editedAt: updated.editedAt }
                  : r,
              ),
            }
          }
          return c
        }),
      )

      setEditingCommentId(null)
      setEditContent('')
      toast.success('Comentário atualizado!')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao editar comentário.')
    } finally {
      setSavingEdit(false)
    }
  }

  // Soft delete do comentário
  const handleSoftDelete = async (comment: ProjectComment, isReply = false) => {
    if (!confirm('Deseja remover este comentário? O registro será mantido na auditoria.')) return
    if (!user) return

    try {
      await softDeleteProjectComment({
        commentId: comment.id,
        currentUserId: user.id,
        currentUserRole: user.role,
        currentUserName: user.name || 'Servidor',
        projectTitle: project.title,
        tenantId: effectiveTenant,
        isReply,
      })

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === comment.id) {
            return { ...c, deleted: true, deletedAt: new Date().toISOString() }
          }
          if (c.replies && c.replies.some((r) => r.id === comment.id)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === comment.id
                  ? { ...r, deleted: true, deletedAt: new Date().toISOString() }
                  : r,
              ),
            }
          }
          return c
        }),
      )

      toast.success('Comentário removido.')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao remover comentário.')
    }
  }

  // Renderiza texto seguro com destaque de @menções
  const renderHighlightedContent = (text: string) => {
    const parts = text.split(/(@\S+)/g)
    return parts.map((part, idx) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={idx}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200"
          >
            {part}
          </span>
        )
      }
      return <span key={idx}>{part}</span>
    })
  }

  const renderCommentCard = (c: ProjectComment, isReply = false) => {
    const isAuthor = user?.id === c.userId
    const canManage = isAuthor || isAdmin
    const avatarSrc = c.authorAvatar && c.userId ? getAvatarUrl(c.userId, c.authorAvatar) : null

    const formattedDate = c.createdAt
      ? new Date(c.createdAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : ''

    return (
      <div
        key={c.id}
        className={`p-3 rounded-lg border text-xs space-y-2 transition-all ${
          c.deleted
            ? 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
            : isReply
              ? 'bg-slate-50/80 border-slate-200/90 ml-6'
              : 'bg-white border-slate-200/90 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="w-6 h-6 border border-slate-200">
              {avatarSrc ? <AvatarImage src={avatarSrc} alt={c.authorName} /> : null}
              <AvatarFallback className="text-[9px] bg-slate-700 text-white font-bold">
                {c.authorName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800">{c.authorName}</span>
                {c.authorRole && (
                  <Badge variant="outline" className="text-[9px] py-0 px-1 text-slate-500">
                    {c.authorRole}
                  </Badge>
                )}
                {c.isEdited && !c.deleted && (
                  <span className="text-[10px] text-amber-600 font-medium italic">(editado)</span>
                )}
              </div>
              <span className="text-[10px] text-gray-400">{formattedDate}</span>
            </div>
          </div>

          {/* Ações de autor/admin (apenas se não estiver removido) */}
          {!c.deleted && (
            <div className="flex items-center gap-1">
              {!isReply && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingToId(replyingToId === c.id ? null : c.id)
                    setReplyContent('')
                    setReplyMentionQuery(null)
                  }}
                  className="h-6 px-1.5 text-[11px] text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  title="Responder"
                >
                  <CornerDownRight className="w-3 h-3 mr-1" />
                  Responder
                </Button>
              )}
              {canManage && editingCommentId !== c.id && (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleStartEdit(c)}
                    className="h-6 w-6 text-gray-400 hover:text-slate-700 hover:bg-slate-100"
                    title="Editar comentário"
                  >
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleSoftDelete(c, isReply)}
                    className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    title="Remover comentário"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Conteúdo ou formulário de edição */}
        {c.deleted ? (
          <div className="italic text-slate-400 flex items-center gap-1.5 py-1">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>Este comentário foi removido pelo autor ou moderador.</span>
          </div>
        ) : editingCommentId === c.id ? (
          <div className="space-y-2 pt-1">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="text-xs min-h-[60px]"
              autoFocus
            />
            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingCommentId(null)}
                disabled={savingEdit}
                className="h-7 text-xs"
              >
                <X className="w-3 h-3 mr-1" /> Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSaveEdit(c, isReply)}
                disabled={savingEdit || !editContent.trim()}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {savingEdit ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Check className="w-3 h-3 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
            {renderHighlightedContent(c.content)}
          </p>
        )}

        {/* Campo de resposta encadeada (1 nível) */}
        {replyingToId === c.id && !c.deleted && (
          <div className="mt-2 pt-2 border-t border-slate-200 space-y-2 relative">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              <CornerDownRight className="w-3 h-3 text-blue-600" />
              Respondendo para {c.authorName}:
            </div>

            <Textarea
              ref={replyTextareaRef}
              value={replyContent}
              onChange={handleReplyContentChange}
              placeholder="Escreva sua resposta... Digite @ para mencionar"
              className="text-xs min-h-[50px]"
              autoFocus
            />

            {/* Sugestões de menção na resposta */}
            {replyMentionQuery !== null && filteredReplyMentionUsers.length > 0 && (
              <div className="absolute left-0 right-0 top-16 z-30 bg-white border border-slate-200 rounded-lg shadow-lg max-h-36 overflow-y-auto p-1 space-y-0.5">
                <div className="text-[10px] font-bold text-gray-400 px-2 py-0.5 uppercase">
                  Mencionar Servidor
                </div>
                {filteredReplyMentionUsers.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => insertReplyMention(u)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                      i === replyMentionIndex
                        ? 'bg-blue-50 text-blue-700'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="font-medium">{u.name}</span>
                    <span className="text-[10px] text-gray-400">({u.role || 'servidor'})</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplyingToId(null)}
                disabled={submitting}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => handleSubmitReply(c)}
                disabled={submitting || !replyContent.trim()}
                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
              >
                {submitting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Send className="w-3 h-3" />
                )}
                Enviar Resposta
              </Button>
            </div>
          </div>
        )}

        {/* Lista de respostas aninhadas (1 nível) */}
        {c.replies && c.replies.length > 0 && (
          <div className="space-y-2 pt-1">
            {c.replies.map((reply) => renderCommentCard(reply, true))}
          </div>
        )}
      </div>
    )
  }

  const totalCommentsCount = comments.reduce(
    (acc, cur) => acc + 1 + (cur.replies ? cur.replies.length : 0),
    0,
  )

  return (
    <div className="space-y-4">
      {/* Cabeçalho da aba */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="font-bold text-xs uppercase tracking-wide text-[#1c2a3e]">
            Comentários e Menções
          </h3>
          <Badge variant="outline" className="text-[10px] ml-1">
            {totalCommentsCount}
          </Badge>
        </div>
      </div>

      {/* Formulário para novo comentário principal */}
      <form
        onSubmit={handleSubmitComment}
        className="relative space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200"
      >
        <div className="flex items-center justify-between text-xs text-slate-700 font-medium">
          <span className="flex items-center gap-1">
            <AtSign className="w-3.5 h-3.5 text-blue-600" /> Escreva um comentário
          </span>
          <span className="text-[10px] text-gray-400">
            Digite @ para mencionar membros da equipe
          </span>
        </div>

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          placeholder="Deixe uma observação, atualização ou mencione @servidor..."
          className="text-xs min-h-[75px] bg-white"
        />

        {/* Dropdown de sugestões de @menções */}
        {mentionQuery !== null && filteredMentionUsers.length > 0 && (
          <div className="absolute left-3 right-3 top-24 z-30 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto p-1 space-y-0.5">
            <div className="text-[10px] font-bold text-gray-400 px-2 py-0.5 uppercase">
              Mencionar Usuário da Prefeitura
            </div>
            {filteredMentionUsers.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u)}
                className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                  i === mentionIndex
                    ? 'bg-blue-50 text-blue-700'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-semibold">{u.name}</span>
                <span className="text-[10px] text-gray-400 ml-auto">({u.role || 'servidor'})</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            {mentionedIds.length > 0 && (
              <span className="text-[10px] text-blue-600 font-medium">
                {mentionedIds.length} {mentionedIds.length === 1 ? 'menção' : 'menções'}{' '}
                detectada(s)
              </span>
            )}
          </div>
          <Button
            type="submit"
            disabled={submitting || !content.trim()}
            className="h-8 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 gap-1.5 shadow-xs"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Comentar
          </Button>
        </div>
      </form>

      {/* Lista de comentários */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-xs text-gray-400 space-y-2 border border-dashed rounded-lg bg-slate-50/50">
          <MessageSquare className="w-8 h-8 mx-auto text-gray-300" />
          <p>Nenhum comentário registrado para este projeto.</p>
          <p className="text-[10px]">
            Utilize o campo acima para iniciar uma conversa com a equipe.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {comments.map((comment) => renderCommentCard(comment))}
        </div>
      )}
    </div>
  )
}
