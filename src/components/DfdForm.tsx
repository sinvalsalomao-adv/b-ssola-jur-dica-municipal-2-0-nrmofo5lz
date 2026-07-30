import React, { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useProjects } from '@/context/ProjectContext'
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
import { INITIAL_SAVED_PHRASES, DFD_RESPONSIBLES, DfdRecord } from '@/types/dfd'
import { toast } from 'sonner'

interface DfdFormProps {
  onDfdCreated: (dfd: DfdRecord) => void
}

export const DfdForm: React.FC<DfdFormProps> = ({ onDfdCreated }) => {
  const { addProject } = useProjects()

  const [title, setTitle] = useState('')
  const [objeto, setObjeto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [responsible, setResponsible] = useState(DFD_RESPONSIBLES[0])
  const [deadline, setDeadline] = useState('')
  const [objetoPhrases, setObjetoPhrases] = useState<string[]>(INITIAL_SAVED_PHRASES)
  const [descricaoPhrases, setDescricaoPhrases] = useState<string[]>(INITIAL_SAVED_PHRASES)
  const [isGenerating, setIsGenerating] = useState(false)

  const addPhraseIfNew = (text: string) => {
    const trimmed = text.trim()
    if (trimmed && !objetoPhrases.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setObjetoPhrases((prev) => [...prev, trimmed])
    }
  }

  const addDescricaoPhraseIfNew = (text: string) => {
    const trimmed = text.trim()
    if (trimmed && !descricaoPhrases.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setDescricaoPhrases((prev) => [...prev, trimmed])
    }
  }

  const handleGenerateIA = () => {
    if (!title.trim() && !objeto.trim()) {
      toast.error('Preencha pelo menos o Título e o Objeto para gerar a justificativa.')
      return
    }
    setIsGenerating(true)
    setTimeout(() => {
      const generated = generateJustificativa(title, objeto, descricao)
      setJustificativa(generated)
      setIsGenerating(false)
      toast.success('Justificativa gerada com sucesso!')
    }, 1500)
  }

  const resetForm = () => {
    setTitle('')
    setObjeto('')
    setDescricao('')
    setJustificativa('')
    setResponsible(DFD_RESPONSIBLES[0])
    setDeadline('')
  }

  const handleSaveDraft = () => {
    const dfd: DfdRecord = {
      id: `dfd-${Date.now()}`,
      title: title.trim() || 'Sem título',
      objeto,
      descricao,
      justificativa,
      responsible,
      deadline,
      status: 'Rascunho',
      createdAt: new Date().toISOString(),
    }
    onDfdCreated(dfd)
    toast.success('Rascunho salvo com sucesso!')
    resetForm()
  }

  const handleFinalize = () => {
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

    const dfd: DfdRecord = {
      id: `dfd-${Date.now()}`,
      title: title.trim(),
      objeto,
      descricao,
      justificativa,
      responsible,
      deadline,
      status: 'Finalizado',
      createdAt: new Date().toISOString(),
    }

    addProject({
      title: title.trim(),
      description: `DFD #${dfd.id} — Objeto: ${objeto}. ${justificativa.substring(0, 200)}`,
      responsible,
      deadline,
      priority: 'Média',
      column: 'Elaborar DFD',
      prefeitura: 'Florânia',
    })

    onDfdCreated(dfd)
    toast.success('DFD finalizado! Card criado na coluna "Elaborar DFD" do Kanban.')
    resetForm()
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
            onBlur={() => addPhraseIfNew(objeto)}
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
            onBlur={() => addDescricaoPhraseIfNew(descricao)}
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
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {DFD_RESPONSIBLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
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
            onClick={handleSaveDraft}
            className="flex-1 border-[#4a6fa5] text-[#4a6fa5] hover:bg-[#4a6fa5] hover:text-white"
          >
            Salvar Rascunho
          </Button>
          <Button
            type="button"
            onClick={handleFinalize}
            className="flex-1 bg-[#2e7d32] hover:bg-[#1b5e20] text-white"
          >
            Finalizar DFD
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
