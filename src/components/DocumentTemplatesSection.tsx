import React, { useState, useEffect } from 'react'
import {
  getDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  DocumentTemplateItem,
} from '@/services/documentTemplates'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Plus, Edit2, Trash2, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'

const TYPES = ['Minuta', 'Ofício', 'Parecer', 'Declaração', 'Outro'] as const

export const DocumentTemplatesSection: React.FC = () => {
  const { user } = useAuth()
  const tenantId = user?.tenantId || ''

  const [templates, setTemplates] = useState<DocumentTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('Todos')

  const [isModalOpen, setIsNewModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplateItem | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('Minuta')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [tenantId])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const data = await getDocumentTemplates(tenantId || undefined)
      setTemplates(data)
    } catch (err) {
      toast.error('Erro ao carregar modelos de documentos.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditingTemplate(null)
    setName('')
    setType('Minuta')
    setContent('')
    setIsNewModalOpen(true)
  }

  const handleOpenEdit = (tpl: DocumentTemplateItem) => {
    setEditingTemplate(tpl)
    setName(tpl.name)
    setType(tpl.type)
    setContent(tpl.content)
    setIsNewModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Informe o nome do modelo.')
      return
    }
    if (!content.trim()) {
      toast.error('O conteúdo do modelo não pode estar vazio.')
      return
    }

    setSaving(true)
    try {
      if (editingTemplate) {
        await updateDocumentTemplate(editingTemplate.id, {
          name: name.trim(),
          type,
          content: content.trim(),
        })
        toast.success('Modelo atualizado com sucesso!')
      } else {
        await createDocumentTemplate({
          name: name.trim(),
          type,
          content: content.trim(),
          tenant: tenantId || 'tenant_default',
        })
        toast.success('Modelo criado com sucesso!')
      }
      setIsNewModalOpen(false)
      loadTemplates()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este modelo de documento?')) return
    try {
      await deleteDocumentTemplate(id)
      toast.success('Modelo excluído.')
      setTemplates((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const filtered = templates.filter((t) => filterType === 'Todos' || t.type === filterType)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl shadow-xs border border-gray-100">
        <div>
          <h3 className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#3b82f6]" />
            Modelos de Documentos Oficiais
          </h3>
          <p className="text-xs text-gray-500">
            Crie e gerencie estruturas reutilizáveis para minutas, ofícios, pareceres e declarações.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px] h-9 text-xs">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todos">Todos os Tipos</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleOpenCreate}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-9 text-xs gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Novo Modelo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-xl border">
          <Loader2 className="w-7 h-7 animate-spin text-[#3b82f6]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-gray-200 text-center">
          <FileText className="w-12 h-12 text-gray-300 mb-2" />
          <h4 className="font-semibold text-sm text-gray-700">Nenhum modelo cadastrado</h4>
          <p className="text-xs text-gray-400 mt-1 max-w-sm">
            Clique em "Novo Modelo" para criar seu primeiro modelo reutilizável de documento.
          </p>
          <Button
            onClick={handleOpenCreate}
            className="mt-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs"
          >
            Criar Modelo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tpl) => (
            <div
              key={tpl.id}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {tpl.type}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(tpl)}
                      className="h-7 w-7 text-gray-400 hover:text-gray-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(tpl.id)}
                      className="h-7 w-7 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-[#1c2a3e] mb-1">{tpl.name}</h4>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed font-mono bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                  {tpl.content}
                </p>
              </div>

              <div className="text-[10px] text-gray-400 border-t pt-2 mt-2">
                Criado em: {new Date(tpl.created).toLocaleDateString('pt-BR')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsNewModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Modelo de Documento' : 'Novo Modelo de Documento'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-semibold text-gray-700">Nome do Modelo *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Minuta Padrão de Contratação Direta"
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">Tipo *</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-semibold text-gray-700">Conteúdo do Modelo *</Label>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-500" /> Tags disponíveis: {'{titulo}'},{' '}
                  {'{objeto}'}, {'{justificativa}'}, {'{responsavel}'}, {'{prazo}'}
                </span>
              </div>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Insira o texto e cláusulas padrão do modelo..."
                className="min-h-[220px] text-xs font-mono leading-relaxed"
                required
              />
            </div>

            <DialogFooter className="pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setIsNewModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {editingTemplate ? 'Salvar Alterações' : 'Criar Modelo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
