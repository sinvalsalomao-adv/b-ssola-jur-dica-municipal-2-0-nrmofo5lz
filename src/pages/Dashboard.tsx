import React from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Building2,
  Calendar,
  User,
  Plus,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function Dashboard() {
  const { projects, openProjectDetails, setIsNewModalOpen } = useProjects()
  const navigate = useNavigate()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Metrics
  const totalProjects = projects.length

  const inProgressProjects = projects.filter(
    (p) =>
      p.column === 'Projeto Executivo' ||
      p.column === 'Elaborar DFD' ||
      p.column === 'Procedimentos Internos' ||
      p.column === 'Execução' ||
      p.column === 'Prestação de Contas' ||
      p.column === 'Marketing',
  ).length

  const overdueProjects = projects.filter((p) => {
    if (p.column === 'Marketing') return false // Finished column
    const deadlineDate = new Date(p.deadline + 'T23:59:59')
    return deadlineDate < today
  }).length

  const finishedThisMonth = projects.filter((p) => {
    if (p.column !== 'Marketing') return false
    const updateDate = new Date(p.updatedAt)
    return (
      updateDate.getMonth() === today.getMonth() && updateDate.getFullYear() === today.getFullYear()
    )
  }).length

  // Urgent Projects List (5 closest deadlines)
  const urgentProjects = [...projects]
    .filter((p) => p.column !== 'Marketing')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)

  const getDeadlineStatus = (deadlineStr: string) => {
    const deadlineDate = new Date(deadlineStr + 'T23:59:59')
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 3600 * 24))

    if (diffDays < 0) return 'overdue'
    if (diffDays <= 7) return 'near'
    return 'normal'
  }

  const handleRowClick = (project: any) => {
    navigate('/bussola')
    setTimeout(() => {
      openProjectDetails(project)
    }, 100)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#1c2a3e]">
            Gestão Integrada de Projetos Municipais
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Acompanhe em tempo real as etapas jurídicas, licitatórias e operacionais das
            prefeituras.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Button>
          <Button
            onClick={() => navigate('/bussola')}
            variant="outline"
            className="border-gray-200 text-[#1c2a3e] hover:bg-slate-50 gap-2"
          >
            Ver Quadro Bússola
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <Card className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Total de Projetos
              </p>
              <h3 className="text-3xl font-extrabold text-[#1c2a3e] mt-2">{totalProjects}</h3>
              <p className="text-xs text-gray-400 mt-1">Em todas as prefeituras</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#3b82f6] flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2 */}
        <Card className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Em Andamento
              </p>
              <h3 className="text-3xl font-extrabold text-blue-600 mt-2">{inProgressProjects}</h3>
              <p className="text-xs text-gray-400 mt-1">Fases ativas no quadro</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3 */}
        <Card className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Atrasados
              </p>
              <h3 className="text-3xl font-extrabold text-red-600 mt-2">{overdueProjects}</h3>
              <p className="text-xs text-red-500 font-medium mt-1">Necessitam atenção</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4 */}
        <Card className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Concluídos no Mês
              </p>
              <h3 className="text-3xl font-extrabold text-emerald-600 mt-2">{finishedThisMonth}</h3>
              <p className="text-xs text-emerald-600 font-medium mt-1">Finalizados / Marketing</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgent Projects Section */}
      <Card className="bg-white border-0 shadow-subtle">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              Projetos Urgentes
              <span className="text-xs font-normal text-gray-500">(prazos mais curtos)</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Acompanhe prioridades críticas e prazos prestes a vencer.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/bussola')}
            className="text-xs text-[#3b82f6] hover:bg-blue-50"
          >
            Ver todos no Kanban
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow>
                <TableHead className="text-xs font-semibold text-gray-600">
                  Nome do Projeto
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Prefeitura</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Responsável</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">
                  Etapa / Status
                </TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Prazo</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {urgentProjects.map((project) => {
                const status = getDeadlineStatus(project.deadline)
                const formattedDate = new Date(project.deadline + 'T12:00:00').toLocaleDateString(
                  'pt-BR',
                )

                let rowBgClass = 'hover:bg-slate-50'
                let dateBadge = null

                if (status === 'overdue') {
                  rowBgClass = 'bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-500'
                  dateBadge = (
                    <Badge variant="destructive" className="text-[10px] uppercase tracking-wider">
                      Atrasado
                    </Badge>
                  )
                } else if (status === 'near') {
                  rowBgClass = 'bg-amber-50/60 hover:bg-amber-50 border-l-4 border-l-amber-500'
                  dateBadge = (
                    <Badge className="bg-amber-500 text-white text-[10px] uppercase tracking-wider">
                      Próximo Vencimento
                    </Badge>
                  )
                }

                return (
                  <TableRow
                    key={project.id}
                    onClick={() => handleRowClick(project)}
                    className={`cursor-pointer transition-colors ${rowBgClass}`}
                  >
                    <TableCell className="font-semibold text-sm text-[#1c2a3e] max-w-[260px] truncate">
                      {project.title}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {project.prefeitura}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        {project.responsible}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                        {project.column}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-800">{formattedDate}</span>
                        {dateBadge}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRowClick(project)
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100/50"
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
