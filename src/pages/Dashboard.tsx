import { useState, useEffect, useCallback } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useRealtime } from '@/hooks/use-realtime'
import { getUnreadNotificationsCount } from '@/services/notifications'
import { FolderKanban, Bell, Clock, ArrowRight, Plus, Calendar, Building2 } from 'lucide-react'
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const loadUnreadCount = useCallback(async () => {
    if (!user?.tenantId) return
    try {
      const count = await getUnreadNotificationsCount(user.tenantId)
      setUnreadCount(count)
    } catch {
      // ignore
    }
  }, [user?.tenantId])

  useEffect(() => {
    loadUnreadCount()
  }, [loadUnreadCount])

  useRealtime(
    'notifications',
    () => {
      loadUnreadCount()
    },
    !!user?.tenantId,
  )

  const activeProjects = projects.filter((p) => p.column !== 'Marketing').length

  const upcomingDeadlines = projects.filter((p) => {
    if (p.column === 'Marketing' || !p.deadline) return false
    const deadlineDate = new Date(p.deadline + 'T23:59:59')
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 3600 * 24))
    return diffDays >= 0 && diffDays <= 7
  }).length

  const recentProjects = [...projects].slice(0, 5)

  const handleRowClick = (project: any) => {
    navigate('/bussola')
    setTimeout(() => {
      openProjectDetails(project)
    }, 100)
  }

  return (
    <div className="space-y-6 animate-fade-in">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/bussola')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Projetos Ativos
              </p>
              <h3 className="text-3xl font-extrabold text-[#1c2a3e] mt-2">{activeProjects}</h3>
              <p className="text-xs text-gray-400 mt-1">Não finalizados</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#3b82f6] flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/notificacoes')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Notificações Pendentes
              </p>
              <h3 className="text-3xl font-extrabold text-amber-600 mt-2">{unreadCount}</h3>
              <p className="text-xs text-amber-500 font-medium mt-1">Aguardando leitura</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/bussola')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Prazos Próximos
              </p>
              <h3 className="text-3xl font-extrabold text-red-600 mt-2">{upcomingDeadlines}</h3>
              <p className="text-xs text-red-500 font-medium mt-1">Próximos 7 dias</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-0 shadow-subtle">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1c2a3e]">Projetos Recentes</h3>
            <p className="text-xs text-gray-500 mt-0.5">Últimas atualizações no sistema.</p>
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
                <TableHead className="text-xs font-semibold text-gray-600">Etapa</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600">Prazo</TableHead>
                <TableHead className="text-xs font-semibold text-gray-600 text-right">
                  Ação
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentProjects.map((project) => {
                const formattedDate = project.deadline
                  ? new Date(project.deadline + 'T12:00:00').toLocaleDateString('pt-BR')
                  : '—'
                return (
                  <TableRow
                    key={project.id}
                    onClick={() => handleRowClick(project)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
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
                    <TableCell>
                      <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-700">
                        {project.column}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-800">{formattedDate}</span>
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
              {recentProjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-gray-400 py-8">
                    Nenhum projeto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
