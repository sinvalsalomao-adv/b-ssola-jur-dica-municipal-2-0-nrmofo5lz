import React from 'react'
import { Users, ArrowLeft, UserPlus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { USERS } from '@/types/project'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/context/AuthContext'
import { TenantUsersManager } from '@/components/superadmin/TenantUsersManager'

export default function UsuariosPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (user?.role === 'superadmin' || user?.role === 'admin') {
    return <TenantUsersManager />
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-[#1c2a3e]">Gestão de Usuários</h2>
            <p className="text-sm text-gray-500">
              Servidores e procuradores cadastrados na Bússola Jurídica.
            </p>
          </div>
        </div>

        <Button className="bg-[#3b82f6] text-white gap-2">
          <UserPlus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </div>

      <Card className="bg-white border-0 shadow-subtle p-6">
        <CardContent className="p-0 space-y-4">
          <h3 className="text-base font-bold text-[#1c2a3e] border-b pb-3">Usuários Ativos</h3>
          <div className="divide-y divide-gray-100">
            {USERS.map((user, idx) => (
              <div key={user} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 bg-[#1c2a3e] text-white font-bold">
                    <AvatarFallback>{user.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-sm font-bold text-[#1c2a3e]">{user}</h4>
                    <p className="text-xs text-gray-500">
                      {user.toLowerCase()}@prefeitura.rn.gov.br
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs bg-slate-50">
                    {idx % 2 === 0 ? 'Procurador Jurídico' : 'Analista Técnico'}
                  </Badge>
                  <Badge className="bg-emerald-500 text-white text-[10px]">Ativo</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
