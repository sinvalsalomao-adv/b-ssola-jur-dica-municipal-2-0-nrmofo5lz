import React, { useState, useEffect, useMemo } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { COLUMNS, PREFEITURAS, ColumnType, Project } from '@/types/project'
import {
  Plus,
  Filter,
  Calendar,
  User,
  MoreHorizontal,
  Loader2,
  ArrowUpDown,
  X,
  FileText,
} from 'lucide-react'
import { exportProjectsToPdf } from '@/lib/pdfExporter'
import { formatDate } from '@/lib/dateUtils'
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
import { getUsers } from '@/services/users'

type SortOption = 'prazo' | 'priority' | 'recentes'

export default function BussolaKanban() {
  const {
    projects,
    loading,
    error,
    selectedCity,
    setSelectedCity,
    openProjectDetails,
    setIsNewModalOpen,
    moveProjectColumn,
  } = useProjects()

  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [responsibleFilter, setResponsibleFilter] = useState('Todos')
  const [sortBy, setSortBy] = useState<SortOption>('prazo')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    getUsers()
      .then((data) => setUsers(data.map((u) => ({ id: u.id, name: u.name }))))
      .catch(() => {})
  }, [])

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return []
    return projects.filter((p) => {
      if (!p) return false
      if (selectedCity !== 'Todas as Prefeituras') {
        const pCity = (p.prefeitura || '').toLowerCase().trim()
        const sCity = selectedCity.toLowerCase().trim()
        if (pCity && sCity && pCity !== sCity && !pCity.includes(sCity) && !sCity.includes(pCity)) {
          return false
        }
      }
      if (responsibleFilter !== 'Todos' && p.responsibleUserId !== responsibleFilter) return false
      return true
    })
  }, [projects, selectedCity, responsibleFilter])

  const sortProjects = (list: Project[]) => {
    return [...list].sort((a, b) => {
      if (sortBy === 'prazo') {
        const timeA = a.deadline
          ? new Date(a.deadline.substring(0, 10) + 'T00:00:00').getTime()
          : NaN
        const timeB = b.deadline
          ? new Date(b.deadline.substring(0, 10) + 'T00:00:00').getTime()
          : NaN
        const isValidA = !isNaN(timeA)
        const isValidB = !isNaN(timeB)
        if (!isValidA && !isValidB) return 0
        if (!isValidA) return 1
        if (!isValidB) return -1
        return timeA - timeB
      }
      if (sortBy === 'priority') {
        const priorityWeight: Record<string, number> = { Alta: 1, Média: 2, Baixa: 3 }
        return (priorityWeight[a.priority] || 2) - (priorityWeight[b.priority] || 2)
      }
      if (sortBy === 'recentes') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA)
      }
      return 0
    })
  }

  const getProjectsByColumn = (col: ColumnType) => {
    const colProjects = filteredProjects.filter((p) => p.column === col)
    return sortProjects(colProjects)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedProjectId(id)
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
      setDraggedProjectId(null)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#3b82f6]" />
      </div>
    )
  }

  if (error && projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-3 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
        <p className="text-red-500 text-sm font-medium">{error}</p>
        <p className="text-gray-400 text-xs">Não foi possível carregar os projetos no momento.</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
          className="text-xs"
        >
          Tentar Novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-lg font-bold text-[#1c2a3e]">Bússola de Projetos</h2>
          <p className="text-xs text-gray-500">
            Acompanhamento das 7 etapas dos processos jurídico-administrativos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filter by Prefeitura */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 shrink-0" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-medium">
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

          {/* Filter by Responsible */}
          <div className="flex items-center gap-1.5">
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-[190px] h-9 text-xs font-medium">
                <SelectValue placeholder="Filtrar por Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos Responsáveis</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {responsibleFilter !== 'Todos' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setResponsibleFilter('Todos')}
                title="Limpar Filtro"
                className="h-9 w-9 text-gray-400 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-medium">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prazo">Prazo (Mais Próximo)</SelectItem>
                <SelectItem value="priority">Prioridade (Alta &gt; Baixa)</SelectItem>
                <SelectItem value="recentes">Mais Recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() =>
              exportProjectsToPdf(filteredProjects, 'Relatório de Projetos - Bússola', selectedCity)
            }
            className="h-9 px-3 text-xs gap-1.5 border-slate-300 hover:bg-slate-50 text-[#1c2a3e] font-medium ml-auto sm:ml-0"
          >
            <FileText className="w-4 h-4 text-red-600" />
            Exportar PDF
          </Button>

          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white h-9 px-3 text-xs gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Button>
        </div>
      </div>

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
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="font-bold text-xs uppercase tracking-wide text-[#1c2a3e]">
                    {col}
                  </h3>
                  <span className="bg-white text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full shadow-xs">
                    {columnProjects.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
                  {columnProjects.map((project) => {
                    const formattedDate = formatDate(project.deadline, 'Sem prazo')
                    return (
                      <Card
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project.id)}
                        onClick={() => openProjectDetails(project)}
                        className="bg-white hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing border border-gray-100 group relative"
                      >
                        <CardContent className="p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold text-slate-600 bg-slate-50 border-slate-200 py-0"
                            >
                              {project.prefeitura || 'Prefeitura'}
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

                          <h4 className="font-bold text-sm text-[#1c2a3e] group-hover:text-[#3b82f6] transition-colors leading-snug">
                            {project.title}
                          </h4>

                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-gray-400" />
                              <span className="truncate max-w-[100px]">
                                {project.responsible || 'Sem responsável'}
                              </span>
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
                      <span className="text-[10px] mt-0.5">
                        {responsibleFilter !== 'Todos'
                          ? 'Com os filtros atuais'
                          : 'Arraste um card aqui'}
                      </span>
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
