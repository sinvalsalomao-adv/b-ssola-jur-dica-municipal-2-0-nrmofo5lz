import React, { useState } from 'react'
import { DfdForm } from '@/components/DfdForm'
import { RecentDfdsList } from '@/components/RecentDfdsList'
import { DocumentTemplatesSection } from '@/components/DocumentTemplatesSection'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileText, PlusCircle, LayoutList } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { TenantRequiredNotice } from '@/components/TenantRequiredNotice'
import { PageHeader } from '@/components/common/PageHeader'

export default function DfdsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<string>('recentes')
  const isSuperadminWithoutTenant = user?.role === 'superadmin' && !user?.tenantId

  if (isSuperadminWithoutTenant) {
    return (
      <div className="space-y-6 animate-fade-in">
        <TenantRequiredNotice
          title="Selecione uma prefeitura para gerenciar DFDs"
          description="Os Documentos de Formalização de Demanda são vinculados à gestão municipal. Como superadministrador na visão global, selecione uma prefeitura para elaborar novos DFDs ou consultar o histórico."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Documentos de Formalização de Demanda (DFD)"
        description="Elabore DFDs com justificativas padrão do setor jurídico, anexe documentos e consulte o histórico municipal."
        icon={FileText}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white border border-gray-200 p-1 rounded-xl mb-4 inline-flex">
          <TabsTrigger value="novo" className="text-xs font-medium gap-1.5 py-1.5 px-3">
            <PlusCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
            Novo DFD
          </TabsTrigger>
          <TabsTrigger value="recentes" className="text-xs font-medium gap-1.5 py-1.5 px-3">
            <LayoutList className="w-3.5 h-3.5 text-[#3b82f6]" />
            DFDs Recentes
          </TabsTrigger>
          <TabsTrigger value="templates" className="text-xs font-medium gap-1.5 py-1.5 px-3">
            <FileText className="w-3.5 h-3.5 text-[#3b82f6]" />
            Modelos de Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novo" className="focus-visible:outline-hidden">
          <DfdForm onSaved={() => setActiveTab('recentes')} />
        </TabsContent>

        <TabsContent value="recentes" className="focus-visible:outline-hidden">
          <RecentDfdsList />
        </TabsContent>

        <TabsContent value="templates" className="focus-visible:outline-hidden">
          <DocumentTemplatesSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}
