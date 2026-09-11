import React from 'react'
import { Shield, Building2, Users, Settings, Lock } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { PrefeiturasTab } from '@/components/superadmin/PrefeiturasTab'
import { GlobalUsersTab } from '@/components/superadmin/GlobalUsersTab'
import { PlatformConfigTab } from '@/components/superadmin/PlatformConfigTab'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateDisplay'

export default function SuperadminPage() {
  const { user } = useAuth()

  if (user?.role !== 'superadmin') {
    return (
      <div className="max-w-md mx-auto py-16 animate-fade-in">
        <EmptyState
          icon={<Lock className="w-6 h-6 text-red-500" aria-hidden="true" />}
          title="Acesso Restrito ao Superadministrador"
          description="Você não tem permissão para acessar o painel de Superadministração global. Apenas operadores centrais da plataforma possuem esta credencial."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Painel do Superadministrador"
        description="Gestão centralizada de municípios, governança de usuários globais e parametrização geral da plataforma."
        icon={Shield}
      />

      <Card className="bg-white border-0 shadow-subtle p-6">
        <Tabs defaultValue="prefeituras" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 mb-6">
            <TabsTrigger value="prefeituras" className="gap-2">
              <Building2 className="w-4 h-4" /> <span>Prefeituras</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="w-4 h-4" /> <span>Usuários Globais</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="w-4 h-4" /> <span>Configurações</span>
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
  )
}
