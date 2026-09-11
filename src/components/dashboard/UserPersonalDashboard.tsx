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
import { getParticipantsByTenant } from '@/services/participants'
import { sanitizeError } from '@/lib/errorSanitizer'
import type { NotificationItem } from '@/types/controle'
import type { EducationGroupMemberRecord } from '@/types/academia'
import type { ProjectParticipant } from '@/types/project'
import { AtSign, Sparkles, RefreshCw } from 'lucide-react'

export function UserPersonalDashboard() {
  const { user } = useAuth()
  const {
    projects,
    openProjectDetails,
    loading: loadingProjects,
    error: projectsError,
  } = useProjects()
  const navigate = useNavigate()

  const [personalNotifs, setPersonalNotifs] = useState<NotificationItem[]>([])
  const [eduGroups, setEduGroups] = useState<EducationGroupMemberRecord[]>([])
  const [participantsMap, setParticipantsMap] = useState<Record<string, ProjectParticipant[]>>({})
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 1. Carregar participantes, notificações recentes e grupos educacionais vinculados
  const loadPersonalData = useCallback(async () => {
    if (!user?.tenantId || !user?.id) return
    setLoadingExtras(true)
    setLoadError(null)
    try {
      const [notifs, groups, parts] = await Promise.all([
        getUnreadNotifications(user.tenantId, 20, user.id),
        getUserGroupMemberships(user.id, user.tenantId).catch(() => []),
        getParticipantsByTenant(user.tenantId).catch(() => ({})),
      ])
      setPersonalNotifs(notifs)
      setEduGroups(groups)
      setParticipantsMap(parts || {})
    } catch (err) {
      setLoadError(sanitizeError(err).message || 'Erro ao carregar dados operacionais.')
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
  useRealtime('project_participants', () => loadPersonalData(), !!user?.tenantId)

  // 2. Filtrar "Meu Trabalho": responsável direto OU participante do projeto
  const myProjects = useMemo(() => {
    if (!user?.id) return []
    return projects.filter((p) => {
      const isDirectResp = p.responsibleUserId === user.id
      const isParticipant = (participantsMap[p.id] || []).some((part) => part.userId === user.id)
      return isDirectResp || isParticipant
    })
  }, [projects, user?.id, participantsMap])

  // 3. Filtrar prazos próximos e vencidos de "Meu Trabalho"
  const { upcomingProjects, overdueProjects } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const upcoming: typeof myProjects = []
    const overdue: typeof myProjects = []

    myProjects.forEach((p) => {
      if (p.column === 'Marketing' || !p.deadline) return
      const d = new Date(p.deadline.substring(0, 10) + 'T23:59:59')
      if (isNaN(d.getTime())) return
      const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000)
      if (diffDays < 0) {
        overdue.push(p)
      } else if (diffDays <= 7) {
        upcoming.push(p)
      }
    })
    return { upcomingProjects: upcoming, overdueProjects: overdue }
  }, [myProjects])

  // 4. Filtrar menções específicas
  const mentionsNotifs = useMemo(() => {
    return personalNotifs.filter(
      (n) =>
        n.alertType === 'Mencao' ||
        (n.projectTitle && n.projectTitle.toLowerCase().includes('mencionou')) ||
        (n.mensagem && n.mensagem.toLowerCase().includes('mencionou')),
    )
  }, [personalNotifs])
  const handleOpenProject = (p: any) => {
    navigate(`/bussola?project=${p.id}`)
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

  const isLoading = loadingProjects || loadingExtras
  const hasError = projectsError || loadError

  return (
    <div className="space-y-6">
      {hasError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{hasError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadPersonalData()}
            className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100/50"
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Recarregar
          </Button>
        </div>
      )}

      {/* Cards de Métricas Pessoais do Usuário ("Meu Trabalho" Real) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Meu Trabalho Total */}
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/bussola?quick=meus')}
          title="Clique para abrir 'Meu Trabalho' no Kanban"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Meu Trabalho
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-[#3b82f6]">
                {isLoading ? '—' : myProjects.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {isLoading
                  ? 'Carregando registros...'
                  : `${myProjects.filter((p) => p.column !== 'Marketing').length} em andamento`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#3b82f6] flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* 2. Meus Prazos Vencidos & Próximos */}
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() =>
            navigate(
              overdueProjects.length > 0 ? '/bussola?quick=atrasados' : '/bussola?quick=proximos',
            )
          }
          title="Clique para ver itens com prazos críticos no Kanban"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Prazos do Meu Trabalho
              </p>
              <h3
                className={`text-3xl font-extrabold mt-2 ${
                  overdueProjects.length > 0 ? 'text-red-600' : 'text-amber-600'
                }`}
              >
                {isLoading
                  ? '—'
                  : overdueProjects.length > 0
                    ? overdueProjects.length
                    : upcomingProjects.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {isLoading ? (
                  'Calculando prazos...'
                ) : overdueProjects.length > 0 ? (
                  <span className="text-red-600 font-semibold">
                    {overdueProjects.length} vencido(s) • {upcomingProjects.length} próximo(s)
                  </span>
                ) : (
                  `${upcomingProjects.length} nos próximos 7 dias`
                )}
              </p>
            </div>
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                overdueProjects.length > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {overdueProjects.length > 0 ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3. Menções Direcionadas */}
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/notificacoes')}
          title="Clique para abrir notificações e menções"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Menções e Avisos
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-purple-600">
                {isLoading ? '—' : personalNotifs.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {isLoading
                  ? 'Carregando...'
                  : `${mentionsNotifs.length} menç${mentionsNotifs.length === 1 ? 'ão direta' : 'ões diretas'}`}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <AtSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* 4. Acesso a Grupos Educacionais da Academia */}
        <Card
          className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
          onClick={() => navigate('/academia')}
          title="Clique para ir à Academia Municipal"
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Meus Grupos
              </p>
              <h3 className="text-3xl font-extrabold mt-2 text-emerald-600">
                {isLoading ? '—' : eduGroups.length}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Academia Municipal</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Seções: Trabalhos e Prazos vs Alertas e Menções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seção 1: Meu Trabalho (Projetos em Andamento e Prazos) */}
        <Card className="bg-white border-0 shadow-subtle">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#3b82f6]" /> Meu Trabalho
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Projetos e processos onde você é responsável direto ou participante
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/bussola?quick=meus')}
              className="text-xs text-[#3b82f6]"
            >
              Ver no Kanban <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            {isLoading ? (
              <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando seus trabalhos...</span>
              </div>
            ) : myProjects.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <FolderKanban className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                Você não possui processos atribuídos no momento como responsável ou participante.
              </div>
            ) : (
              myProjects.slice(0, 6).map((p) => {
                const isOverdue =
                  p.column !== 'Marketing' &&
                  p.deadline &&
                  new Date(p.deadline.substring(0, 10) + 'T23:59:59') < new Date()
                const isDirectResp = p.responsibleUserId === user?.id
                return (
                  <div
                    key={p.id}
                    onClick={() => handleOpenProject(p)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isOverdue
                        ? 'border-red-200 bg-red-50/20 hover:bg-red-50/50'
                        : 'border-gray-100 hover:border-blue-200 hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-xs text-[#1c2a3e] truncate">{p.title}</h4>
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 bg-slate-50 border-slate-200 text-slate-700"
                        >
                          {p.column}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] py-0 ${
                            isDirectResp
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isDirectResp ? 'Responsável' : 'Participante'}
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
                      className="h-7 text-xs text-blue-600 hover:bg-blue-50 shrink-0"
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
                <Bell className="w-4 h-4 text-purple-600" /> Notificações e Menções
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Avisos internos, menções e prazos dirigidos à sua conta
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
            {isLoading ? (
              <div className="text-center py-10 text-gray-400 text-xs flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando notificações...</span>
              </div>
            ) : personalNotifs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                Nenhuma notificação pendente no momento. Tudo em dia!
              </div>
            ) : (
              personalNotifs.slice(0, 6).map((n) => {
                const isFatal = n.alertType === 'Prazo Fatal'
                const isMention =
                  n.alertType === 'Mencao' ||
                  (n.projectTitle && n.projectTitle.toLowerCase().includes('mencionou')) ||
                  (n.mensagem && n.mensagem.toLowerCase().includes('mencionou'))
                return (
                  <div
                    key={n.id}
                    onClick={() => handleOpenNotification(n)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                      isFatal
                        ? 'border-red-100 bg-red-50/30 hover:bg-red-50/60'
                        : isMention
                          ? 'border-purple-100 bg-purple-50/20 hover:bg-purple-50/50'
                          : 'border-gray-100 hover:bg-slate-50/70'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isFatal
                          ? 'bg-red-100 text-red-600'
                          : isMention
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {isFatal ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : isMention ? (
                        <AtSign className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#1c2a3e] truncate">
                          {n.projectTitle || 'Notificação'}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 ${
                            isFatal
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : isMention
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
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
      <Card className="bg-white border-0 shadow-subtle">
        <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-600" /> Meus Grupos de Capacitação
            </CardTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              Grupos da Academia Municipal aos quais sua conta está vinculada
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
        <CardContent className="p-4">
          {isLoading ? (
            <div className="text-center py-6 text-gray-400 text-xs flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span>Carregando seus grupos...</span>
            </div>
          ) : eduGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              <Users className="w-7 h-7 mx-auto mb-2 text-gray-300" />
              Sua conta ainda não participa de grupos de capacitação nesta prefeitura.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
