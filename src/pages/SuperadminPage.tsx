import React from 'react'
import { Shield, Building2, Users, Settings, Lock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { SuperadminProvider } from '@/context/SuperadminContext'
import { PrefeiturasTab } from '@/components/superadmin/PrefeiturasTab'
import { GlobalUsersTab } from '@/components/superadmin/GlobalUsersTab'
import { PlatformConfigTab } from '@/components/superadmin/PlatformConfigTab'

export default function SuperadminPage() {
  const { user } = useAuth()

  if (user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-[#1c2a3e]">Acesso Negado</h2>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Você não tem permissão para acessar o painel de Superadministração. Apenas usuários com
          perfil &quot;superadmin&quot; podem visualizar esta página.
        </p>
      </div>
    )
  }

  return (
    <SuperadminProvider>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#1c2a3e]">Painel do Superadministrador</h2>
            <p className="text-sm text-gray-500">
              Gestão centralizada de prefeituras, usuários e configurações da plataforma.
            </p>
          </div>
        </div>

        <Card className="bg-white border-0 shadow-subtle p-6">
          <Tabs defaultValue="prefeituras" className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
              <TabsTrigger value="prefeituras" className="gap-2">
                <Building2 className="w-4 h-4" /> Prefeituras
              </TabsTrigger>
              <TabsTrigger value="usuarios" className="gap-2">
                <Users className="w-4 h-4" /> Usuários Globais
              </TabsTrigger>
              <TabsTrigger value="config" className="gap-2">
                <Settings className="w-4 h-4" /> Configurações
              </TabsTrigger>
            </TabsList>
            <TabsContent value="prefeituras">
              <PrefeiturasTab />
            </TabsContent>
            <TabsContent value="usuarios">
              <GlobalUsersTab />
            </TabsContent>
            <TabsContent value="config">
              <PlatformConfigTab />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </SuperadminProvider>
  )
}
