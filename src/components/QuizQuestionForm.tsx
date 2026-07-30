import { useState } from 'react'
import { Plus, Trash2, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'
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
import type { QuizPergunta } from '@/types/education'

interface QuizQuestionFormProps {
  initial: QuizPergunta | null
  onSubmit: (data: {
    pergunta: string
    opcoes: string[]
    respostaCorreta: string
    ordem: number
  }) => Promise<void>
  onBack: () => void
}

export function QuizQuestionForm({ initial, onSubmit, onBack }: QuizQuestionFormProps) {
  const [pergunta, setPergunta] = useState(initial?.pergunta || '')
  const [opcoes, setOpcoes] = useState<string[]>(
    initial?.opcoes?.length >= 2 ? [...initial.opcoes] : ['', ''],
  )
  const [respostaCorreta, setRespostaCorreta] = useState(initial?.respostaCorreta || '')
  const [ordem, setOrdem] = useState(initial?.ordem || 1)
  const [submitting, setSubmitting] = useState(false)

  const validOptions = opcoes.filter((o) => o.trim())
  const canSubmit = pergunta.trim() && validOptions.length >= 2 && respostaCorreta

  const updateOption = (index: number, value: string) => {
    setOpcoes((prev) => prev.map((o, i) => (i === index ? value : o)))
    if (opcoes[index] === respostaCorreta) setRespostaCorreta('')
  }
  const addOption = () => setOpcoes((prev) => [...prev, ''])
  const removeOption = (index: number) => {
    if (opcoes.length <= 2) return
    const removed = opcoes[index]
    setOpcoes((prev) => prev.filter((_, i) => i !== index))
    if (removed === respostaCorreta) setRespostaCorreta('')
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit({
        pergunta: pergunta.trim(),
        opcoes: validOptions,
        respostaCorreta,
        ordem: Number(ordem) || 1,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-lg font-bold text-[#1c2a3e]">
          {initial ? 'Editar Pergunta' : 'Nova Pergunta'}
        </h3>
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-700">Pergunta *</Label>
        <Input
          placeholder="Digite a pergunta..."
          value={pergunta}
          onChange={(e) => setPergunta(e.target.value)}
          className="mt-1 text-sm"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-gray-700">Opções * (mínimo 2)</Label>
        {opcoes.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              placeholder={`Opção ${i + 1}`}
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="text-sm"
            />
            {opcoes.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-red-600"
                onClick={() => removeOption(i)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          className="text-xs gap-1"
        >
          <Plus className="w-3 h-3" /> Adicionar Opção
        </Button>
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-700">Resposta Correta *</Label>
        <Select value={respostaCorreta} onValueChange={setRespostaCorreta}>
          <SelectTrigger className="mt-1 text-sm">
            <SelectValue placeholder="Selecione a resposta correta" />
          </SelectTrigger>
          <SelectContent>
            {validOptions.map((opt, i) => (
              <SelectItem key={i} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs font-semibold text-gray-700">Ordem</Label>
        <Input
          type="number"
          min={1}
          value={ordem}
          onChange={(e) => setOrdem(Number(e.target.value))}
          className="mt-1 text-sm"
        />
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white"
      >
        {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
        {initial ? 'Salvar Alterações' : 'Adicionar Pergunta'}
      </Button>
    </div>
  )
}
