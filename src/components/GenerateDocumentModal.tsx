import { useState } from 'react'
import { Sparkles, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateDocument, saveGeneratedDocument } from '@/services/documents'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { toast } from 'sonner'
import type { DfdRecord } from '@/types/dfd'

const DOC_TYPES = ['Minuta', 'Ofício', 'Declaração', 'Parecer', 'Outro']

interface GenerateDocumentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dfd: DfdRecord
  projectId: string
  tenantId: string
  userName: string
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '_')
}

export function GenerateDocumentModal({
  open,
  onOpenChange,
  dfd,
  projectId,
  tenantId,
  userName,
}: GenerateDocumentModalProps) {
  const [docType, setDocType] = useState('')
  const [customType, setCustomType] = useState('')
  const [generatedContent, setGeneratedContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)

  const resetState = () => {
    setDocType('')
    setCustomType('')
    setGeneratedContent('')
    setHasGenerated(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetState()
    onOpenChange(nextOpen)
  }

  const handleGenerate = async () => {
    if (!docType) {
      toast.error('Selecione o tipo de documento.')
      return
    }
    if (docType === 'Outro' && !customType.trim()) {
      toast.error('Especifique o tipo de documento.')
      return
    }
    setIsGenerating(true)
    try {
      const result = await generateDocument(
        {
          titulo: dfd.title,
          objeto: dfd.objeto,
          descricao: dfd.descricao,
          justificativa: dfd.justificativa,
          prazo: dfd.deadline,
          responsavel: dfd.responsible,
        },
        docType,
        customType,
      )
      setGeneratedContent(result.content)
      setHasGenerated(true)
      toast.success('Documento gerado com sucesso!')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!generatedContent.trim()) {
      toast.error('Não há conteúdo para salvar.')
      return
    }
    setIsSaving(true)
    try {
      const typeLabel = docType === 'Outro' ? customType.trim() : docType
      const safeTitle = sanitizeFileName(dfd.title) || 'Projeto'
      await saveGeneratedDocument(
        generatedContent,
        typeLabel,
        safeTitle,
        projectId,
        tenantId,
        userName,
      )
      toast.success('Documento salvo com sucesso!')
      handleOpenChange(false)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#3b82f6]" />
            Gerar Documento com IA
          </DialogTitle>
          <DialogDescription>
            Gere documentos oficiais automaticamente a partir dos dados do DFD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Tipo de Documento *</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {docType === 'Outro' && (
              <div>
                <Label className="text-xs font-semibold text-gray-700">Especifique o tipo *</Label>
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Ex: Requerimento"
                  className="mt-1"
                />
              </div>
            )}
          </div>

          {!hasGenerated ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-gray-500 text-center max-w-md">
                O documento será gerado usando os dados do DFD: título, objeto, descrição,
                justificativa, prazo e responsável.
              </p>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando documento...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Documento
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Conteúdo Gerado (editável)
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="text-xs h-7 gap-1 text-[#3b82f6] hover:bg-blue-50"
                >
                  {isGenerating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {isGenerating ? 'Gerando...' : 'Regenerar'}
                </Button>
              </div>
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[320px] text-sm font-mono leading-relaxed"
              />
            </div>
          )}
        </div>

        {hasGenerated && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#2e7d32] hover:bg-[#1b5e20] text-white gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Salvando...' : 'Salvar como Documento'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
