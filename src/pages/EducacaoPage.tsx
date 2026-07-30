import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  ArrowLeft,
  Clock,
  PlayCircle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import type { TrackWithLessons } from '@/types/education'

export default function EducacaoPage() {
  const navigate = useNavigate()
  const { tracksWithProgress, createTrack, updateTrack, deleteTrack } = useEducation()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTrack, setEditingTrack] = useState<TrackWithLessons | null>(null)
  const [trackToDelete, setTrackToDelete] = useState<TrackWithLessons | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ordem, setOrdem] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const cardColors = [
    { bg: 'bg-blue-50', text: 'text-[#3b82f6]' },
    { bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { bg: 'bg-violet-50', text: 'text-violet-600' },
  ]

  const handleOpenCreateModal = () => {
    setEditingTrack(null)
    setTitulo('')
    setDescricao('')
    setOrdem(tracksWithProgress.length + 1)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (track: TrackWithLessons) => {
    setEditingTrack(track)
    setTitulo(track.titulo)
    setDescricao(track.descricao)
    setOrdem(track.ordem || 1)
    setIsModalOpen(true)
  }

  const handleSubmitTrack = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulo.trim()) {
      toast.error('O título da trilha é obrigatório.')
      return
    }

    try {
      setSubmitting(true)
      if (editingTrack) {
        await updateTrack(editingTrack.id, {
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          ordem: Number(ordem) || 1,
        })
        toast.success('Trilha atualizada com sucesso!')
      } else {
        await createTrack({
          titulo: titulo.trim(),
          descricao: descricao.trim(),
          ordem: Number(ordem) || 1,
        })
        toast.success('Trilha criada com sucesso!')
      }
      setIsModalOpen(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!trackToDelete) return
    try {
      setDeleting(true)
      await deleteTrack(trackToDelete.id)
      toast.success('Trilha excluída com sucesso!')
      setTrackToDelete(null)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-[#1c2a3e]">Módulo de Educação e Capacitação</h2>
            <p className="text-sm text-gray-500">
              Trilhas de aprendizagem jurídicas e administrativas para servidores municipais.
            </p>
          </div>
        </div>
        <Button
          onClick={handleOpenCreateModal}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Adicionar Trilha
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tracksWithProgress.map((track, index) => {
          const colors = cardColors[index % cardColors.length]
          return (
            <Card
              key={track.id}
              className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden relative group"
            >
              <CardContent className="p-0">
                <div className={`h-28 ${colors.bg} flex items-center justify-center relative`}>
                  <GraduationCap className={`w-12 h-12 ${colors.text}`} />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {track.progress === 100 && (
                      <Badge className="bg-emerald-500 text-white border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-600 hover:text-[#1c2a3e] bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenEditModal(track)
                      }}
                      title="Editar Trilha"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white"
                      onClick={(e) => {
                        e.stopPropagation()
                        setTrackToDelete(track)
                      }}
                      title="Excluir Trilha"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h3 className="font-bold text-base text-[#1c2a3e] leading-snug min-h-[3rem]">
                      {track.titulo}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{track.descricao}</p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="w-3.5 h-3.5" />
                      {track.totalLessons} aulas
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />~{track.totalLessons * 15} min
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 font-medium">Progresso</span>
                      <span className="font-bold text-[#1c2a3e]">{track.progress}%</span>
                    </div>
                    <Progress value={track.progress} className="h-2 bg-gray-100" />
                    <p className="text-[11px] text-gray-400">
                      {track.completedCount} de {track.totalLessons} aulas concluídas
                    </p>
                  </div>

                  <Button
                    onClick={() => navigate(`/educacao/trilha/${track.id}`)}
                    className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
                  >
                    Acessar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Create / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px] bg-white rounded-xl shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-[#1c2a3e]">
              {editingTrack ? 'Editar Trilha' : 'Nova Trilha de Aprendizagem'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitTrack} className="space-y-4 py-2">
            <div>
              <Label htmlFor="titulo" className="text-xs font-semibold text-gray-700">
                Título da Trilha *
              </Label>
              <Input
                id="titulo"
                placeholder="Ex: Lei de Licitações e Contratos"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="mt-1 text-sm"
                required
              />
            </div>

            <div>
              <Label htmlFor="descricao" className="text-xs font-semibold text-gray-700">
                Descrição
              </Label>
              <Textarea
                id="descricao"
                placeholder="Resumo do conteúdo e objetivos da trilha..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="mt-1 min-h-[80px] text-sm"
              />
            </div>

            <div>
              <Label htmlFor="ordem" className="text-xs font-semibold text-gray-700">
                Ordem de Exibição
              </Label>
              <Input
                id="ordem"
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
                onClick={() => setIsModalOpen(false)}
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
                {editingTrack ? 'Salvar Alterações' : 'Criar Trilha'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={!!trackToDelete} onOpenChange={(open) => !open && setTrackToDelete(null)}>
        <AlertDialogContent className="bg-white rounded-xl shadow-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold text-[#1c2a3e]">
              Excluir Trilha de Aprendizagem
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              Tem certeza que deseja excluir a trilha "{trackToDelete?.titulo}"? Esta ação é
              irreversível e removerá a trilha do sistema.
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
    </div>
  )
}
