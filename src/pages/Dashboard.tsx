import { useState, useEffect } from 'react'
import { useProjects } from '@/context/ProjectContext'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Settings2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const [prefs, setPrefs] = useState<WidgetConfig[]>(DEFAULT_WIDGET_CONFIG)
  const [customizeOpen, setCustomizeOpen] = useState(false)

  useEffect(() => {
    if (isAdmin && user?.id) {
      getDashboardPreferences(user.id).then(setPrefs)
    }
  }, [isAdmin, user?.id])

  const handleSavePrefs = async (config: WidgetConfig[]) => {
    setPrefs(config)
    if (user?.id && user?.tenantId) {
      await saveDashboardPreferences(user.id, user.tenantId, config)
    }
  }

  const header = (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-[#1c2a3e]">
          Gestão Integrada de Projetos Municipais
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe em tempo real as etapas jurídicas, licitatórias e operacionais das prefeituras.
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {isAdmin && (
          <Button
            onClick={() => setCustomizeOpen(true)}
            variant="outline"
            className="border-gray-200 text-[#1c2a3e] hover:bg-slate-50 gap-2"
          >
            <Settings2 className="w-4 h-4" /> Personalizar
          </Button>
        )}
        <Button
          onClick={() => setIsNewModalOpen(true)}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-2 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Projeto
        </Button>
        <Button
          onClick={() => navigate('/bussola')}
          variant="outline"
          className="border-gray-200 text-[#1c2a3e] hover:bg-slate-50 gap-2"
        >
          Ver Quadro Bússola <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        {header}
        <StatsOverviewWidget />
        <RecentProjectsWidget />
      </div>
    )
  }

  const visibleWidgets = prefs.filter((w) => w.visible).sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-6 animate-fade-in">
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
