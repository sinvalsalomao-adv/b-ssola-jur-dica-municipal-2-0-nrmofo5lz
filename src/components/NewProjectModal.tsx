import React, { useState, useEffect } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { COLUMNS, PREFEITURAS, ColumnType, Priority } from '@/types/project'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUsers } from '@/services/users'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { normalizeDateForInput } from '@/lib/dateUtils'

export const NewProjectModal: React.FC = () => {
  const { isNewModalOpen, setIsNewModalOpen, addProject, saving, tenants } = useProjects()
  const { user } = useAuth()
  const isSuperadmin = user?.role === 'superadmin'

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [responsibleUserId, setResponsibleUserId] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [deadline, setDeadline] = useState('')
  const [column, setColumn] = useState<ColumnType>('Ideação')
  const [prefeitura, setPrefeitura] = useState('Florânia')
  const [priority, setPriority] = useState<Priority>('Baixa')
  const [objeto, setObjeto] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    if (isNewModalOpen) {
      getUsers()
        .then((data) => {
          setUsers(data.map((u) => ({ id: u.id, name: u.name })))
        })
        .catch(() => {})

      if (user?.prefeitura) {
        setPrefeitura(user.prefeitura)
      } else if (tenants.length > 0) {
        setPrefeitura(tenants[0].name)
      }
    }
  }, [isNewModalOpen, user, tenants])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('O título do projeto é obrigatório.')
      return
    }
    if (!deadline) {
      toast.error('Informe a data limite para o prazo.')
      return
    }

    try {
      const selectedTenant = tenants.find(
        (t) =>
          t.name.toLowerCase().trim() === prefeitura.toLowerCase().trim() ||
          t.name.toLowerCase().includes(prefeitura.toLowerCase().trim()) ||
          prefeitura.toLowerCase().includes(t.name.toLowerCase().trim()),
      )
      const resolvedTenantId =
        selectedTenant?.id || user?.tenantId || (tenants.length > 0 ? tenants[0].id : undefined)

      await addProject({
        title: title.trim(),
        description: description.trim(),
        responsible: '',
        responsibleUserId: responsibleUserId === 'none' ? '' : responsibleUserId,
        deadline,
        column,
        prefeitura:
          prefeitura || user?.prefeitura || (tenants.length > 0 ? tenants[0].name : 'Florânia'),
        tenantId: resolvedTenantId,
        priority,
        objeto: objeto.trim(),
        justificativa: justificativa.trim(),
      })
      toast.success('Projeto criado com sucesso!')
      setIsNewModalOpen(false)
      resetForm()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setResponsibleUserId('')
    setDeadline('')
    setColumn('Ideação')
    setPrefeitura(user?.prefeitura || (tenants.length > 0 ? tenants[0].name : 'Florânia'))
    setPriority('Baixa')
    setObjeto('')
    setJustificativa('')
    setShowAdvanced(false)
  }

  return (
    <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
      <DialogContent className="sm:max-w-[560px] bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#1c2a3e]">Criar Novo Projeto</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label htmlFor="title" className="text-xs font-semibold text-gray-700">
              Título do Projeto *
            </Label>
            <Input
              id="title"
              placeholder="Ex: Reforma da Praça Municipal"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 text-sm"
              required
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-xs font-semibold text-gray-700">
              Descrição
            </Label>
            <Textarea
              id="description"
              placeholder="Detalhes e escopo do projeto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[70px] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Responsável</Label>
              <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Selecione um responsável..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum Responsável</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Prazo *</Label>
              <Input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Prefeitura</Label>
              <Select
                value={prefeitura}
                onValueChange={setPrefeitura}
                disabled={!isSuperadmin && tenants.length <= 1}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Prefeitura" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.length > 0
                    ? tenants.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))
                    : PREFEITURAS.map((pref) => (
                        <SelectItem key={pref} value={pref}>
                          {pref}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Coluna Inicial</Label>
              <Select value={column} onValueChange={(v) => setColumn(v as ColumnType)}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Coluna" />
                </SelectTrigger>
                <SelectContent>
                  {COLUMNS.map((col) => (
                    <SelectItem key={col} value={col}>
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Média">Média</SelectItem>
                  <SelectItem value="Baixa">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-[#3b82f6] hover:underline font-medium pt-1"
            >
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              {showAdvanced
                ? 'Ocultar campos avançados (Objeto e Justificativa)'
                : 'Adicionar Objeto e Justificativa (Opcional)'}
            </button>

            {showAdvanced && (
              <div className="space-y-3 mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <Label htmlFor="objeto" className="text-xs font-semibold text-gray-700">
                    Objeto do Projeto
                  </Label>
                  <Textarea
                    id="objeto"
                    placeholder="Detalhamento do objeto de contratação ou parecer..."
                    value={objeto}
                    onChange={(e) => setObjeto(e.target.value)}
                    className="mt-1 min-h-[60px] text-xs bg-white"
                  />
                </div>

                <div>
                  <Label htmlFor="justificativa" className="text-xs font-semibold text-gray-700">
                    Justificativa
                  </Label>
                  <Textarea
                    id="justificativa"
                    placeholder="Justificativa de interesse público..."
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    className="mt-1 min-h-[60px] text-xs bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4 border-t flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsNewModalOpen(false)
                resetForm()
              }}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Criar Projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
