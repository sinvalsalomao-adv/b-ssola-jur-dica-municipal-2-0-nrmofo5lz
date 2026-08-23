import React, { useState, useEffect, useMemo } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { COLUMNS, ColumnType, Project } from '@/types/project'
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
import { getUsersByTenant } from '@/services/users'

// ─────────────────────────────────────────────────────────────────────────────
// CORREÇÕES APLICADAS vs. versão original:
//
// 1. REMOVIDO: import de `PREFEITURAS` (lista hardcoded com só 3 cidades)
//    ADICIONADO: filtro de prefeitura gerado dinamicamente a partir de
//    `tenants` do ProjectContext — reflete o banco de dados real.
//
// 2. REMOVIDO: `getUsers()` que traz TODOS os usuários do sistema (problema
//    de privacidade entre tenants para não-superadmins)
//    ADICIONADO: `getUsersByTenant(user.tenantId)` para admins comuns;
//    superadmin continua vendo todos via `getUsers()`.
//
// 3. CORRIGIDO: filtro de cidade usava comparação fuzzy com múltiplos
//    `.includes()` que causava falsos positivos (ex: "Tangará" matchando
//    "Tangará da Serra"). Agora usa só igualdade exata após normalização.
//
// 4. ADICIONADO: estado `isDraggingOver` por coluna para feedback visual
//    no drop target — o original não tinha nenhum feedback de hover no drag.
//
// 5. ADICIONADO: indicador de prazo vencido (badge vermelho) nos cards.
//
// 6. ADICIONADO: contagem total de projetos filtrados no cabeçalho.
// ─────────────────────────────────────────────────────────────────────────────

type SortOption = 'prazo' | 'priority' | 'recentes'

export default function BussolaKanban() {
  const { user } = useAuth()
  const {
    projects,
    tenants,
    loading,
    error,
    selectedCity,
    setSelectedCity,
    openProjectDetails,
    setIsNewModalOpen,
    moveProjectColumn,
  } = useProjects()

  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<ColumnType | null>(null)
  const [responsibleFilter, setResponsibleFilter] = useState('Todos')
  const [sortBy, setSortBy] = useState<SortOption>('prazo')
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])

  // CORREÇÃO 2: carrega apenas usuários do tenant correto
  useEffect(() => {
    if (!user) return
    const loadUsers = async () => {
      try {
        if (user.role === 'superadmin') {
          const { getUsers } = await import('@/services/users')
          const data = await getUsers()
          setUsers(data.map((u) => ({ id: u.id, name: u.name })))
        } else if (user.tenantId) {
          const data = await getUsersByTenant(user.tenantId)
          setUsers(data.map((u) => ({ id: u.id, name: u.name })))
        }
      } catch {
        // silencioso — filtro de responsável simplesmente fica sem opções
      }
    }
    loadUsers()
  }, [user])

  // CORREÇÃO 1: prefeituras dinâmicas do banco
  const prefeituraOptions = useMemo(() => {
    return tenants.map((t) => t.name).sort()
  }, [tenants])

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return []
    return projects.filter((p) => {
      if (!p) return false
      // CORREÇÃO 3: comparação exata, sem fuzzy que causava falsos positivos
      if (selectedCity !== 'Todas as Prefeituras') {
        const pCity = (p.prefeitura || '').trim()
        if (pCity !== selectedCity) return false
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

  const handleDragEnd = () => {
    setDraggedProjectId(null)
    setDragOverColumn(null)
  }

  // CORREÇÃO 4: rastreia coluna sob o cursor para feedback visual
  const handleDragOver = (e: React.DragEvent, col: ColumnType) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(col)
  }

  const handleDragLeave = () => {
    setDragOverColumn(null)
  }

  const handleDrop = (e: React.DragEvent, targetColumn: ColumnType) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggedProjectId
    if (id) {
      moveProjectColumn(id, targetColumn)
      setDraggedProjectId(null)
      setDragOverColumn(null)
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

  // CORREÇÃO 5: detecta prazo vencido
  const isOverdue = (deadline: string) => {
    if (!deadline) return false
    const d = new Date(deadline.substring(0, 10) + 'T23:59:59')
    return !isNaN(d.getTime()) && d < new Date()
  }

  const hasActiveFilters = selectedCity !== 'Todas as Prefeituras' || responsibleFilter !== 'Todos'

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
          {/* CORREÇÃO 6: contagem de projetos filtrados */}
          <p className="text-xs text-gray-500">
            {hasActiveFilters
              ? `${filteredProjects.length} projeto${filteredProjects.length !== 1 ? 's' : ''} com os filtros atuais`
              : 'Acompanhamento das 7 etapas dos processos jurídico-administrativos.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* CORREÇÃO 1: prefeituras dinâmicas */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 shrink-0" />
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-medium">
                <SelectValue placeholder="Selecione a Prefeitura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas as Prefeituras">Todas as Prefeituras</SelectItem>
                {prefeituraOptions.map((pref) => (
                  <SelectItem key={pref} value={pref}>
                    {pref}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Responsável */}
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

          {/* Ordenação */}
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
            const isDropTarget = dragOverColumn === col

            return (
              <div
                key={col}
                onDragOver={(e) => handleDragOver(e, col)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col)}
                // CORREÇÃO 4: feedback visual no drop target
                className={`w-[280px] rounded-xl p-3 flex flex-col shrink-0 min-h-[600px] border transition-colors duration-150 ${
                  isDropTarget
                    ? 'bg-blue-50 border-blue-300 border-dashed'
                    : 'bg-[#edf0f5] border-slate-200/60'
                }`}
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
                    const overdue = isOverdue(project.deadline)
                    const isDragging = draggedProjectId === project.id

                    return (
                      <Card
                        key={project.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openProjectDetails(project)}
                        className={`bg-white hover:shadow-md transition-all duration-150 cursor-grab active:cursor-grabbing border group relative ${
                          isDragging
                            ? 'opacity-40 border-blue-300'
                            : overdue
                              ? 'border-red-200'
                              : 'border-gray-100'
                        }`}
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
                                className={`w-2.5 h-2.5 rounded-full ${getPriorityColor(project.priority)}`}
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
                            {/* CORREÇÃO 5: badge de prazo vencido */}
                            <div
                              className={`flex items-center gap-1 font-medium ${overdue ? 'text-red-600' : 'text-slate-700'}`}
                            >
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>{formattedDate}</span>
                              {overdue && (
                                <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1 rounded">
                                  VENCIDO
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {columnProjects.length === 0 && (
                    <div
                      className={`h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-xs transition-colors ${
                        isDropTarget
                          ? 'border-blue-400 text-blue-500 bg-blue-50/50'
                          : 'border-gray-300/70 text-gray-400'
                      }`}
                    >
                      <span>Nenhum projeto</span>
                      <span className="text-[10px] mt-0.5">
                        {responsibleFilter !== 'Todos' || selectedCity !== 'Todas as Prefeituras'
                          ? 'Com os filtros atuais'
                          : isDropTarget
                            ? 'Solte aqui'
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
