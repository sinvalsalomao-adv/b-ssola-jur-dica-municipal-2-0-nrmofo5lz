import { useState, useEffect } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SavedPhrasesDropdown } from '@/components/SavedPhrasesDropdown'
import { generateJustificativa } from '@/lib/dfd-generator'
import { DfdRecord } from '@/types/dfd'
import { Priority, ColumnType } from '@/types/project'
import { getUsersByTenant } from '@/services/users'
import { createDfd, updateDfd } from '@/services/dfds'
import { uploadDocument } from '@/services/documents'
import { getFrasesAsStrings, saveOrIncrementFrase } from '@/services/frases'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { sanitizeInput } from '@/lib/sanitize'

interface DfdFormProps {
  dfd?: DfdRecord | null
  onDfdSaved?: () => void
  onSaved?: () => void
}

export const DfdForm = ({ dfd, onDfdSaved, onSaved }: DfdFormProps) => {
  const { addProject, updateProject, tenants } = useProjects()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isSuperadmin = user?.role === 'superadmin'
  const isEditing = !!dfd

  // Para Superadmin: inicia sem seleção a menos que o DFD já tenha ou haja impersonação explícita
  // Para Admin / Servidor: exclusivamente o tenantId autenticado do usuário
  const initialTenantId = isEditing
    ? dfd?.tenantId || user?.tenantId || ''
    : isSuperadmin
      ? user?.tenantId || '' // context do superadmin se impersonando, senão vazio
      : user?.tenantId || ''

  const [selectedTenantId, setSelectedTenantId] = useState(initialTenantId)

  const [title, setTitle] = useState(dfd?.title || '')
  const [objeto, setObjeto] = useState(dfd?.objeto || '')
  const [descricao, setDescricao] = useState(dfd?.descricao || '')
  const [justificativa, setJustificativa] = useState(dfd?.justificativa || '')
  const [responsibleUserId, setResponsibleUserId] = useState(
    dfd?.responsibleUserId || user?.id || '',
  )
  const [deadline, setDeadline] = useState(dfd?.deadline || '')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [objetoPhrases, setObjetoPhrases] = useState<string[]>([])
  const [descricaoPhrases, setDescricaoPhrases] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  // Keep selectedTenantId updated if editing an existing DFD or if non-superadmin user tenant loads
  useEffect(() => {
    if (isEditing && dfd?.tenantId) {
      setSelectedTenantId(dfd.tenantId)
    } else if (!isSuperadmin && user?.tenantId) {
      setSelectedTenantId(user.tenantId)
    }
  }, [isEditing, dfd?.tenantId, isSuperadmin, user?.tenantId])

  // Load users and phrases whenever the effective tenant changes
  useEffect(() => {
    const effectiveTenant = selectedTenantId || user?.tenantId || ''
    if (effectiveTenant) {
      getUsersByTenant(effectiveTenant)
        .then((data) => {
          const mapped = data.map((u) => ({ id: u.id, name: u.name }))
          setUsers(mapped)
          if (!responsibleUserId && mapped.length > 0) {
            setResponsibleUserId(mapped[0].id)
          } else if (!responsibleUserId && user?.id) {
            setResponsibleUserId(user.id)
          }
        })
        .catch(() => {
          if (!responsibleUserId && user?.id) {
            setResponsibleUserId(user.id)
          }
        })
      getFrasesAsStrings(effectiveTenant, 'objeto')
        .then(setObjetoPhrases)
        .catch(() => {})
      getFrasesAsStrings(effectiveTenant, 'descricao')
        .then(setDescricaoPhrases)
        .catch(() => {})
    } else if (user) {
      // Fallback if tenant is not available yet
      if (!responsibleUserId && user.id) {
        setResponsibleUserId(user.id)
      }
      setUsers([{ id: user.id, name: user.name }])
    }
  }, [selectedTenantId, user?.tenantId, user?.id, user?.name])

  const addPhraseIfNew = (text: string, type: 'objeto' | 'descricao') => {
    const trimmed = text.trim()
    if (!trimmed) return
    const setter = type === 'objeto' ? setObjetoPhrases : setDescricaoPhrases
    setter((prev) =>
      prev.some((p) => p.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed],
    )
  }

  const handleGenerateIA = () => {
    if (!title.trim() && !objeto.trim()) {
      toast.error('Preencha pelo menos o Título e o Objeto para gerar a justificativa.')
      return
    }
    setIsGenerating(true)
    setTimeout(() => {
      setJustificativa(generateJustificativa(title, objeto, descricao))
      setIsGenerating(false)
      toast.success('Justificativa gerada com sucesso!')
    }, 1500)
  }

  const resetForm = () => {
    setTitle('')
    setObjeto('')
    setDescricao('')
    setJustificativa('')
    setDeadline('')
    setPendingFiles([])
  }

  const handleSave = async (isDraft: boolean) => {
    if (!isDraft) {
      if (!title.trim()) {
        toast.error('O título do projeto é obrigatório.')
        return
      }
      if (!objeto.trim()) {
        toast.error('O objeto é obrigatório.')
        return
      }
      if (!deadline) {
        toast.error('O prazo para conclusão é obrigatório.')
        return
      }
    }
    setSubmitting(true)
    try {
      // Resolve effective tenant: Superadmin MUST have explicitly selected or have impersonation context; Admin/Servidor MUST use authenticated tenant
      const effectiveTenantId = isSuperadmin
        ? selectedTenantId || (isEditing ? dfd?.tenantId || '' : '')
        : user?.tenantId || (isEditing ? dfd?.tenantId || '' : '')

      if (!effectiveTenantId || effectiveTenantId.trim() === '') {
        toast.error(
          'Prefeitura (Tenant) não identificada. Por favor, selecione uma prefeitura antes de salvar.',
        )
        return
      }

      // Resolve effective responsible user
      const effectiveResponsibleUserId = responsibleUserId || user?.id || null

      if (objeto.trim()) await saveOrIncrementFrase(objeto, 'objeto', effectiveTenantId)
      if (descricao.trim()) await saveOrIncrementFrase(descricao, 'descricao', effectiveTenantId)

      const projTitle = sanitizeInput(title.trim()) || 'Sem título'
      const cleanObjeto = sanitizeInput(objeto)
      const cleanDescricao = sanitizeInput(descricao)
      const cleanJustificativa = sanitizeInput(justificativa)
      let savedProjectId = ''

      const selectedTenantObj = tenants.find((t) => t.id === effectiveTenantId)
      const prefeituraName = selectedTenantObj?.name || user?.prefeitura || ''

      if (isEditing && dfd?.projetoId) {
        savedProjectId = dfd.projetoId
        await updateProject(dfd.projetoId, {
          title: projTitle,
          description: cleanDescricao,
          deadline,
          objeto: cleanObjeto,
          justificativa: cleanJustificativa,
          responsibleUserId: effectiveResponsibleUserId || undefined,
          tenantId: effectiveTenantId,
          prefeitura: prefeituraName,
        })
        await updateDfd(dfd.id, {
          titulo: projTitle,
          objeto: cleanObjeto,
          descricao: cleanDescricao,
          justificativa: cleanJustificativa,
          responsible_user: effectiveResponsibleUserId,
          prazo: deadline,
          tenant: effectiveTenantId,
          status: isDraft ? 'Rascunho' : 'Finalizado',
        })
      } else {
        const newProject = await addProject({
          title: projTitle,
          description: cleanDescricao,
          responsible: '',
          responsibleUserId: effectiveResponsibleUserId || undefined,
          deadline,
          priority: 'Média' as Priority,
          column: (isDraft ? 'Ideação' : 'Elaborar DFD') as ColumnType,
          prefeitura: prefeituraName,
          tenantId: effectiveTenantId,
          objeto: cleanObjeto,
          justificativa: cleanJustificativa,
        })
        savedProjectId = newProject.id
        await createDfd({
          titulo: projTitle,
          objeto: cleanObjeto,
          descricao: cleanDescricao,
          justificativa: cleanJustificativa,
          responsible_user: effectiveResponsibleUserId,
          prazo: deadline,
          status: isDraft ? 'Rascunho' : 'Finalizado',
          tenant: effectiveTenantId,
          projeto_id: newProject.id,
        })
      }

      if (savedProjectId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            await uploadDocument(
              file,
              savedProjectId,
              projTitle,
              effectiveTenantId,
              user?.name || 'Usuário',
            )
          } catch {
            // ignore individual file upload errors
          }
        }
        setPendingFiles([])
      }

      if (isDraft) {
        toast.success('Rascunho salvo com sucesso!')
        onDfdSaved?.()
        onSaved?.()
        resetForm()
      } else {
        toast.success('DFD finalizado! Card criado na coluna "Elaborar DFD" do Kanban.')
        navigate('/bussola')
      }
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="bg-white border-0 shadow-subtle">
      <CardContent className="p-6 space-y-5">
        <div>
          <Label htmlFor="dfd-title" className="text-xs font-semibold text-gray-700">
            Título do Projeto *
          </Label>
          <Input
            id="dfd-title"
            placeholder="Ex: Reforma da Praça Municipal"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dfd-objeto" className="text-xs font-semibold text-gray-700">
              Objeto *
            </Label>
            <SavedPhrasesDropdown phrases={objetoPhrases} onSelect={(p) => setObjeto(p)} />
          </div>
          <Textarea
            id="dfd-objeto"
            placeholder="Descreva o objeto da contratação..."
            value={objeto}
            onChange={(e) => setObjeto(e.target.value)}
            onBlur={() => addPhraseIfNew(objeto, 'objeto')}
            className="mt-1 min-h-[80px]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dfd-descricao" className="text-xs font-semibold text-gray-700">
              Descrição do Objeto
            </Label>
            <SavedPhrasesDropdown phrases={descricaoPhrases} onSelect={(p) => setDescricao(p)} />
          </div>
          <Textarea
            id="dfd-descricao"
            placeholder="Detalhe a descrição do objeto..."
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => addPhraseIfNew(descricao, 'descricao')}
            className="mt-1 min-h-[80px]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="dfd-justificativa" className="text-xs font-semibold text-gray-700">
              Justificativa Técnica
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleGenerateIA}
              disabled={isGenerating}
              className="text-xs gap-1.5 border-[#3b82f6] text-[#3b82f6] hover:bg-blue-50 h-8"
            >
              {isGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {isGenerating ? 'Gerando...' : 'Gerar com IA'}
            </Button>
          </div>
          <Textarea
            id="dfd-justificativa"
            placeholder="Clique em 'Gerar com IA' ou escreva a justificativa técnica..."
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            className="mt-1 min-h-[160px] text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isSuperadmin && (
            <div>
              <Label className="text-xs font-semibold text-gray-700">Prefeitura (Tenant) *</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger
                  className={`mt-1 ${!selectedTenantId ? 'border-amber-400 bg-amber-50/20' : ''}`}
                >
                  <SelectValue placeholder="Selecione a prefeitura..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedTenantId && (
                <p className="text-[10px] text-amber-600 mt-1 font-medium">
                  Seleção obrigatória para Superadmin
                </p>
              )}
            </div>
          )}
          <div className={isSuperadmin ? '' : 'sm:col-span-1'}>
            <Label className="text-xs font-semibold text-gray-700">Responsável pelo DFD</Label>
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
          <div className={isSuperadmin ? '' : 'sm:col-span-1'}>
            <Label className="text-xs font-semibold text-gray-700">Prazo para Conclusão *</Label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSave(true)}
            disabled={submitting || (isSuperadmin && !selectedTenantId)}
            className="flex-1 border-[#4a6fa5] text-[#4a6fa5] hover:bg-[#4a6fa5] hover:text-white"
          >
            {submitting ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={submitting || (isSuperadmin && !selectedTenantId)}
            className="flex-1 bg-[#2e7d32] hover:bg-[#1b5e20] text-white"
          >
            {submitting ? 'Finalizando...' : 'Finalizar DFD'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
