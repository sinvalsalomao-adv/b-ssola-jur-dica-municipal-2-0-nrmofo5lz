import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  FileText,
  User,
  Calendar,
  BadgeCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useProjects } from '@/context/ProjectContext'
import { useRealtime } from '@/hooks/use-realtime'
import { getDfd, updateDfd } from '@/services/dfds'
import { getUsersByTenant } from '@/services/users'
import { saveOrIncrementFrase } from '@/services/frases'
import { GenerateDocumentModal } from '@/components/GenerateDocumentModal'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import type { DfdRecord } from '@/types/dfd'

export default function DfdDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { updateProject } = useProjects()

  const [dfd, setDfd] = useState<DfdRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  const [title, setTitle] = useState('')
  const [objeto, setObjeto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [deadline, setDeadline] = useState('')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [showDocModal, setShowDocModal] = useState(false)

  const loadDfd = useCallback(async () => {
    if (!id) return
    try {
      const data = await getDfd(id)
      setDfd(data)
      setTitle(data.title)
      setObjeto(data.objeto)
      setDescricao(data.descricao)
      setJustificativa(data.justificativa)
      setDeadline(data.deadline)
      setResponsibleUserId(data.responsibleUserId)
    } catch {
      setDfd(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDfd()
  }, [loadDfd])

  useEffect(() => {
    const effectiveTenant = dfd?.tenantId || user?.tenantId
    if (effectiveTenant) {
      getUsersByTenant(effectiveTenant)
        .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.name }))))
        .catch(() => {})
    }
  }, [dfd?.tenantId, user?.tenantId])

  useRealtime(
    'dfds',
    () => {
      loadDfd()
    },
    !!id,
  )

  const handleSave = async () => {
    if (!dfd || !id) return
    const effectiveTenantId = dfd.tenantId || user?.tenantId || ''
    if (!title.trim()) {
      toast.error('O título é obrigatório.')
      return
    }
    setSaving(true)
    try {
      if (objeto.trim() && effectiveTenantId) {
        await saveOrIncrementFrase(objeto, 'objeto', effectiveTenantId)
      }
      if (descricao.trim() && effectiveTenantId) {
        await saveOrIncrementFrase(descricao, 'descricao', effectiveTenantId)
      }

      await updateDfd(id, {
        titulo: title,
        objeto,
        descricao,
        justificativa,
        responsible_user: responsibleUserId || null,
        prazo: deadline,
      })

      if (dfd.status === 'Finalizado' && dfd.projetoId) {
        await updateProject(dfd.projetoId, {
          title,
          objeto,
          justificativa,
          deadline,
          responsibleUserId: responsibleUserId || undefined,
        })
      }

      await loadDfd()
      setEditMode(false)
      toast.success('DFD atualizado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (!dfd) return
    setTitle(dfd.title)
    setObjeto(dfd.objeto)
    setDescricao(dfd.descricao)
    setJustificativa(dfd.justificativa)
    setDeadline(dfd.deadline)
    setResponsibleUserId(dfd.responsibleUserId)
    setEditMode(false)
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!dfd) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 animate-fade-in">
        <AlertTriangle className="w-12 h-12 text-gray-300" />
        <h2 className="text-xl font-bold text-[#1c2a3e]">DFD não encontrado</h2>
        <p className="text-sm text-gray-500">
          O documento pode não existir ou você não tem acesso.
        </p>
        <Button variant="outline" onClick={() => navigate('/dfds')}>
          Voltar para DFDs
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate('/dfds')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[#1c2a3e]">
            {editMode ? 'Editar DFD' : dfd.title}
          </h2>
          <p className="text-xs text-gray-500">Documento de Formalização de Demanda</p>
        </div>
        <Badge
          className={
            dfd.status === 'Finalizado' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
          }
        >
          {dfd.status}
        </Badge>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <CardContent className="p-6 space-y-4">
          {editMode ? (
            <>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Título *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Objeto</Label>
                <Textarea
                  value={objeto}
                  onChange={(e) => setObjeto(e.target.value)}
                  className="mt-1 min-h-[70px]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 min-h-[70px]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-700">Justificativa</Label>
                <Textarea
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  className="mt-1 min-h-[120px] text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Responsável</Label>
                  <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-700">Prazo</Label>
                  <Input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <Button variant="outline" onClick={handleCancel} className="flex-1 gap-2">
                  <X className="w-4 h-4" /> Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-[#2e7d32] hover:bg-[#1b5e20] text-white gap-2"
                >
                  <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-gray-100">
                <InfoRow
                  icon={<User className="w-4 h-4" />}
                  label="Responsável"
                  value={dfd.responsible || '—'}
                />
                <InfoRow
                  icon={<Calendar className="w-4 h-4" />}
                  label="Prazo"
                  value={
                    dfd.deadline
                      ? new Date(dfd.deadline + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'
                  }
                />
                {dfd.projectColumn && (
                  <InfoRow
                    icon={<BadgeCheck className="w-4 h-4" />}
                    label="Etapa do Projeto"
                    value={dfd.projectColumn}
                  />
                )}
                {dfd.projectPriority && (
                  <InfoRow
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Prioridade"
                    value={dfd.projectPriority}
                  />
                )}
              </div>
              <FieldBlock label="Objeto" value={dfd.objeto} />
              <FieldBlock label="Descrição" value={dfd.descricao} />
              <FieldBlock label="Justificativa Técnica" value={dfd.justificativa} />
              <div className="flex flex-col items-end gap-1 pt-4 border-t border-gray-100">
                {!dfd.projetoId && (
                  <p className="text-xs text-amber-600">
                    Geração de documento indisponível: DFD sem projeto vinculado.
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => setShowDocModal(true)}
                    disabled={!dfd.projetoId}
                    className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white gap-2"
                  >
                    <FileText className="w-4 h-4" /> Gerar Documento
                  </Button>
                  <Button
                    onClick={() => setEditMode(true)}
                    className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Editar
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <GenerateDocumentModal
        open={showDocModal}
        onOpenChange={setShowDocModal}
        dfd={dfd}
        projectId={dfd.projetoId}
        tenantId={dfd.tenantId || user?.tenantId || ''}
        userName={user?.name || 'Usuário'}
      />
    </div>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-slate-50 text-gray-500 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-[#1c2a3e]">{value}</p>
      </div>
    </div>
  )
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-700 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  )
}
