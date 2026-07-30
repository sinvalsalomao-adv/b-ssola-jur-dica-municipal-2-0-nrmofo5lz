import { useState, useEffect, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEducation } from '@/context/EducationContext'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import type { AulaRecord } from '@/types/education'

interface LessonFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentTrackId: string
  lesson: AulaRecord | null
}

export function LessonFormModal({
  open,
  onOpenChange,
  currentTrackId,
  lesson,
}: LessonFormModalProps) {
  const { tracks, createLesson, updateLesson } = useEducation()
  const [titulo, setTitulo] = useState('')
  const [urlVideo, setUrlVideo] = useState('')
  const [ordem, setOrdem] = useState(1)
  const [trilhaId, setTrilhaId] = useState(currentTrackId)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (lesson) {
      setTitulo(lesson.titulo)
      setUrlVideo(lesson.urlVideo)
      setOrdem(lesson.ordem)
      setTrilhaId(lesson.trilhaId || currentTrackId)
    } else {
      setTitulo('')
      setUrlVideo('')
      const currentTrack = tracks.find((t) => t.id === currentTrackId)
      setOrdem(currentTrack ? currentTrack.lessons.length + 1 : 1)
      setTrilhaId(currentTrackId)
    }
  }, [open, lesson, currentTrackId, tracks])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!titulo.trim() || !urlVideo.trim()) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }
    setSubmitting(true)
    try {
      const data = {
        trilhaId,
        titulo: titulo.trim(),
        urlVideo: urlVideo.trim(),
        ordem: Number(ordem) || 1,
      }
      if (lesson) {
        await updateLesson(lesson.id, data)
        toast.success('Aula atualizada com sucesso!')
      } else {
        await createLesson(data)
        toast.success('Aula criada com sucesso!')
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">
            {lesson ? 'Editar Aula' : 'Adicionar Aula'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="aula-titulo" className="text-xs font-semibold text-gray-700">
              Título *
            </Label>
            <Input
              id="aula-titulo"
              placeholder="Ex: Aula 1: Introdução"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-1 text-sm"
              required
            />
          </div>
          <div>
            <Label htmlFor="aula-url" className="text-xs font-semibold text-gray-700">
              URL do Vídeo do YouTube *
            </Label>
            <Input
              id="aula-url"
              type="url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={urlVideo}
              onChange={(e) => setUrlVideo(e.target.value)}
              className="mt-1 text-sm"
              required
            />
          </div>
          <div>
            <Label htmlFor="aula-trilha" className="text-xs font-semibold text-gray-700">
              Trilha
            </Label>
            <Select value={trilhaId} onValueChange={setTrilhaId}>
              <SelectTrigger className="mt-1 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="aula-ordem" className="text-xs font-semibold text-gray-700">
              Ordem
            </Label>
            <Input
              id="aula-ordem"
              type="number"
              min={1}
              value={ordem}
              onChange={(e) => setOrdem(Number(e.target.value))}
              className="mt-1 text-sm"
            />
          </div>
          <DialogFooter className="pt-4 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {lesson ? 'Salvar' : 'Criar Aula'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
