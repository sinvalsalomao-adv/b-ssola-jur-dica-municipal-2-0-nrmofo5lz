import React, { useState } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { COLUMNS, PREFEITURAS, USERS, ColumnType, Prefecture, Priority } from '@/types/project'
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
import { toast } from 'sonner'

export const NewProjectModal: React.FC = () => {
  const { isNewModalOpen, setIsNewModalOpen, addProject } = useProjects()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState(USERS[0])
  const [deadline, setDeadline] = useState('')
  const [column, setColumn] = useState<ColumnType>('Ideação')
  const [prefeitura, setPrefeitura] = useState<Prefecture>('Florânia')
  const [priority, setPriority] = useState<Priority>('Média')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('O título do projeto é obrigatório.')
      return
    }
    if (!deadline) {
      toast.error('Informe a data limite para o prazo.')
      return
    }

    addProject({
      title: title.trim(),
      description,
      responsible,
      deadline,
      column,
      prefeitura,
      priority,
    })

    toast.success('Projeto criado com sucesso!')
    setIsNewModalOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setResponsible(USERS[0])
    setDeadline('')
    setColumn('Ideação')
    setPrefeitura('Florânia')
    setPriority('Média')
  }

  return (
    <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
      <DialogContent className="sm:max-w-[540px] bg-white rounded-xl shadow-xl">
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
              className="mt-1"
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
              className="mt-1 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Responsável</Label>
              <Select value={responsible} onValueChange={setResponsible}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {USERS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
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
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Prefeitura</Label>
              <Select value={prefeitura} onValueChange={(v) => setPrefeitura(v as Prefecture)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Prefeitura" />
                </SelectTrigger>
                <SelectContent>
                  {PREFEITURAS.map((pref) => (
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
                <SelectTrigger className="mt-1">
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
                <SelectTrigger className="mt-1">
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
            <Button type="submit" className="bg-[#3b82f6] hover:bg-[#2563eb] text-white">
              Criar Projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
