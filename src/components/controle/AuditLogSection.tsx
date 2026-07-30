import React, { useEffect, useState } from 'react'
import { Plus, ArrowLeftRight, Pencil, History, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AuditActionType } from '@/types/controle'
import { MOCK_AUDIT_LOG } from '@/data/mockControle'
import { getAllAuditLogs } from '@/services/projects'
import { useAuth } from '@/context/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'

const ACTION_CONFIG: Record<
  AuditActionType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  'Criou card': { icon: Plus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  'Moveu card': { icon: ArrowLeftRight, color: 'text-amber-600', bg: 'bg-amber-50' },
  'Editou card': { icon: Pencil, color: 'text-violet-600', bg: 'bg-violet-50' },
}

export const AuditLogSection: React.FC = () => {
  const { user } = useAuth()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadLogs = async () => {
    try {
      const data = await getAllAuditLogs(
        user?.role === 'superadmin' ? undefined : user?.tenantId || undefined,
      )
      if (data.length > 0) {
        setLogs(data)
      } else {
        setLogs(MOCK_AUDIT_LOG)
      }
    } catch {
      setLogs(MOCK_AUDIT_LOG)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [user])

  useRealtime('audit_logs', () => {
    loadLogs()
  })

  return (
    <Card className="shadow-xs border border-gray-100">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-[#1c2a3e]" />
          <h3 className="font-bold text-sm text-[#1c2a3e]">Histórico Geral de Auditoria</h3>
          <Badge variant="outline" className="text-[10px] ml-1">
            {logs.length} registros
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
            {logs.map((entry) => {
              const actionKey =
                entry.actionType in ACTION_CONFIG
                  ? (entry.actionType as AuditActionType)
                  : 'Editou card'
              const config = ACTION_CONFIG[actionKey]
              const Icon = config.icon
              const dt = entry.dateTime ? new Date(entry.dateTime) : new Date()
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}
                  >
                    <Icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#1c2a3e]">{entry.userName}</span>
                      <Badge variant="outline" className={`text-[10px] ${config.color}`}>
                        {entry.actionType}
                      </Badge>
                      <span className="text-xs text-gray-500 truncate">{entry.projectTitle}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{entry.description}</p>
                  </div>
                  <div className="text-[10px] text-gray-400 shrink-0 text-right">
                    <p>{dt.toLocaleDateString('pt-BR')}</p>
                    <p>{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
