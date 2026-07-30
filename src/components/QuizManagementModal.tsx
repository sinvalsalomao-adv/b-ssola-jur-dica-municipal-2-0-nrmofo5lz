import { useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2, ListChecks, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
import { useEducation } from '@/context/EducationContext'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { QuizQuestionForm } from '@/components/QuizQuestionForm'
import type { QuizPergunta } from '@/types/education'

interface QuizManagementModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trackId: string
}

export function QuizManagementModal({ open, onOpenChange, trackId }: QuizManagementModalProps) {
  const { getQuizPerguntasForTrack, createQuizQuestion, updateQuizQuestion, deleteQuizQuestion } =
    useEducation()
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<QuizPergunta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<QuizPergunta | null>(null)
  const [deleting, setDeleting] = useState(false)

  const questions = getQuizPerguntasForTrack(trackId)

  const handleAdd = () => {
    setEditing(null)
    setView('form')
  }
  const handleEdit = (q: QuizPergunta) => {
    setEditing(q)
    setView('form')
  }
  const handleBack = () => {
    setView('list')
    setEditing(null)
  }

  const handleSubmit = async (data: {
    pergunta: string
    opcoes: string[]
    respostaCorreta: string
    ordem: number
  }) => {
    try {
      if (editing) {
        await updateQuizQuestion(editing.id, data)
        toast.success('Pergunta atualizada!')
      } else {
        await createQuizQuestion({ ...data, trilhaId: trackId })
        toast.success('Pergunta criada!')
      }
      setView('list')
      setEditing(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteQuizQuestion(deleteTarget.id)
      toast.success('Pergunta excluída!')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setView('list')
      setEditing(null)
    }
    onOpenChange(v)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-white rounded-xl shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1c2a3e] flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[#3b82f6]" />
              Gerenciar Quiz
            </DialogTitle>
          </DialogHeader>
          {view === 'list' ? (
            <div className="space-y-3 py-2">
              <Button
                onClick={handleAdd}
                className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
              >
                <Plus className="w-4 h-4" /> Adicionar Pergunta
              </Button>
              {questions.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  Nenhuma pergunta cadastrada. Clique em "Adicionar Pergunta" para começar.
                </p>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} className="rounded-lg border border-gray-100 p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="w-6 h-6 rounded-full bg-[#1c2a3e] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <p className="font-semibold text-sm text-[#1c2a3e]">{q.pergunta}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-gray-600"
                          onClick={() => handleEdit(q)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600"
                          onClick={() => setDeleteTarget(q)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="ml-8 space-y-1">
                      {q.opcoes.map((opt, oi) => (
                        <div
                          key={oi}
                          className={`text-xs px-2 py-1 rounded ${
                            opt === q.respostaCorreta
                              ? 'bg-emerald-50 text-emerald-700 font-medium'
                              : 'text-gray-600'
                          }`}
                        >
                          {opt === q.respostaCorreta && (
                            <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          )}
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="py-2">
              <QuizQuestionForm initial={editing} onSubmit={handleSubmit} onBack={handleBack} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1c2a3e]">
              Excluir Pergunta
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              Tem certeza que deseja excluir esta pergunta? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
