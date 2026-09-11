import { Users, ArrowLeft, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { TenantUsersManager } from '@/components/superadmin/TenantUsersManager'
import { TenantRequiredNotice } from '@/components/TenantRequiredNotice'
import { EmptyState } from '@/components/common/StateDisplay'

export default function UsuariosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAuthorized = user?.role === 'superadmin' || user?.role === 'admin'

  if (isAuthorized) {
    if (user?.role === 'superadmin' && !user?.tenantId) {
      return (
        <div className="space-y-4 animate-fade-in">
          <TenantRequiredNotice
            title="Selecione uma prefeitura para gerenciar usuários municipais"
            description="A gestão de servidores, cargos, convites e aprovações de acesso ocorre no escopo de cada município. Como superadministrador na visão global, selecione uma prefeitura para continuar."
          />
        </div>
      )
    }
    return <TenantUsersManager />
  }

  return (
    <div className="max-w-md mx-auto py-16 animate-fade-in">
      <EmptyState
        icon={<ShieldAlert className="w-6 h-6 text-red-500" aria-hidden="true" />}
        title="Acesso Restrito"
        description="A gestão de usuários e convites é restrita aos administradores municipais e superadministradores do sistema."
        action={{
          label: 'Voltar ao Início',
          onClick: () => navigate('/dashboard'),
          icon: <ArrowLeft className="w-4 h-4" aria-hidden="true" />,
          variant: 'outline',
        }}
      />
    </div>
  )
}
