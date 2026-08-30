import { Users, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { TenantUsersManager } from '@/components/superadmin/TenantUsersManager'

export default function UsuariosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isAuthorized = user?.role === 'superadmin' || user?.role === 'admin'

  if (isAuthorized) {
    return <TenantUsersManager />
  }

  return (
    <div className="max-w-md mx-auto py-16 text-center space-y-4 animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-500">
        <Users className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-[#1c2a3e]">Acesso Restrito</h2>
      <p className="text-xs text-gray-500">
        A gestão de usuários é restrita aos administradores municipais e superadministradores do
        sistema.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/dashboard')}
        className="gap-2 mt-2"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
      </Button>
    </div>
  )
}
