import { useState, useEffect } from 'react'
import { Loader2, Copy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

interface CopyLessonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: AulaRecord | null
  currentTrackId: string
}

export function CopyLessonDialog({
  open,
  onOpenChange,
  lesson,
  currentTrackId,
}: CopyLessonDialogProps) {
  const { tracks, copyLessonToTrack } = useEducation()
  const [targetTrackId, setTargetTrackId] = useState('')
  const [copying, setCopying] = useState(false)

  const otherTracks = tracks.filter((t) => t.id !== currentTrackId)

  useEffect(() => {
    if (open) {
      setTargetTrackId('')
      setCopying(false)
    }
  }, [open])

  const handleConfirm = async () => {
    if (!targetTrackId || !lesson) return
    setCopying(true)
    try {
      await copyLessonToTrack(lesson.id, targetTrackId)
      toast.success('Aula copiada com sucesso!')
      onOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-white rounded-xl shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e] flex items-center gap-2">
            <Copy className="w-5 h-5 text-[#3b82f6]" />
            Copiar para outra Trilha
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Selecione a trilha de destino para criar uma cópia da aula "{lesson?.titulo}".
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="text-xs font-semibold text-gray-700">Trilha de Destino</Label>
          <Select value={targetTrackId} onValueChange={setTargetTrackId}>
            <SelectTrigger className="mt-1 text-sm">
              <SelectValue placeholder="Selecione a trilha de destino" />
            </SelectTrigger>
            <SelectContent>
              {otherTracks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {otherTracks.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">Não há outras trilhas disponíveis.</p>
          )}
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={copying}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!targetTrackId || copying || otherTracks.length === 0}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
          >
            {copying && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Copiar Aula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
