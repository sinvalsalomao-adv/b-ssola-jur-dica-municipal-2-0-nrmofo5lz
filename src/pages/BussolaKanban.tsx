import React, { useState } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { COLUMNS, PREFEITURAS, ColumnType, Project } from '@/types/project'
import {
  Plus,
  Filter,
  Calendar,
  User,
  Building2,
  MoreHorizontal,
  ArrowLeftRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function BussolaKanban() {
  const {
    projects,
    selectedCity,
    setSelectedCity,
    openProjectDetails,
    setIsNewModalOpen,
    moveProjectColumn,
  } = useProjects()

  const [draggedProjectId, setDraggedDraggedProjectId] = useState<string | null>(null)

  // Filter projects by city if selected
  const filteredProjects =
    selectedCity === 'Todas as Prefeituras'
      ? projects
      : projects.filter((p) => p.prefeitura === selectedCity)

  const getProjectsByColumn = (col: ColumnType) => {
    return filteredProjects.filter((p) => p.column === col)
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedDraggedProjectId(id)
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetColumn: ColumnType) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedProjectId
    if (id) {
      moveProjectColumn(id, targetColumn)
      setDraggedDraggedProjectId(null)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta':
        return 'bg-red-500'
      case 'Média':
        return 'bg-amber-500'
      case 'Baixa':
        return 'bg-emerald-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-[#1c2a3e]">Bússola de Projetos</h2>
          <p className="text-xs text-gray-500">
            Acompanhamento das 7 etapas dos processos jurídico-administrativos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[190px] h-9 text-xs font-medium">
                <SelectValue placeholder="Selecione a Prefeitura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas as Prefeituras">Todas as Prefeituras</SelectItem>
                {PREFEITURAS.map((pref) => (
                  <SelectItem key={pref} value={pref}>
                    {pref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-9 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1280px]">
          {COLUMNS.map((col) => {
            const columnProjects = getProjectsByColumn(col)

            return (
              <div
                key={col}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col)}
                className="w-[280px] bg-[#edf0f5] rounded-xl p-3 flex flex-col shrink-0 border border-slate-200/60 min-h-[600px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-xs uppercase tracking-wide text-[#1c2a3e]">
                      {col}
                    </h3>
                  </div>
                  <span className="bg-white text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full shadow-xs">
                    {columnProjects.length}
                  </span>
                </div>

                {/* Column Cards List */}
                <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {columnProjects.map((project) => {
                    const formattedDate = new Date(
                      project.deadline + 'T12:00:00',
                    ).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

                    return (
                      <Card
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project.id)}
                        onClick={() => openProjectDetails(project)}
                        className="bg-white hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing border border-gray-100 group relative"
                      >
                        <CardContent className="p-3.5 space-y-2">
                          {/* Top row: Priority dot & Prefeitura badge */}
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold text-slate-600 bg-slate-50 border-slate-200 py-0"
                            >
                              {project.prefeitura}
                            </Badge>

                            <div className="flex items-center gap-1">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${getPriorityColor(
                                  project.priority,
                                )}`}
                                title={`Prioridade: ${project.priority}`}
                              />
                              <span className="text-[10px] text-gray-500 font-medium">
                                {project.priority}
                              </span>

                              {/* Mobile / Direct move options menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-gray-400 hover:text-gray-700 p-0 ml-1"
                                  >
                                    <MoreHorizontal className="w-3.5 h-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 text-xs">
                                  <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase">
                                    Mover para
                                  </div>
                                  {COLUMNS.filter((c) => c !== col).map((targetCol) => (
                                    <DropdownMenuItem
                                      key={targetCol}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        moveProjectColumn(project.id, targetCol)
                                      }}
                                    >
                                      {targetCol}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className="font-bold text-sm text-[#1c2a3e] group-hover:text-[#3b82f6] transition-colors leading-snug">
                            {project.title}
                          </h4>

                          {/* Footer details */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="truncate max-w-[100px]">{project.responsible}</span>
                            </div>

                            <div className="flex items-center gap-1 font-medium text-slate-700">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>{formattedDate}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {columnProjects.length === 0 && (
                    <div className="h-28 border-2 border-dashed border-gray-300/70 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs">
                      <span>Nenhum projeto</span>
                      <span className="text-[10px] mt-0.5">Arraste um card aqui</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
