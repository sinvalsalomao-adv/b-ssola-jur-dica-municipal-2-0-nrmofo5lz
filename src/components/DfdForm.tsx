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
import { getFrasesAsStrings, saveOrIncrementFrase } from '@/services/frases'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

interface DfdFormProps {
  dfd?: DfdRecord | null
  onDfdSaved?: () => void
}

export const DfdForm = ({ dfd, onDfdSaved }: DfdFormProps) => {
  const { addProject, updateProject } = useProjects()
  const { user } = useAuth()
  const navigate = useNavigate()

  const tenantId = user?.tenantId || ''
  const isEditing = !!dfd

  const [title, setTitle] = useState(dfd?.title || '')
  const [objeto, setObjeto] = useState(dfd?.objeto || '')
  const [descricao, setDescricao] = useState(dfd?.descricao || '')
  const [justificativa, setJustificativa] = useState(dfd?.justificativa || '')
  const [responsibleUserId, setResponsibleUserId] = useState(dfd?.responsibleUserId || '')
  const [deadline, setDeadline] = useState(dfd?.deadline || '')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [objetoPhrases, setObjetoPhrases] = useState<string[]>([])
  const [descricaoPhrases, setDescricaoPhrases] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!tenantId) return
    getUsersByTenant(tenantId)
      .then((data) => {
        const mapped = data.map((u) => ({ id: u.id, name: u.name }))
        setUsers(mapped)
        if (!responsibleUserId && mapped.length > 0) setResponsibleUserId(mapped[0].id)
      })
      .catch(() => {})
    getFrasesAsStrings(tenantId, 'objeto')
      .then(setObjetoPhrases)
      .catch(() => {})
    getFrasesAsStrings(tenantId, 'descricao')
      .then(setDescricaoPhrases)
      .catch(() => {})
  }, [tenantId])

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
      if (objeto.trim()) await saveOrIncrementFrase(objeto, 'objeto', tenantId)
      if (descricao.trim()) await saveOrIncrementFrase(descricao, 'descricao', tenantId)

      const projTitle = title.trim() || 'Sem título'
      if (isEditing && dfd?.projetoId) {
        await updateProject(dfd.projetoId, {
          title: projTitle,
          description: descricao,
          deadline,
          objeto,
          justificativa,
          responsibleUserId,
        })
        await updateDfd(dfd.id, {
          titulo: projTitle,
          objeto,
          descricao,
          justificativa,
          responsible_user: responsibleUserId,
          prazo: deadline,
          status: isDraft ? 'Rascunho' : 'Finalizado',
        })
      } else {
        const newProject = await addProject({
          title: projTitle,
          description: descricao,
          responsible: '',
          responsibleUserId,
          deadline,
          priority: 'Média' as Priority,
          column: (isDraft ? 'Ideação' : 'Elaborar DFD') as ColumnType,
          prefeitura: user?.prefeitura || '',
          objeto,
          justificativa,
        })
        await createDfd({
          titulo: projTitle,
          objeto,
          descricao,
          justificativa,
          responsible_user: responsibleUserId,
          prazo: deadline,
          status: isDraft ? 'Rascunho' : 'Finalizado',
          tenant: tenantId,
          projeto_id: newProject.id,
        })
      }

      if (isDraft) {
        toast.success('Rascunho salvo com sucesso!')
        onDfdSaved?.()
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
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
          <div>
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
            disabled={submitting}
            className="flex-1 border-[#4a6fa5] text-[#4a6fa5] hover:bg-[#4a6fa5] hover:text-white"
          >
            {submitting ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          <Button
            type="button"
            onClick={() => handleSave(false)}
            disabled={submitting}
            className="flex-1 bg-[#2e7d32] hover:bg-[#1b5e20] text-white"
          >
            {submitting ? 'Finalizando...' : 'Finalizar DFD'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
