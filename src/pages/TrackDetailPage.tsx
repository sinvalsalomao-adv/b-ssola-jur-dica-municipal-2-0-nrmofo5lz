import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  FileQuestion,
  Plus,
  Pencil,
  Trash2,
  Copy,
  ListChecks,
  Loader2,
  GripVertical,
  Youtube,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
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
import { extractYouTubeId } from '@/lib/youtube'
import { reorderAulas } from '@/services/education'
import { cn } from '@/lib/utils'
import { LessonFormModal } from '@/components/LessonFormModal'
import { QuizManagementModal } from '@/components/QuizManagementModal'
import { CopyLessonDialog } from '@/components/CopyLessonDialog'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { AulaRecord } from '@/types/education'

export default function TrackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tracks, toggleLesson, isLessonCompleted, getCompletedCount, getQuizState, deleteLesson } =
    useEducation()

  const track = tracks.find((t) => t.id === id)

  const [lessonModalOpen, setLessonModalOpen] = useState(false)
  const [editingLesson, setEditingLesson] = useState<AulaRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AulaRecord | null>(null)
  const [copyTarget, setCopyTarget] = useState<AulaRecord | null>(null)
  const [quizModalOpen, setQuizModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [localLessons, setLocalLessons] = useState<AulaRecord[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    if (track && !isDragging) {
      setLocalLessons([...track.lessons].sort((a, b) => a.ordem - b.ordem))
    }
  }, [track, isDragging])

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-gray-500">Trilha não encontrada.</p>
        <Button onClick={() => navigate('/educacao')} variant="outline">
          Voltar para Educação
        </Button>
      </div>
    )
  }

  const { completed, total } = getCompletedCount(track.id)
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0
  const quizState = getQuizState(track.id)

  const handleOpenCreate = () => {
    setEditingLesson(null)
    setLessonModalOpen(true)
  }

  const handleOpenEdit = (lesson: AulaRecord) => {
    setEditingLesson(lesson)
    setLessonModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteLesson(deleteTarget.id)
      toast.success('Aula excluída com sucesso!')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
    setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      setIsDragging(false)
      return
    }

    const newLessons = [...localLessons]
    const [moved] = newLessons.splice(draggedIndex, 1)
    newLessons.splice(index, 0, moved)

    setLocalLessons(newLessons)
    setDraggedIndex(null)
    setDragOverIndex(null)
    setIsDragging(false)

    setReordering(true)
    try {
      await reorderAulas(newLessons.map((l) => l.id))
      toast.success('Ordem das aulas atualizada com sucesso!')
    } catch (err) {
      toast.error('Erro ao atualizar a ordem das aulas.')
      setLocalLessons([...track.lessons].sort((a, b) => a.ordem - b.ordem))
    } finally {
      setReordering(false)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    setIsDragging(false)
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3.5 min-w-0">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/educacao')}
            className="h-9 w-9 border-slate-300 shrink-0"
            aria-label="Voltar para a listagem de trilhas"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-[#1c2a3e] tracking-tight truncate">
              {track.titulo}
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5 line-clamp-2">
              {track.descricao}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuizModalOpen(true)}
            className="gap-1.5 text-xs h-9 border-slate-300"
            aria-label="Gerenciar questões do quiz"
          >
            <ListChecks className="w-4 h-4" aria-hidden="true" />
            Gerenciar Quiz
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5 text-xs h-9 shadow-sm"
            aria-label="Adicionar aula a esta trilha"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Adicionar Aula
          </Button>
        </div>
      </div>

      <Card className="bg-white border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#1c2a3e]">Progresso da Trilha</span>
            <span className="text-sm font-bold text-[#3b82f6]">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2.5 bg-gray-100" />
          <p className="text-xs text-gray-400 mt-1.5">
            {completed} de {total} aulas concluídas
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-[#1c2a3e]">Aulas</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuizModalOpen(true)}
            className="gap-2"
          >
            <ListChecks className="w-4 h-4" /> Gerenciar Quiz
          </Button>
          <Button
            onClick={handleOpenCreate}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" /> Adicionar Aula
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {localLessons.length === 0 ? (
          <Card className="bg-white border border-gray-100 shadow-sm">
            <CardContent className="p-8 text-center">
              <p className="text-sm text-gray-400">
                Nenhuma aula cadastrada. Clique em &quot;Adicionar Aula&quot; para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          localLessons.map((lesson, index) => {
            const done = isLessonCompleted(track.id, lesson.id)
            const videoId = extractYouTubeId(lesson.urlVideo)
            return (
              <Card
                key={lesson.id}
                draggable={!reordering}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'bg-white border shadow-sm overflow-hidden transition-all duration-200 cursor-grab active:cursor-grabbing',
                  done ? 'border-emerald-200' : 'border-gray-100',
                  draggedIndex === index && 'opacity-40',
                  dragOverIndex === index && 'border-t-[3px] border-t-[#3b82f6]',
                )}
              >
                <CardContent className="p-0">
                  <div className="p-4 flex items-start gap-3 border-b border-gray-50">
                    <div className="mt-0.5 text-gray-300 hover:text-[#3b82f6] transition-colors">
                      <GripVertical className="w-5 h-5" />
                    </div>
                    <div className="mt-0.5">
                      {done ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-[#1c2a3e]">{lesson.titulo}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] text-gray-500">
                          Ordem: {lesson.ordem}
                        </Badge>
                        {done && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">
                            Concluído
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-600 hover:text-[#1c2a3e] focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                        onClick={() => handleOpenEdit(lesson)}
                        title="Editar Aula"
                        aria-label={`Editar aula ${lesson.titulo}`}
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#3b82f6] focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                        onClick={() => setCopyTarget(lesson)}
                        title="Copiar para outra Trilha"
                        aria-label={`Copiar aula ${lesson.titulo} para outra trilha`}
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500"
                        onClick={() => setDeleteTarget(lesson)}
                        title="Excluir Aula"
                        aria-label={`Excluir aula ${lesson.titulo}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {videoId ? (
                    <div className="p-4 bg-gray-50">
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        <iframe
                          className="absolute top-0 left-0 w-full h-full rounded-lg"
                          src={`https://www.youtube.com/embed/${videoId}`}
                          title={lesson.titulo}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 text-center">
                      <Youtube className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Nenhum vídeo disponível</p>
                    </div>
                  )}

                  <div className="p-4 pt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant={done ? 'outline' : 'default'}
                      onClick={() => toggleLesson(track.id, lesson.id)}
                      className={
                        done
                          ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                          : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white'
                      }
                    >
                      {done ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" /> Concluído
                        </>
                      ) : (
                        'Marcar como Concluído'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <div className="pt-2">
        <Button
          onClick={() => navigate(`/educacao/trilha/${track.id}/quiz`)}
          className="w-full bg-[#1c2a3e] hover:bg-[#2a3f5f] text-white gap-2"
        >
          <FileQuestion className="w-4 h-4" />
          {quizState.result === 'approved' ? 'Refazer Quiz' : 'Fazer Quiz'}
        </Button>
      </div>

      <LessonFormModal
        open={lessonModalOpen}
        onOpenChange={setLessonModalOpen}
        currentTrackId={track.id}
        lesson={editingLesson}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1c2a3e]">
              Excluir Aula
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              Tem certeza que deseja excluir a aula &quot;{deleteTarget?.titulo}&quot;? Esta ação é
              irreversível.
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

      <CopyLessonDialog
        open={!!copyTarget}
        onOpenChange={(open) => !open && setCopyTarget(null)}
        lesson={copyTarget}
        currentTrackId={track.id}
      />

      <QuizManagementModal
        open={quizModalOpen}
        onOpenChange={setQuizModalOpen}
        trackId={track.id}
      />
    </div>
  )
}
