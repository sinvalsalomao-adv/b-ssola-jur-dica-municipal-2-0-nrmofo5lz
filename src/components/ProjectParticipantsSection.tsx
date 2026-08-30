import React, { useState, useEffect } from 'react'
import { Plus, X, User, Users, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Project, ProjectParticipant } from '@/types/project'
import { useAuth } from '@/context/AuthContext'
import {
  getProjectParticipants,
  addProjectParticipant,
  removeProjectParticipant,
} from '@/services/participants'
import { getAvatarUrl } from '@/services/profile'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface Props {
  project: Project
  tenantUsers: { id: string; name: string; email?: string; role?: string; avatar?: string | null }[]
  onParticipantsChange?: (participants: ProjectParticipant[]) => void
  onHistoryUpdate?: () => void
}

export const ProjectParticipantsSection: React.FC<Props> = ({
  project,
  tenantUsers,
  onParticipantsChange,
  onHistoryUpdate,
}) => {
  const { user } = useAuth()
  const [participants, setParticipants] = useState<ProjectParticipant[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')

  const effectiveTenant = project.tenantId || user?.tenantId || ''

  const loadParticipants = async () => {
    if (!project.id) return
    setLoading(true)
    try {
      const list = await getProjectParticipants(project.id, effectiveTenant || undefined)
      setParticipants(list)
      if (onParticipantsChange) {
        onParticipantsChange(list)
      }
    } catch (err) {
      console.error('Erro ao carregar participantes:', err)
      toast.error('Não foi possível carregar os participantes do projeto.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParticipants()
  }, [project.id])

  // Filtrar usuários que ainda não são participantes
  const availableUsers = tenantUsers.filter(
    (u) => !participants.some((p) => p.userId === u.id) && u.id !== project.responsibleUserId,
  )

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast.error('Selecione um usuário para adicionar como participante.')
      return
    }
    if (!effectiveTenant) {
      toast.error('Prefeitura do projeto não identificada.')
      return
    }

    setAdding(true)
    try {
      const newPart = await addProjectParticipant({
        projectId: project.id,
        userId: selectedUserId,
        tenantId: effectiveTenant,
        currentUserName: user?.name || 'Usuário',
        projectTitle: project.title,
        addedByUserId: user?.id,
      })
      const updated = [...participants, newPart]
      setParticipants(updated)
      if (onParticipantsChange) {
        onParticipantsChange(updated)
      }
      setSelectedUserId('')
      toast.success('Participante adicionado com sucesso!')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao adicionar participante.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveParticipant = async (participant: ProjectParticipant) => {
    try {
      await removeProjectParticipant({
        participantId: participant.id,
        projectId: project.id,
        participantName: participant.userName,
        tenantId: effectiveTenant,
        currentUserName: user?.name || 'Usuário',
        projectTitle: project.title,
      })
      const updated = participants.filter((p) => p.id !== participant.id)
      setParticipants(updated)
      if (onParticipantsChange) {
        onParticipantsChange(updated)
      }
      toast.success('Participante removido.')
      if (onHistoryUpdate) onHistoryUpdate()
    } catch (err: any) {
      toast.error(getErrorMessage(err) || 'Erro ao remover participante.')
    }
  }

  return (
    <div className="space-y-3 pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-blue-600" />
          Participantes do Projeto
          <span className="text-[10px] text-gray-400 font-normal">({participants.length})</span>
        </Label>
      </div>

      {/* Lista de chips com avatares de participantes */}
      {loading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando participantes...
        </div>
      ) : participants.length === 0 ? (
        <p className="text-xs text-gray-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          Nenhum participante adicional vinculado a este cartão. Adicione membros da equipe abaixo.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
          {participants.map((p) => {
            const avatarSrc = p.userAvatar && p.userId ? getAvatarUrl(p.userId, p.userAvatar) : null
            return (
              <div
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-xs px-2 py-1 rounded-full transition-colors group"
              >
                <Avatar className="w-5 h-5 border border-slate-300">
                  {avatarSrc ? <AvatarImage src={avatarSrc} alt={p.userName} /> : null}
                  <AvatarFallback className="text-[9px] bg-slate-700 text-white font-bold">
                    {p.userName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium max-w-[130px] truncate">{p.userName}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(p)}
                  className="text-gray-400 hover:text-red-600 rounded-full p-0.5 ml-0.5 transition-colors"
                  title={`Remover ${p.userName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Seletor para adicionar novo participante */}
      <div className="flex items-center gap-2 pt-1">
        <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={adding}>
          <SelectTrigger className="text-xs h-8 flex-1">
            <SelectValue placeholder="Adicionar participante..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.length === 0 ? (
              <div className="p-2 text-xs text-gray-400 text-center">
                Nenhum outro usuário disponível
              </div>
            ) : (
              availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-gray-400" />
                    <span>{u.name}</span>
                    <span className="text-[10px] text-gray-400">({u.role || 'servidor'})</span>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={handleAddParticipant}
          disabled={!selectedUserId || adding}
          className="h-8 text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white px-2.5 gap-1 shrink-0"
        >
          {adding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Adicionar
        </Button>
      </div>
    </div>
  )
}
