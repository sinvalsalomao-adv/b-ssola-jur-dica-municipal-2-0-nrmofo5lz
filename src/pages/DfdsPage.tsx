import React, { useState } from 'react'
import { DfdForm } from '@/components/DfdForm'
import { RecentDfdsList } from '@/components/RecentDfdsList'
import { DocumentTemplatesSection } from '@/components/DocumentTemplatesSection'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { FileText, PlusCircle, LayoutList } from 'lucide-react'

export default function DfdsPage() {
  const [activeTab, setActiveTab] = useState<string>('recentes')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1c2a3e]">
            Documentos de Formalização de Demanda (DFD)
          </h2>
          <p className="text-xs text-gray-500">
            Elabore DFDs com frases padrão do setor jurídico e gerencie modelos de documentos.
          </p>
        </div>
      </div>

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
