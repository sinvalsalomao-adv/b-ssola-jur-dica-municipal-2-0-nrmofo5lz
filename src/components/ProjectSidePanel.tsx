import React, { useState, useEffect } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { COLUMNS, PREFEITURAS, USERS, ColumnType, Prefecture, Priority } from '@/types/project'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
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
import { Badge } from '@/components/ui/badge'
import { Trash2, Save, Calendar, User, Building2, Flag } from 'lucide-react'
import { toast } from 'sonner'

export const ProjectSidePanel: React.FC = () => {
  const { selectedProject, isSidePanelOpen, setIsSidePanelOpen, updateProject, deleteProject } =
    useProjects()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [responsible, setResponsible] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState<Priority>('Média')
  const [prefeitura, setPrefeitura] = useState<Prefecture>('Florânia')
  const [column, setColumn] = useState<ColumnType>('Ideação')

  useEffect(() => {
    if (selectedProject) {
      setTitle(selectedProject.title)
      setDescription(selectedProject.description || '')
      setResponsible(selectedProject.responsible)
      setDeadline(selectedProject.deadline)
      setPriority(selectedProject.priority)
      setPrefeitura(selectedProject.prefeitura)
      setColumn(selectedProject.column)
    }
  }, [selectedProject])

  if (!selectedProject) return null

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('O título do projeto não pode ficar em branco.')
      return
    }

    updateProject(selectedProject.id, {
      title: title.trim(),
      description,
      responsible,
      deadline,
      priority,
      prefeitura,
      column,
    })

    toast.success('Projeto atualizado!')
    setIsSidePanelOpen(false)
  }

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja excluir este projeto?')) {
      deleteProject(selectedProject.id)
      toast.success('Projeto removido.')
    }
  }

  const formattedCreated = new Date(selectedProject.createdAt).toLocaleDateString('pt-BR')
  const formattedUpdated = new Date(selectedProject.updatedAt).toLocaleDateString('pt-BR')

  return (
    <Sheet open={isSidePanelOpen} onOpenChange={setIsSidePanelOpen}>
      <SheetContent className="w-full sm:max-w-[440px] bg-white p-6 overflow-y-auto flex flex-col justify-between">
        <div>
          <SheetHeader className="text-left border-b pb-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                {prefeitura}
              </Badge>
              <Badge
                className={
                  priority === 'Alta'
                    ? 'bg-red-500 text-white'
                    : priority === 'Média'
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                }
              >
                {priority}
              </Badge>
            </div>
            <SheetTitle className="text-lg font-bold text-[#1c2a3e]">
              Detalhes do Projeto
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500">
              ID: {selectedProject.id} • Criado em {formattedCreated}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 text-sm font-medium"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-h-[90px] text-sm text-gray-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  Responsável
                </Label>
                <Select value={responsible} onValueChange={setResponsible}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" />
                  Prazo
                </Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-gray-500" />
                  Prefeitura
                </Label>
                <Select value={prefeitura} onValueChange={(v) => setPrefeitura(v as Prefecture)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
                <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                  <Flag className="w-3.5 h-3.5 text-gray-500" />
                  Prioridade
                </Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
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
              <Label className="text-xs font-semibold text-gray-700">Etapa Atual</Label>
              <Select value={column} onValueChange={(v) => setColumn(v as ColumnType)}>
                <SelectTrigger className="mt-1 bg-slate-50 font-medium">
                  <SelectValue />
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

            <div className="pt-2 text-xs text-gray-400">Última atualização: {formattedUpdated}</div>
          </div>
        </div>

        <SheetFooter className="border-t pt-4 mt-6 flex-row justify-between items-center space-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 hover:bg-red-50"
            title="Excluir projeto"
          >
            <Trash2 className="w-5 h-5" />
          </Button>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsSidePanelOpen(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5"
            >
              <Save className="w-4 h-4" />
              Salvar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
