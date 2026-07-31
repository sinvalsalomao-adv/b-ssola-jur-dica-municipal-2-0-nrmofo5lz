import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Bell, Calendar, FileText } from 'lucide-react'
import { NotificacoesTab } from '@/components/controle/NotificacoesTab'
import { AgendaTab } from '@/components/controle/AgendaTab'
import { DocumentosTab } from '@/components/controle/DocumentosTab'
import { AuditLogSection } from '@/components/controle/AuditLogSection'
import {
  DocumentItem,
  StallLimits,
  DEFAULT_STALL_LIMITS,
  DEFAULT_PROXIMITY_DAYS,
} from '@/types/controle'
import { MOCK_DOCUMENTS } from '@/data/mockControle'
import { useAuth } from '@/context/AuthContext'
import { AdminDashboardCards } from '@/components/admin/AdminDashboardCards'
import { AdminCharts } from '@/components/controle/AdminCharts'

export default function ControlePage() {
  const { user } = useAuth()
  const [stallLimits, setStallLimits] = useState<StallLimits>(DEFAULT_STALL_LIMITS)
  const [proximityDays, setProximityDays] = useState(DEFAULT_PROXIMITY_DAYS)
  const [documents, setDocuments] = useState<DocumentItem[]>(MOCK_DOCUMENTS)

  const handleSaveLimits = (limits: StallLimits, proximity: number) => {
    setStallLimits(limits)
    setProximityDays(proximity)
  }

  const handleAddDocument = (doc: DocumentItem) => {
    setDocuments((prev) => [doc, ...prev])
  }

  const handleDeleteDocument = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1c2a3e] flex items-center justify-center">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1c2a3e]">Central de Controle</h2>
          <p className="text-xs text-gray-500">
            Monitoramento de notificações, agenda, documentos e auditoria.
          </p>
        </div>
      </div>

      {user?.role === 'admin' && <AdminDashboardCards />}

      {user?.role === 'admin' && <AdminCharts />}

      <Tabs defaultValue="notificacoes" className="w-full">
        <TabsList className="bg-white border border-gray-100 shadow-sm rounded-lg p-1 overflow-x-auto flex w-full sm:w-auto">
          <TabsTrigger
            value="notificacoes"
            className="text-xs gap-1.5 data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white"
          >
            <Bell className="w-3.5 h-3.5" /> Notificações
          </TabsTrigger>
          <TabsTrigger
            value="agenda"
            className="text-xs gap-1.5 data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white"
          >
            <Calendar className="w-3.5 h-3.5" /> Agenda
          </TabsTrigger>
          <TabsTrigger
            value="documentos"
            className="text-xs gap-1.5 data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white"
          >
            <FileText className="w-3.5 h-3.5" /> Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notificacoes" className="mt-4">
          <NotificacoesTab
            limits={stallLimits}
            proximityDays={proximityDays}
            onSaveLimits={handleSaveLimits}
          />
        </TabsContent>
        <TabsContent value="agenda" className="mt-4">
          <AgendaTab proximityDays={proximityDays} />
        </TabsContent>
        <TabsContent value="documentos" className="mt-4">
          <DocumentosTab
            documents={documents}
            onAddDocument={handleAddDocument}
            onDeleteDocument={handleDeleteDocument}
          />
        </TabsContent>
      </Tabs>

      <AuditLogSection />
    </div>
  )
}
