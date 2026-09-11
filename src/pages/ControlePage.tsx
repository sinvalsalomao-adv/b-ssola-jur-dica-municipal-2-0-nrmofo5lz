import { useNavigate } from 'react-router-dom'
import { ShieldAlert, ArrowRight, LayoutDashboard, Bell, FileText, Users } from 'lucide-react'
import { AuditLogSection } from '@/components/controle/AuditLogSection'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export default function ControlePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1c2a3e]">Administração & Auditoria</h2>
            <p className="text-xs text-gray-500">
              Governança, conformidade e atalhos de gestão operacional municipal consolidada.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-xs gap-1.5"
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Visão Geral (Dashboard)
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/notificacoes')}
            className="text-xs bg-[#3b82f6] hover:bg-[#2563eb] text-white gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" /> Central de Notificações
          </Button>
        </div>
      </div>

      {/* Atalhos para destinos consolidados reais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className="bg-white border-0 shadow-subtle hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-[#1c2a3e]">
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-blue-600" />
                Visão Geral Consolidada
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Todos os indicadores operacionais, gráficos de gargalos e cartões de status unificados
              em um só lugar.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs font-medium text-blue-600">Abrir Dashboard &rarr;</span>
          </CardContent>
        </Card>

        <Card
          className="bg-white border-0 shadow-subtle hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/notificacoes')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-[#1c2a3e]">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                Central de Notificações Real
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Notificações salvas no banco com filtro "Para mim" (menções diretas) e suporte
              multi-prefeitura.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs font-medium text-amber-600">Ver Notificações &rarr;</span>
          </CardContent>
        </Card>

        <Card
          className="bg-white border-0 shadow-subtle hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => navigate('/audit-logs')}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between text-[#1c2a3e]">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                Logs de Auditoria Completos
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Trilha de eventos, buscas e histórico paginado de ações realizadas por servidores e
              gestores.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <span className="text-xs font-medium text-emerald-600">Acessar Histórico &rarr;</span>
          </CardContent>
        </Card>
      </div>

      {/* Seção de Trilha de Auditoria Recente - Dados Reais e Persistentes */}
      <AuditLogSection />
    </div>
  )
}
