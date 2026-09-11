import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FolderKanban,
  Clock,
  Bell,
  Users,
  GraduationCap,
  Calendar,
  Building2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import { formatDate } from '@/lib/dateUtils'
import { getUnreadNotifications } from '@/services/notifications'
import { getUserGroupMemberships } from '@/services/academia'
import type { NotificationItem } from '@/types/controle'
import type { EducationGroupMemberRecord } from '@/types/academia'

export function UserPersonalDashboard() {
  const { user } = useAuth()
  const { projects, openProjectDetails } = useProjects()
  const navigate = useNavigate()

  const [personalNotifs, setPersonalNotifs] = useState<NotificationItem[]>([])
  const [eduGroups, setEduGroups] = useState<EducationGroupMemberRecord[]>([])
  const [loadingExtras, setLoadingExtras] = useState(true)

  // 1. Filtrar projetos sob responsabilidade direta do usuário
  const myProjects = useMemo(() => {
    if (!user?.id) return []
    return projects.filter((p) => p.responsibleUserId === user.id)
  }, [projects, user?.id])

  // 2. Filtrar prazos próximos e vencidos dos projetos do usuário
  const { upcomingDeadlines, overdueCount } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let overdue = 0
    const upcoming = myProjects.filter((p) => {
      if (p.column === 'Marketing' || !p.deadline) return false
      const d = new Date(p.deadline + 'T23:59:59')
      if (isNaN(d.getTime())) return false
      const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
      if (diffDays < 0) overdue += 1
      return diffDays >= 0 && diffDays <= 7
    })
    return { upcomingDeadlines: upcoming, overdueCount: overdue }
  }, [myProjects])

  // 3. Carregar notificações recentes e grupos educacionais vinculados
  const loadPersonalData = useCallback(async () => {
    if (!user?.tenantId || !user?.id) return
    try {
      const [notifs, groups] = await Promise.all([
        getUnreadNotifications(user.tenantId, 10, user.id),
        getUserGroupMemberships(user.id, user.tenantId).catch(() => []),
      ])
      setPersonalNotifs(notifs)
      setEduGroups(groups)
    } catch {
      /* ignore */
    } finally {
      setLoadingExtras(false)
    }
  }, [user?.tenantId, user?.id])

  useEffect(() => {
    loadPersonalData()
  }, [loadPersonalData])

  useRealtime('notifications', () => loadPersonalData(), !!user?.tenantId)
  useRealtime('notification_reads', () => loadPersonalData(), !!user?.id)
  useRealtime('education_group_members', () => loadPersonalData(), !!user?.id)

  const handleOpenProject = (p: any) => {
    navigate('/bussola')
    setTimeout(() => openProjectDetails(p), 120)
  }

  const handleOpenNotification = (n: NotificationItem) => {
    const projId = n.projetoId || n.projectId
    if (projId) {
      navigate('/bussola')
      const targetTab = n.alertType === 'Mencao' ? 'comments' : 'details'
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('openProjectById', { detail: { projectId: projId, tab: targetTab } }),
        )
      }, 150)
    } else {
      navigate('/notificacoes')
    }
  }

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Pessoais do Usuário */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/bussola')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Meus Trabalhos
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-[#3b82f6]">{myProjects.length}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {myProjects.filter((p) => p.column !== 'Marketing').length} em andamento
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#3b82f6] flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
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
              <h3 className="text-3xl font-extrabold mt-2 text-amber-600">
                {upcomingDeadlines.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {overdueCount > 0 ? (
                  <span className="text-red-600 font-semibold">{overdueCount} atrasado(s)</span>
                ) : (
                  'Próximos 7 dias'
                )}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
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
                Minhas Notificações
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-purple-600">
                {personalNotifs.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Não lidas</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/academia')}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Meus Grupos
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-emerald-600">{eduGroups.length}</h3>
              <p className="text-xs text-gray-400 mt-1">Academia Municipal</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Seções: Trabalhos e Prazos vs Alertas e Grupos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção 1: Meus Projetos e Prazos */}
        <Card className="bg-white border-0 shadow-subtle">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#3b82f6]" /> Meus Projetos em Andamento
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Demandas onde você é o responsável técnico direto
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/bussola')}
              className="text-xs text-[#3b82f6]"
            >
              Ver Kanban <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {myProjects.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Você não possui projetos atribuídos no momento.
              </div>
            ) : (
              myProjects.slice(0, 5).map((p) => {
                const isOverdue =
                  p.column !== 'Marketing' &&
                  p.deadline &&
                  new Date(p.deadline + 'T23:59:59') < new Date()
                return (
                  <div
                    key={p.id}
                    onClick={() => handleOpenProject(p)}
                    className="p-3 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-slate-50/70 transition-all cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-[#1c2a3e] truncate">{p.title}</h4>
                        <Badge variant="outline" className="text-[10px] py-0">
                          {p.column}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-gray-400" />
                          {p.prefeitura || 'Prefeitura'}
                        </span>
                        <span
                          className={`flex items-center gap-1 ${
                            isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(p.deadline, 'Sem prazo')}
                          {isOverdue && ' (Vencido)'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      Abrir
                    </Button>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Seção 2: Alertas Recentes & Notificações para o Usuário */}
        <Card className="bg-white border-0 shadow-subtle">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-600" /> Notificações Recentes
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Avisos internos, prazos e menções dirigidas a você
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/notificacoes')}
              className="text-xs text-purple-600"
            >
              Ver todas <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {personalNotifs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                Nenhuma notificação pendente no momento. Tudo em dia!
              </div>
            ) : (
              personalNotifs.slice(0, 5).map((n) => {
                const isFatal = n.alertType === 'Prazo Fatal'
                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpenNotification(n)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                      isFatal
                        ? 'border-red-100 bg-red-50/30 hover:bg-red-50/60'
                        : 'border-gray-100 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isFatal ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isFatal ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1c2a3e] truncate">
                          {n.projectTitle}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 ${
                            isFatal ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {n.alertType}
                        </Badge>
                      </div>
                      {n.mensagem && (
                        <p className="text-[11px] text-gray-600 line-clamp-1 mt-0.5">
                          {n.mensagem}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 self-center" />
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seção 3: Meus Grupos na Academia Municipal */}
      {eduGroups.length > 0 && (
        <Card className="bg-white border-0 shadow-subtle">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" /> Minhas Trilhas e Grupos de
                Capacitação
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Grupos educacionais da Academia aos quais você está vinculado
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/academia')}
              className="text-xs text-emerald-600"
            >
              Acessar Academia <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {eduGroups.map((m) => {
              const grp = m.expand?.group
              const sec = grp?.expand?.secretaria
              return (
                <div
                  key={m.id}
                  onClick={() => navigate('/academia')}
                  className="p-3 rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-[#1c2a3e] truncate">
                      {grp?.nome || 'Grupo Educacional'}
                    </h5>
                    <Badge className="text-[9px] bg-emerald-500 text-white">Ativo</Badge>
                  </div>
                  {sec && (
                    <p className="text-[10px] text-blue-600 font-medium mt-1 truncate">
                      {sec.nome}
                    </p>
                  )}
                  {grp?.descricao && (
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{grp.descricao}</p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
