import React, { useState, useEffect, useCallback } from 'react'
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  User,
  Loader2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  X,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checklist, ChecklistItem, Project } from '@/types/project'
import {
  getChecklistsByProject,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
} from '@/services/checklists'
import { createAuditLog } from '@/services/projects'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { formatDate } from '@/lib/dateUtils'

interface ProjectChecklistSectionProps {
  project: Project
  users: { id: string; name: string }[]
  onHistoryUpdate?: () => void
}

export const ProjectChecklistSection: React.FC<ProjectChecklistSectionProps> = ({
  project,
  users,
  onHistoryUpdate,
}) => {
  const { user } = useAuth()

  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Creation / editing states
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false)
  const [submittingChecklist, setSubmittingChecklist] = useState(false)

  // Editing checklist title
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null)
  const [editingChecklistTitle, setEditingChecklistTitle] = useState('')
  const [savingChecklistTitle, setSavingChecklistTitle] = useState(false)

  // New item form state per checklist (keyed by checklistId)
  const [addingItemChecklistId, setAddingItemChecklistId] = useState<string | null>(null)
  const [newItemText, setNewItemText] = useState('')
  const [newItemResponsible, setNewItemResponsible] = useState<string>('none')
  const [newItemDeadline, setNewItemDeadline] = useState('')
  const [submittingItem, setSubmittingItem] = useState(false)

  // Editing item state
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemText, setEditItemText] = useState('')
  const [editItemResponsible, setEditItemResponsible] = useState<string>('none')
  const [editItemDeadline, setEditItemDeadline] = useState('')
  const [savingItemEdit, setSavingItemEdit] = useState(false)

  // Confirm delete dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    type: 'checklist' | 'item'
    targetId: string
    title: string
    checklistId?: string
  }>({
    open: false,
    type: 'item',
    targetId: '',
    title: '',
  })

  // Action loading indicators (item toggle or move)
  const [operatingItemId, setOperatingItemId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!project?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getChecklistsByProject(project.id)
      setChecklists(data)
    } catch (err: any) {
      console.error('Erro ao carregar checklists:', err)
      setLoadError('Não foi possível carregar os checklists. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [project?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Aggregate stats across all checklists of this project
  const allItems = checklists.flatMap((c) => c.items)
  const totalItems = allItems.length
  const completedItems = allItems.filter((i) => i.concluido).length
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  const logAudit = async (actionDesc: string) => {
    const tenantId = user?.tenantId || (checklists[0]?.tenantId ?? '')
    try {
      await createAuditLog({
        userName: user?.name || 'Usuário',
        actionType: 'Editou card',
        description: actionDesc,
        projectTitle: project.title,
        tenantId,
      })
      if (onHistoryUpdate) {
        onHistoryUpdate()
      }
    } catch (err) {
      console.error('Falha ao registrar histórico de auditoria:', err)
    }
  }

  // --- Handlers for Checklist ---
  const handleCreateChecklist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newChecklistTitle.trim()) {
      toast.error('Informe um título para o checklist.')
      return
    }

    const tenantId = user?.tenantId || ''
    setSubmittingChecklist(true)
    try {
      const created = await createChecklist({
        titulo: newChecklistTitle.trim(),
        projetoId: project.id,
        tenantId,
        ordem: checklists.length,
      })
      setChecklists((prev) => [...prev, created])
      await logAudit(`Criou o checklist "${created.titulo}"`)
      toast.success('Checklist criado com sucesso!')
      setNewChecklistTitle('')
      setIsCreatingChecklist(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmittingChecklist(false)
    }
  }

  const handleSaveChecklistTitle = async (checklistId: string) => {
    if (!editingChecklistTitle.trim()) {
      toast.error('O título do checklist não pode ficar vazio.')
      return
    }
    const target = checklists.find((c) => c.id === checklistId)
    if (!target) return

    setSavingChecklistTitle(true)
    try {
      const updated = await updateChecklist(checklistId, {
        titulo: editingChecklistTitle.trim(),
      })
      setChecklists((prev) =>
        prev.map((c) => (c.id === checklistId ? { ...c, titulo: updated.titulo } : c)),
      )
      await logAudit(`Renomeou o checklist "${target.titulo}" para "${updated.titulo}"`)
      toast.success('Título do checklist atualizado!')
      setEditingChecklistId(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingChecklistTitle(false)
    }
  }

  const handleConfirmDelete = async () => {
    const { type, targetId, title: targetTitle, checklistId } = deleteDialog
    setDeleteDialog((prev) => ({ ...prev, open: false }))

    if (type === 'checklist') {
      try {
        await deleteChecklist(targetId)
        setChecklists((prev) => prev.filter((c) => c.id !== targetId))
        await logAudit(`Excluiu o checklist "${targetTitle}"`)
        toast.success('Checklist excluído com sucesso.')
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    } else if (type === 'item') {
      try {
        await deleteChecklistItem(targetId)
        setChecklists((prev) =>
          prev.map((c) =>
            c.id === checklistId
              ? { ...c, items: c.items.filter((item) => item.id !== targetId) }
              : c,
          ),
        )
        await logAudit(`Excluiu o item "${targetTitle}"`)
        toast.success('Item excluído com sucesso.')
      } catch (err) {
        toast.error(getErrorMessage(err))
      }
    }
  }

  // --- Handlers for Checklist Items ---
  const handleCreateItem = async (checklistId: string, e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) {
      toast.error('Informe o texto do item.')
      return
    }

    const checklist = checklists.find((c) => c.id === checklistId)
    if (!checklist) return

    setSubmittingItem(true)
    try {
      const created = await createChecklistItem({
        texto: newItemText.trim(),
        checklistId,
        projetoId: project.id,
        tenantId: user?.tenantId || checklist.tenantId,
        concluido: false,
        responsibleUserId: newItemResponsible !== 'none' ? newItemResponsible : undefined,
        prazo: newItemDeadline || undefined,
        ordem: checklist.items.length,
      })

      // Resolve responsible user name if available
      if (created.responsibleUserId && !created.responsibleUserName) {
        const u = users.find((usr) => usr.id === created.responsibleUserId)
        if (u) created.responsibleUserName = u.name
      }

      setChecklists((prev) =>
        prev.map((c) => (c.id === checklistId ? { ...c, items: [...c.items, created] } : c)),
      )

      await logAudit(`Adicionou o item "${created.texto}" no checklist "${checklist.titulo}"`)
      toast.success('Item adicionado!')
      setNewItemText('')
      setNewItemResponsible('none')
      setNewItemDeadline('')
      setAddingItemChecklistId(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmittingItem(false)
    }
  }

  const handleToggleItem = async (checklistId: string, item: ChecklistItem) => {
    const nextConcluido = !item.concluido
    const targetChecklist = checklists.find((c) => c.id === checklistId)
    setOperatingItemId(item.id)

    // Optimistic UI update
    setChecklists((prev) =>
      prev.map((c) =>
        c.id === checklistId
          ? {
              ...c,
              items: c.items.map((i) =>
                i.id === item.id ? { ...i, concluido: nextConcluido } : i,
              ),
            }
          : c,
      ),
    )

    try {
      await updateChecklistItem(item.id, { concluido: nextConcluido })
      const actionName = nextConcluido ? 'Concluiu' : 'Reabriu'
      await logAudit(
        `${actionName} o item "${item.texto}" no checklist "${targetChecklist?.titulo || 'Checklist'}"`,
      )
    } catch (err) {
      // Rollback on error
      setChecklists((prev) =>
        prev.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: c.items.map((i) =>
                  i.id === item.id ? { ...i, concluido: item.concluido } : i,
                ),
              }
            : c,
        ),
      )
      toast.error(getErrorMessage(err))
    } finally {
      setOperatingItemId(null)
    }
  }

  const startEditItem = (item: ChecklistItem) => {
    setEditingItemId(item.id)
    setEditItemText(item.texto)
    setEditItemResponsible(item.responsibleUserId || 'none')
    setEditItemDeadline(item.prazo || '')
  }

  const handleSaveItemEdit = async (checklistId: string, itemId: string) => {
    if (!editItemText.trim()) {
      toast.error('O texto do item não pode ficar vazio.')
      return
    }

    setSavingItemEdit(true)
    try {
      const updated = await updateChecklistItem(itemId, {
        texto: editItemText.trim(),
        responsibleUserId: editItemResponsible !== 'none' ? editItemResponsible : null,
        prazo: editItemDeadline || null,
      })

      if (updated.responsibleUserId && !updated.responsibleUserName) {
        const u = users.find((usr) => usr.id === updated.responsibleUserId)
        if (u) updated.responsibleUserName = u.name
      }

      setChecklists((prev) =>
        prev.map((c) =>
          c.id === checklistId
            ? {
                ...c,
                items: c.items.map((i) => (i.id === itemId ? { ...i, ...updated } : i)),
              }
            : c,
        ),
      )

      await logAudit(`Alterou o item "${updated.texto}"`)
      toast.success('Item atualizado!')
      setEditingItemId(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSavingItemEdit(false)
    }
  }

  const handleMoveItem = async (
    checklistId: string,
    itemIndex: number,
    direction: 'up' | 'down',
  ) => {
    const checklist = checklists.find((c) => c.id === checklistId)
    if (!checklist) return
    const targetIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1
    if (targetIndex < 0 || targetIndex >= checklist.items.length) return

    const itemsCopy = [...checklist.items]
    const itemA = itemsCopy[itemIndex]
    const itemB = itemsCopy[targetIndex]

    // Swap in array
    itemsCopy[itemIndex] = itemB
    itemsCopy[targetIndex] = itemA

    // Assign new orders
    const updatedItems = itemsCopy.map((item, idx) => ({ ...item, ordem: idx }))

    // Optimistic UI
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, items: updatedItems } : c)),
    )

    try {
      await Promise.all([
        updateChecklistItem(itemA.id, { ordem: targetIndex }),
        updateChecklistItem(itemB.id, { ordem: itemIndex }),
      ])
      await logAudit(`Reorganizou os itens do checklist "${checklist.titulo}"`)
    } catch (err) {
      toast.error(getErrorMessage(err))
      loadData()
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-2" />
        <span className="text-xs">Carregando checklist...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center space-y-2">
        <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
        <p className="text-xs text-red-700">{loadError}</p>
        <Button variant="outline" size="sm" onClick={loadData} className="text-xs">
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Overview Progress Header */}
      <div className="p-3.5 bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/80 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[#1c2a3e]">
            <CheckSquare className="w-4 h-4 text-blue-600" />
            <span>Progresso Geral</span>
          </div>
          <Badge
            variant="outline"
            className={
              completionPercentage === 100
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold'
                : 'bg-white text-slate-700 font-semibold'
            }
          >
            {completedItems} de {totalItems} concluído{totalItems === 1 ? '' : 's'} (
            {completionPercentage}%)
          </Badge>
        </div>
        <Progress value={completionPercentage} className="h-2 bg-slate-200" />
      </div>

      {/* Checklists List */}
      <div className="space-y-4">
        {checklists.map((checklist) => {
          const cTotal = checklist.items.length
          const cDone = checklist.items.filter((i) => i.concluido).length
          const cPct = cTotal > 0 ? Math.round((cDone / cTotal) * 100) : 0

          return (
            <div
              key={checklist.id}
              className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-3 transition-shadow hover:shadow-sm"
            >
              {/* Checklist Title & Actions */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                {editingChecklistId === checklist.id ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <Input
                      value={editingChecklistTitle}
                      onChange={(e) => setEditingChecklistTitle(e.target.value)}
                      className="h-8 text-xs font-semibold"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleSaveChecklistTitle(checklist.id)}
                      disabled={savingChecklistTitle}
                      className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 shrink-0"
                    >
                      {savingChecklistTitle ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingChecklistId(null)}
                      disabled={savingChecklistTitle}
                      className="h-8 w-8 text-gray-500 hover:bg-gray-100 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-[#1c2a3e] truncate">
                      {checklist.titulo}
                    </h4>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0">
                      ({cDone}/{cTotal})
                    </span>
                    {cTotal > 0 && (
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                        {cPct}%
                      </span>
                    )}
                  </div>
                )}

                {editingChecklistId !== checklist.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingChecklistId(checklist.id)
                        setEditingChecklistTitle(checklist.titulo)
                      }}
                      className="h-7 w-7 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                      title="Editar título do checklist"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setDeleteDialog({
                          open: true,
                          type: 'checklist',
                          targetId: checklist.id,
                          title: checklist.titulo,
                        })
                      }
                      className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      title="Excluir checklist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                {checklist.items.length === 0 && addingItemChecklistId !== checklist.id && (
                  <div className="py-4 text-center text-xs text-gray-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                    Nenhum item adicionado a este checklist ainda.
                  </div>
                )}

                {checklist.items.map((item, idx) => {
                  const isEditing = editingItemId === item.id
                  const isOperating = operatingItemId === item.id

                  if (isEditing) {
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2.5 text-xs animate-fade-in"
                      >
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700">
                            Texto do item
                          </label>
                          <Input
                            value={editItemText}
                            onChange={(e) => setEditItemText(e.target.value)}
                            className="mt-1 h-8 text-xs bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-gray-400" /> Responsável
                            </label>
                            <Select
                              value={editItemResponsible}
                              onValueChange={setEditItemResponsible}
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Não atribuído</SelectItem>
                                {users.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-gray-400" /> Prazo
                            </label>
                            <Input
                              type="date"
                              value={editItemDeadline}
                              onChange={(e) => setEditItemDeadline(e.target.value)}
                              className="mt-1 h-8 text-xs bg-white"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingItemId(null)}
                            disabled={savingItemEdit}
                            className="h-7 text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleSaveItemEdit(checklist.id, item.id)}
                            disabled={savingItemEdit}
                            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {savingItemEdit ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : null}
                            Salvar Alteração
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={item.id}
                      className={`group flex items-start justify-between gap-2 p-2 rounded-lg border transition-all ${
                        item.concluido
                          ? 'bg-slate-50/70 border-slate-200/60 text-gray-400'
                          : 'bg-white border-slate-200/90 text-slate-800 hover:border-blue-200 hover:bg-blue-50/20'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(checklist.id, item)}
                          disabled={isOperating}
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            item.concluido
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 hover:border-blue-500 bg-white'
                          }`}
                          title={item.concluido ? 'Marcar como pendente' : 'Marcar como concluído'}
                        >
                          {isOperating ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                          ) : item.concluido ? (
                            <Check className="w-3 h-3 stroke-[3]" />
                          ) : null}
                        </button>

                        <div className="flex-1 min-w-0 space-y-1">
                          <p
                            className={`text-xs font-medium leading-snug break-words ${
                              item.concluido ? 'line-through text-gray-400' : 'text-slate-800'
                            }`}
                          >
                            {item.texto}
                          </p>

                          {(item.responsibleUserName || item.prazo) && (
                            <div className="flex items-center gap-2 flex-wrap text-[10px] text-gray-500">
                              {item.responsibleUserName && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                  <User className="w-2.5 h-2.5 text-slate-500" />
                                  {item.responsibleUserName}
                                </span>
                              )}
                              {item.prazo && (
                                <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                  <Calendar className="w-2.5 h-2.5 text-slate-500" />
                                  {formatDate(item.prazo)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Reorder and Edit/Delete Actions */}
                      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => handleMoveItem(checklist.id, idx, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 text-gray-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-gray-400"
                            title="Mover item para cima"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveItem(checklist.id, idx, 'down')}
                            disabled={idx === checklist.items.length - 1}
                            className="p-0.5 text-gray-400 hover:text-slate-700 disabled:opacity-20 disabled:hover:text-gray-400"
                            title="Mover item para baixo"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditItem(item)}
                          className="h-6 w-6 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          title="Editar item"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              type: 'item',
                              targetId: item.id,
                              title: item.texto,
                              checklistId: checklist.id,
                            })
                          }
                          className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          title="Excluir item"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Add Item Form / Button */}
              {addingItemChecklistId === checklist.id ? (
                <form
                  onSubmit={(e) => handleCreateItem(checklist.id, e)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs animate-fade-in"
                >
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700">Novo Item</label>
                    <Input
                      value={newItemText}
                      onChange={(e) => setNewItemText(e.target.value)}
                      placeholder="Descreva a tarefa ou atividade..."
                      className="mt-1 h-8 text-xs bg-white"
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <User className="w-3 h-3 text-gray-400" /> Responsável
                      </label>
                      <Select value={newItemResponsible} onValueChange={setNewItemResponsible}>
                        <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Não atribuído</SelectItem>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" /> Prazo
                      </label>
                      <Input
                        type="date"
                        value={newItemDeadline}
                        onChange={(e) => setNewItemDeadline(e.target.value)}
                        className="mt-1 h-8 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAddingItemChecklistId(null)
                        setNewItemText('')
                        setNewItemResponsible('none')
                        setNewItemDeadline('')
                      }}
                      disabled={submittingItem}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submittingItem}
                      className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {submittingItem ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="w-3 h-3 mr-1" />
                      )}
                      Adicionar Item
                    </Button>
                  </div>
                </form>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingItemChecklistId(checklist.id)
                    setNewItemText('')
                    setNewItemResponsible('none')
                    setNewItemDeadline('')
                  }}
                  className="w-full text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 justify-start h-8"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Adicionar item a este checklist
                </Button>
              )}
            </div>
          )
        })}
      </div>

      {/* Create New Checklist Section */}
      {isCreatingChecklist ? (
        <form
          onSubmit={handleCreateChecklist}
          className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs animate-fade-in"
        >
          <div>
            <label className="text-xs font-semibold text-[#1c2a3e]">Título do Novo Checklist</label>
            <Input
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              placeholder="Ex: Documentos Iniciais, Validações Jurídicas..."
              className="mt-1 text-xs bg-white"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCreatingChecklist(false)
                setNewChecklistTitle('')
              }}
              disabled={submittingChecklist}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingChecklist}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              {submittingChecklist ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              )}
              Criar Checklist
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsCreatingChecklist(true)}
          className="w-full text-xs text-[#1c2a3e] border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/30 h-10"
        >
          <Plus className="w-4 h-4 mr-1.5 text-blue-600" />
          Criar Novo Checklist
        </Button>
      )}

      {/* Confirmation Dialog for Deletion */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-[#1c2a3e]">
              Confirmar exclusão
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-gray-500 leading-relaxed">
              {deleteDialog.type === 'checklist' ? (
                <>
                  Tem certeza que deseja excluir o checklist{' '}
                  <strong className="text-slate-700">"{deleteDialog.title}"</strong> e todos os seus
                  itens? Esta ação não pode ser desfeita.
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir o item{' '}
                  <strong className="text-slate-700">"{deleteDialog.title}"</strong>? Esta ação não
                  pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
