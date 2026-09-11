import { useState, useEffect } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useSuperadmin } from '@/context/SuperadminContext'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Plus,
  Settings2,
  Building2,
  Shield,
  Layers,
  Users,
  FolderKanban,
  CheckCircle2,
  Globe,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DEFAULT_WIDGET_CONFIG, type WidgetConfig } from '@/types/dashboard'
import { getDashboardPreferences, saveDashboardPreferences } from '@/services/dashboard-preferences'
import { AdminWidgetProvider } from '@/components/admin/AdminWidgetProvider'
import { DashboardCustomizeModal } from '@/components/admin/DashboardCustomizeModal'
import {
  StatsOverviewWidget,
  RecentProjectsWidget,
  UsersTotalWidget,
  UsersStatusWidget,
  RecentAccessWidget,
  RecentNotificationsWidget,
  StalledItemsWidget,
  RecentAuditLogsWidget,
} from '@/components/admin/AdminStatWidgets'
import {
  ChartUsersRoleWidget,
  ChartProjectsColumnWidget,
} from '@/components/admin/AdminChartWidgets'
import { UserPersonalDashboard } from '@/components/dashboard/UserPersonalDashboard'

const WIDGET_COMPONENTS: Record<string, React.FC> = {
  'stats-overview': StatsOverviewWidget,
  'recent-projects': RecentProjectsWidget,
  'users-total': UsersTotalWidget,
  'users-status': UsersStatusWidget,
  'recent-access': RecentAccessWidget,
  'recent-notifications': RecentNotificationsWidget,
  'stalled-items': StalledItemsWidget,
  'chart-users-role': ChartUsersRoleWidget,
  'chart-projects-column': ChartProjectsColumnWidget,
  'recent-audit-logs': RecentAuditLogsWidget,
}

export default function Dashboard() {
  const { setIsNewModalOpen } = useProjects()
  const { user, setTenantContext } = useAuth()
  const { prefeituras, globalUsers, loading: superLoading } = useSuperadmin()
  const navigate = useNavigate()
  const isSuperadmin = user?.role === 'superadmin'
  const isTenantAdmin = user?.role === 'admin'
  const isPrivileged = isTenantAdmin || isSuperadmin
  const hasTenantContext = !!user?.tenantId
  const [prefs, setPrefs] = useState<WidgetConfig[]>(DEFAULT_WIDGET_CONFIG)
  const [customizeOpen, setCustomizeOpen] = useState(false)

  useEffect(() => {
    if (isPrivileged && user?.id) {
      getDashboardPreferences(user.id).then(setPrefs)
    }
  }, [isPrivileged, user?.id])

  const handleSavePrefs = async (config: WidgetConfig[]) => {
    setPrefs(config)
    if (user?.id && user?.tenantId) {
      await saveDashboardPreferences(user.id, user.tenantId, config)
    }
  }

  const header = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
      <div className="space-y-1">
        <h1 className="text-xl md:text-2xl font-bold text-[#1c2a3e] tracking-tight">
          Gestão Integrada de Projetos Municipais
        </h1>
        <p className="text-xs md:text-sm text-gray-500">
          Acompanhe em tempo real as etapas jurídicas, licitatórias e operacionais das prefeituras.
        </p>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap shrink-0">
        {isPrivileged && (
          <Button
            onClick={() => setCustomizeOpen(true)}
            variant="outline"
            className="border-gray-200 text-[#1c2a3e] hover:bg-slate-50 gap-1.5 text-xs h-9"
            aria-label="Personalizar painel de widgets"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" /> Personalizar
          </Button>
        )}
        <Button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5 text-xs h-9 shadow-sm"
          aria-label="Criar novo projeto municipal"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> Novo Projeto
        </Button>
        <Button
          onClick={() => navigate('/bussola')}
          variant="outline"
          className="border-gray-200 text-[#1c2a3e] hover:bg-slate-50 gap-1.5 text-xs h-9"
          aria-label="Acessar o quadro Kanban da Bússola"
        >
          Ver Quadro Bússola <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )

  // SUPERADMIN: Se não selecionou prefeitura, exibir visão global autorizada
  if (isSuperadmin && !hasTenantContext) {
    const totalPrefeituras = prefeituras.length
    const ativas = prefeituras.filter((p) => p.status === 'ativa').length
    const totalUsuariosGlobais = globalUsers.length

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 font-semibold text-xs border border-purple-200">
                <Globe className="w-3 h-3 mr-1" aria-hidden="true" /> Visão Global Superadmin
              </Badge>
              <Badge variant="outline" className="text-xs text-slate-600">
                Escopo Multi-Tenant
              </Badge>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#1c2a3e] tracking-tight">
              Painel de Controle Corporativo
            </h1>
            <p className="text-xs md:text-sm text-gray-500 mt-0.5">
              Resumo institucional consolidado das prefeituras cadastradas e acesso aos contextos
              municipais isolados.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => navigate('/superadmin')}
              className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2 shadow-sm text-xs h-9"
              aria-label="Ir para a gestão centralizada de prefeituras"
            >
              <Building2 className="w-4 h-4" aria-hidden="true" /> Gestão de Prefeituras
            </Button>
          </div>
        </div>

        {/* Indicadores Globais Autorizados (Sem misturar dados entre tenants) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
            onClick={() => navigate('/superadmin')}
            title="Prefeituras municipais cadastradas no sistema"
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total de Prefeituras
                </p>
                <h3 className="text-3xl font-extrabold mt-2 text-[#3b82f6]">
                  {superLoading ? '—' : totalPrefeituras}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {superLoading ? 'Carregando...' : `${ativas} ativas na plataforma`}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#3b82f6] flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
            onClick={() => navigate('/superadmin')}
            title="Usuários cadastrados no escopo global da plataforma"
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Usuários na Plataforma
                </p>
                <h3 className="text-3xl font-extrabold mt-2 text-emerald-600">
                  {superLoading ? '—' : totalUsuariosGlobais}
                </h3>
                <p className="text-xs text-gray-400 mt-1">Servidores e administradores</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
            onClick={() => navigate('/superadmin')}
            title="Configurações e Limites das 7 Etapas"
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Etapas do Processo
                </p>
                <h3 className="text-3xl font-extrabold mt-2 text-purple-600">7 Etapas</h3>
                <p className="text-xs text-gray-400 mt-1">Padronizadas em todas as cidades</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Layers className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-white border-0 shadow-subtle hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer"
            onClick={() => navigate('/superadmin')}
            title="Módulos de auditoria e segurança ativos"
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Segurança & Isolamento
                </p>
                <h3 className="text-3xl font-extrabold mt-2 text-indigo-600">100%</h3>
                <p className="text-xs text-gray-400 mt-1">RLS e Multi-Tenant estrito</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seleção Rápida de Prefeitura para Entrada no Contexto Isolado */}
        <Card className="bg-white border-0 shadow-subtle">
          <CardHeader className="p-5 pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-[#1c2a3e] flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#3b82f6]" /> Entrar no Contexto de um Município
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">
                Ao selecionar uma prefeitura, os indicadores municipais substituirão os globais com
                isolamento total de dados.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {prefeituras.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">
                Nenhuma prefeitura cadastrada no momento.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {prefeituras.map((pref) => (
                  <div
                    key={pref.id}
                    onClick={() => setTenantContext(pref.id)}
                    className="p-3.5 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h5 className="font-bold text-xs text-[#1c2a3e] group-hover:text-blue-600 transition-colors">
                          {pref.name}
                        </h5>
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 ${
                            pref.status === 'ativa'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-amber-700 bg-amber-50 border-amber-200'
                          }`}
                        >
                          {pref.status === 'ativa' ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {pref.cidade ? `${pref.cidade} - ${pref.estado}` : 'Município cadastrado'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-blue-600 group-hover:bg-blue-100/50"
                    >
                      Acessar <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // SUPERADMIN EM CONTEXTO MUNICIPAL ESPECÍFICO:
  // Mostra banner de contexto ativo com opção de retornar para a visão global
  const superadminContextBanner = isSuperadmin && hasTenantContext && (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
          <Building2 className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">
              Contexto Municipal Ativo: {user?.prefeitura || 'Prefeitura'}
            </span>
            <Badge className="bg-amber-200 text-amber-900 border-0 text-[10px] font-semibold">
              Superadmin Conectado
            </Badge>
          </div>
          <p className="text-xs text-amber-700 mt-0.5">
            Exibindo indicadores e dados restritos a este município. Ações executadas afetarão esta
            prefeitura.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setTenantContext(null)}
        className="h-8 text-xs border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 font-medium"
      >
        <Globe className="w-3.5 h-3.5 mr-1" /> Voltar à Visão Global
      </Button>
    </div>
  )

  // USUÁRIO COMUM (servidor, gestor, secretário, etc.)
  if (!isTenantAdmin && !isSuperadmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        {header}
        <UserPersonalDashboard />
      </div>
    )
  }

  // ADMINISTRADOR MUNICIPAL (ou Superadmin no contexto do tenant)
  const visibleWidgets = prefs.filter((w) => w.visible).sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6 animate-fade-in">
      {superadminContextBanner}
      {header}
      <AdminWidgetProvider>
        {visibleWidgets.length === 0 ? (
          <Card className="bg-white border-0 shadow-subtle">
            <CardContent className="p-12 text-center">
              <p className="text-sm text-gray-400 mb-3">Nenhum card selecionado</p>
              <Button
                onClick={() => setCustomizeOpen(true)}
                className="bg-[#3b82f6] hover:bg-[#2563eb] text-white"
              >
                Personalizar Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {visibleWidgets.map((w) => {
              const Component = WIDGET_COMPONENTS[w.id]
              return Component ? <Component key={w.id} /> : null
            })}
          </div>
        )}
      </AdminWidgetProvider>
      <DashboardCustomizeModal
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        config={prefs}
        onSave={handleSavePrefs}
      />
    </div>
  )
}
